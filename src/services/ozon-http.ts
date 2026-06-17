const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
}

export interface OzonFetchResult {
  response: Response
  cookies: string
}

export async function ozonFetch(
  url: string,
  extraHeaders: Record<string, string> = {},
  maxRedirects = 10,
): Promise<OzonFetchResult> {
  let current = url
  let cookies = ''

  for (let attempt = 0; attempt < maxRedirects; attempt += 1) {
    const headers: Record<string, string> = {
      ...DEFAULT_HEADERS,
      ...extraHeaders,
    }
    if (cookies) {
      headers.Cookie = cookies
    }

    const response = await fetch(current, {
      headers,
      redirect: 'manual',
    })

    const setCookies = response.headers.getSetCookie?.() ?? []
    if (setCookies.length > 0) {
      const parts = cookies ? cookies.split('; ') : []
      for (const cookie of setCookies) {
        parts.push(cookie.split(';')[0])
      }
      cookies = [...new Set(parts.filter(Boolean))].join('; ')
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) {
        return { response, cookies }
      }
      current = new URL(location, current).toString()
      continue
    }

    return { response, cookies }
  }

  throw new Error('Ozon: превышено число редиректов')
}

export function isChallengeResponse(status: number, body: string): boolean {
  return status === 403 && (body.includes('challengeURL') || body.includes('challenge'))
}

export { DEFAULT_HEADERS }
