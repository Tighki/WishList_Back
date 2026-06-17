import { chromium } from 'playwright-core'
import type { ParsedOzonProduct } from '../types/index.js'
import { parseWidgetStates } from './ozon-parser.js'

export async function parseOzonWithPlaywright(
  productUrl: string,
  productPath: string,
): Promise<Partial<ParsedOzonProduct>> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  })

  try {
    const context = await browser.newContext({
      locale: 'ru-RU',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 900 },
    })
    const page = await context.newPage()

    let widgetStates: Record<string, string> | null = null

    page.on('response', async (response) => {
      if (!response.url().includes('composer-api.bx/page/json/v2')) return
      if (response.status() !== 200) return
      try {
        const json = (await response.json()) as { widgetStates?: Record<string, string> }
        if (json.widgetStates) widgetStates = json.widgetStates
      } catch {
        // ignore
      }
    })

    await page.goto(productUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    })

    await page.waitForTimeout(2500)

    if (widgetStates) {
      return parseWidgetStates(widgetStates)
    }

    const fromPage = await page.evaluate(() => {
      const result: {
        title?: string
        description?: string
        price?: number
        imageUrl?: string
      } = {}

      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content')
      const ogDescription = document
        .querySelector('meta[property="og:description"]')
        ?.getAttribute('content')

      if (ogTitle) result.title = ogTitle
      if (ogImage) result.imageUrl = ogImage
      if (ogDescription) result.description = ogDescription

      const heading = document.querySelector('h1')
      if (!result.title && heading?.textContent) {
        result.title = heading.textContent.trim()
      }

      const priceNode = document.querySelector('[data-widget="webPrice"] span')
      if (priceNode?.textContent) {
        const digits = priceNode.textContent.replace(/[^\d]/g, '')
        if (digits) result.price = Number.parseInt(digits, 10)
      }

      const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')]
      for (const script of scripts) {
        try {
          const json = JSON.parse(script.textContent ?? '') as Record<string, unknown>
          const items = Array.isArray(json['@graph']) ? json['@graph'] : [json]
          for (const item of items) {
            if (!item || typeof item !== 'object') continue
            const record = item as Record<string, unknown>
            if (record['@type'] !== 'Product') continue
            if (!result.title && typeof record.name === 'string') result.title = record.name
            const offers = record.offers as Record<string, unknown> | undefined
            if (!result.price && offers?.price) {
              const price = Number(offers.price)
              if (Number.isFinite(price)) result.price = Math.round(price)
            }
            const image = record.image
            if (!result.imageUrl) {
              if (typeof image === 'string') result.imageUrl = image
              if (Array.isArray(image) && typeof image[0] === 'string') {
                result.imageUrl = image[0]
              }
            }
          }
        } catch {
          continue
        }
      }

      return result
    })

    if (!fromPage.title) {
      throw new Error(`Playwright: не удалось получить данные для ${productPath}`)
    }

    return fromPage
  } finally {
    await browser.close()
  }
}
