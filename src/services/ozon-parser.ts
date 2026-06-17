import type { ParsedOzonProduct } from '../types/index.js'
import { DEFAULT_HEADERS, isChallengeResponse, ozonFetch } from './ozon-http.js'

const OZON_HOSTS = new Set(['ozon.ru', 'www.ozon.ru'])
const COMPOSER_API =
  'https://www.ozon.ru/api/composer-api.bx/page/json/v2'

export class OzonParseError extends Error {
  code: 'INVALID_URL' | 'FETCH_FAILED' | 'PARSE_FAILED' | 'BLOCKED'

  constructor(
    message: string,
    code: 'INVALID_URL' | 'FETCH_FAILED' | 'PARSE_FAILED' | 'BLOCKED',
  ) {
    super(message)
    this.name = 'OzonParseError'
    this.code = code
  }
}

export function normalizeOzonUrl(input: string): string {
  let parsed: URL
  try {
    parsed = new URL(input.trim())
  } catch {
    throw new OzonParseError('Некорректная ссылка', 'INVALID_URL')
  }

  if (!OZON_HOSTS.has(parsed.hostname)) {
    throw new OzonParseError('Поддерживаются только ссылки ozon.ru', 'INVALID_URL')
  }

  parsed.hash = ''
  parsed.search = ''
  if (!parsed.pathname.endsWith('/')) {
    parsed.pathname += '/'
  }

  return parsed.toString()
}

export function extractProductPath(url: string): string {
  const parsed = new URL(url)
  const match = parsed.pathname.match(/\/product\/[^/]+\/?/)
  if (!match) {
    throw new OzonParseError(
      'Не удалось определить страницу товара в ссылке Ozon',
      'INVALID_URL',
    )
  }
  const path = match[0].endsWith('/') ? match[0] : `${match[0]}/`
  return path
}

async function resolveShortUrl(url: string): Promise<string> {
  const parsed = new URL(url)
  if (parsed.pathname.startsWith('/product/')) {
    return normalizeOzonUrl(url)
  }

  const { response } = await ozonFetch(url, DEFAULT_HEADERS)
  if (!response.ok) {
    throw new OzonParseError(
      `Ozon вернул статус ${response.status}`,
      'FETCH_FAILED',
    )
  }

  return normalizeOzonUrl(response.url)
}

export function parseWidgetStates(
  widgetStates: Record<string, string>,
): Partial<ParsedOzonProduct> {
  const result: Partial<ParsedOzonProduct> = {}

  for (const [key, rawValue] of Object.entries(widgetStates)) {
    let widget: unknown
    try {
      widget = JSON.parse(rawValue)
    } catch {
      continue
    }

    if (!widget || typeof widget !== 'object') continue

    if (key.includes('webSale') && !result.title) {
      const product = deepFind(widget, 'product') as Record<string, unknown> | null
      if (product && typeof product.title === 'string') {
        result.title = product.title
      }
      if (product && result.price === undefined) {
        const price = pickPrice(product.finalPrice ?? product.price)
        if (price !== null) result.price = price
      }
      if (product && typeof product.id === 'string') {
        result.ozonId = product.id
      }
    }

    if (key.includes('webProductHeading') && !result.title) {
      const title = deepFind(widget, 'title') ?? deepFind(widget, 'name')
      if (typeof title === 'string') result.title = title
    }

    if (key.includes('webPrice') && result.price === undefined) {
      const price = extractPriceFromWidget(widget)
      if (price !== null) result.price = price
    }

    if (key.includes('webGallery') && !result.imageUrl) {
      const imageUrl = extractImageFromGallery(widget)
      if (imageUrl) result.imageUrl = imageUrl
    }

    if (
      (key.includes('webDescription') || key.includes('webShortDescription')) &&
      !result.description
    ) {
      const description = extractDescription(widget)
      if (description) result.description = description
    }

    if (key.includes('webProductMainWidget') && !result.imageUrl) {
      const imageUrl = findFirstImageUrl(widget)
      if (imageUrl) result.imageUrl = imageUrl
    }
  }

  return result
}

