import { gotScraping } from 'crawlee'

import { isFileFresh, readTextFile, sleep, writeTextFile } from '../cache'

interface FetchHtmlOptions {
  url: string
  cachePath: string
  maxAgeMs: number
  timeoutMs: number
  maxRetries: number
  headers?: Record<string, string>
}

interface FetchHtmlResult {
  url: string
  html: string
  fromCache: boolean
}

function getRetryDelayMs(attempt: number): number {
  return 400 * (attempt + 1) ** 2
}

export async function fetchHtmlWithCheerio(
  options: FetchHtmlOptions,
): Promise<FetchHtmlResult | null> {
  const cached = await readTextFile(options.cachePath)

  if (cached && (await isFileFresh(options.cachePath, options.maxAgeMs))) {
    return {
      url: options.url,
      html: cached,
      fromCache: true,
    }
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt < options.maxRetries; attempt += 1) {
    try {
      const response = await gotScraping({
        url: options.url,
        headers: options.headers,
        responseType: 'text',
        timeout: {
          request: options.timeoutMs,
        },
        retry: {
          limit: 0,
        },
        throwHttpErrors: false,
      })

      if (response.statusCode >= 400) {
        throw new Error(`Request failed: ${response.statusCode} for ${options.url}`)
      }

      const html =
        typeof response.body === 'string'
          ? response.body
          : Buffer.from(response.body as Uint8Array).toString('utf8')
      await writeTextFile(options.cachePath, html)

      return {
        url: response.url,
        html,
        fromCache: false,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      await sleep(getRetryDelayMs(attempt))
    }
  }

  if (cached) {
    return {
      url: options.url,
      html: cached,
      fromCache: true,
    }
  }

  if (lastError) {
    throw lastError
  }

  return null
}