function extractDescription(widget: unknown): string | null {
  const richAnnotation = deepFind(widget, 'richAnnotation')
  if (typeof richAnnotation === 'string' && richAnnotation.trim()) {
    return stripHtml(richAnnotation).slice(0, 500)
  }

  const description = deepFind(widget, 'description')
  if (typeof description === 'string' && description.trim()) {
    return stripHtml(description).slice(0, 500)
  }

  const content = deepFind(widget, 'content')
  if (typeof content === 'string' && content.trim()) {
    return stripHtml(content).slice(0, 500)
  }

  return null
}

function extractImageFromGallery(widget: unknown): string | null {
  const images = deepFind(widget, 'images')
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object') {
      const candidate = (first as Record<string, unknown>).src ??
        (first as Record<string, unknown>).link ??
        (first as Record<string, unknown>).url
      if (typeof candidate === 'string') return candidate
    }
  }

  const coverImage = deepFind(widget, 'coverImage')
  if (typeof coverImage === 'string') return coverImage

  return findFirstImageUrl(widget)
}

function extractPriceFromWidget(widget: unknown): number | null {
  const candidates = [
    deepFind(widget, 'finalPrice'),
    deepFind(widget, 'price'),
    deepFind(widget, 'cardPrice'),
    deepFind(widget, 'originalPrice'),
  ]

  for (const candidate of candidates) {
    const price = pickPrice(candidate)
    if (price !== null) return price
  }

  const priceText = deepFind(widget, 'priceText') ?? deepFind(widget, 'text')
  if (typeof priceText === 'string') {
    return parsePriceText(priceText)
  }

  return null
}

function parsePriceText(text: string): number | null {
  const digits = text.replace(/[^\d]/g, '')
  if (!digits) return null
  return Number.parseInt(digits, 10)
}

function pickPrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }
  if (typeof value === 'string') {
    return parsePriceText(value)
  }
  return null
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function findFirstImageUrl(value: unknown, depth = 0): string | null {
  if (depth > 8 || value == null) return null

  if (typeof value === 'string') {
    if (/^https?:\/\/.+\.(jpg|jpeg|png|webp)/i.test(value)) return value
    if (value.includes('ir.ozone.ru') || value.includes('cdn1.ozone.ru')) {
      return value
    }
    return null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstImageUrl(item, depth + 1)
      if (found) return found
    }
    return null
  }

  if (typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      const found = findFirstImageUrl(nested, depth + 1)
      if (found) return found
    }
  }

  return null
}

function deepFind(value: unknown, key: string, depth = 0): unknown {
  if (depth > 10 || value == null) return null

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFind(item, key, depth + 1)
      if (found !== null && found !== undefined) return found
    }
    return null
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (key in record) return record[key]
    for (const nested of Object.values(record)) {
      const found = deepFind(nested, key, depth + 1)
      if (found !== null && found !== undefined) return found
    }
  }

  return null
}

function parseJsonLdFromHtml(html: string): Partial<ParsedOzonProduct> {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)]
  for (const match of scripts) {
    try {
      const json = JSON.parse(match[1]) as Record<string, unknown>
      const items = Array.isArray(json['@graph']) ? json['@graph'] : [json]
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const record = item as Record<string, unknown>
        if (record['@type'] !== 'Product') continue

        const offers = record.offers as Record<string, unknown> | undefined
        const price = pickPrice(offers?.price)
        const image = record.image
        const imageUrl =
          typeof image === 'string'
            ? image
            : Array.isArray(image) && typeof image[0] === 'string'
              ? image[0]
              : null

        return {
          title: typeof record.name === 'string' ? record.name : undefined,
          description:
            typeof record.description === 'string'
              ? stripHtml(record.description).slice(0, 500)
              : undefined,
          price: price ?? undefined,
          imageUrl: imageUrl ?? undefined,
          ozonId: typeof record.sku === 'string' ? record.sku : undefined,
        }
      }
    } catch {
      continue
    }
  }
  return {}
}

async function fetchComposerData(productPath: string): Promise<Record<string, string>> {
  const apiUrl = `${COMPOSER_API}?url=${encodeURIComponent(productPath)}`
  const { response } = await ozonFetch(apiUrl, {
    ...DEFAULT_HEADERS,
    Accept: 'application/json, text/plain, */*',
    Referer: 'https://www.ozon.ru/',
  })

  const contentType = response.headers.get('content-type') ?? ''
  const body = await response.text()

  if (isChallengeResponse(response.status, body)) {
    throw new OzonParseError(
      'Ozon запросил проверку (антибот). Используем браузерный парсер…',
      'BLOCKED',
    )
  }

  if (!response.ok) {
    throw new OzonParseError(
      `Ozon API вернул статус ${response.status}`,
      response.status === 403 || response.status === 429 ? 'BLOCKED' : 'FETCH_FAILED',
    )
  }

  if (!contentType.includes('application/json')) {
    throw new OzonParseError(
      'Ozon вернул HTML вместо данных товара',
      'FETCH_FAILED',
    )
  }

  const payload = JSON.parse(body) as { widgetStates?: Record<string, string> }
  if (!payload.widgetStates || Object.keys(payload.widgetStates).length === 0) {
    throw new OzonParseError('Ozon не вернул данные о товаре', 'PARSE_FAILED')
  }

  return payload.widgetStates
}

async function fetchHtmlFallback(productUrl: string): Promise<Partial<ParsedOzonProduct>> {
  const { response } = await ozonFetch(productUrl, DEFAULT_HEADERS)
  const html = await response.text()

  if (isChallengeResponse(response.status, html)) {
    throw new OzonParseError('Ozon заблокировал запрос', 'BLOCKED')
  }

  if (!response.ok) {
    throw new OzonParseError(
      `Не удалось загрузить страницу товара (${response.status})`,
      'FETCH_FAILED',
    )
  }

  const fromJsonLd = parseJsonLdFromHtml(html)
  if (fromJsonLd.title || fromJsonLd.price) {
    return fromJsonLd
  }

  const ogTitle = html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1]
  const ogImage = html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1]
  const ogDescription = html.match(/property="og:description"\s+content="([^"]+)"/i)?.[1]

  return {
    title: ogTitle ? decodeHtmlEntities(ogTitle) : undefined,
    imageUrl: ogImage ? decodeHtmlEntities(ogImage) : undefined,
    description: ogDescription ? decodeHtmlEntities(ogDescription).slice(0, 500) : undefined,
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export async function parseOzonProduct(inputUrl: string): Promise<ParsedOzonProduct> {
  const resolvedUrl = await resolveShortUrl(inputUrl)
  const productPath = extractProductPath(resolvedUrl)

  let parsed: Partial<ParsedOzonProduct> = {}
  let useBrowser = false

  try {
    const widgetStates = await fetchComposerData(productPath)
    parsed = parseWidgetStates(widgetStates)
  } catch (error) {
    if (error instanceof OzonParseError && error.code !== 'INVALID_URL') {
      useBrowser = true
    } else {
      throw error
    }
  }

  if (!useBrowser && (!parsed.title || parsed.price == null)) {
    try {
      const fallback = await fetchHtmlFallback(resolvedUrl)
      parsed = { ...fallback, ...parsed }
    } catch {
      useBrowser = true
    }
  }

  if (useBrowser || !parsed.title || parsed.price == null) {
    try {
      const { parseOzonWithPlaywright } = await import('./ozon-playwright.js')
      const browserParsed = await parseOzonWithPlaywright(resolvedUrl, productPath)
      parsed = { ...browserParsed, ...parsed }
    } catch (error) {
      console.error('[ozon] Playwright parser failed:', error)
      if (!parsed.title) {
        throw error instanceof OzonParseError
          ? error
          : new OzonParseError(
              'Ozon заблокировал автоматический парсинг. Попробуйте позже.',
              'BLOCKED',
            )
      }
    }
  }

  if (!parsed.title) {
    throw new OzonParseError(
      'Не удалось извлечь название товара. Проверьте ссылку.',
      'PARSE_FAILED',
    )
  }

  return {
    url: resolvedUrl,
    title: parsed.title,
    description: parsed.description ?? '',
    price: parsed.price ?? 0,
    imageUrl: parsed.imageUrl ?? '',
    ozonId: parsed.ozonId,
  }
}
