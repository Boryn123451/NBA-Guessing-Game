import { PlaywrightCrawler } from 'crawlee'

import { isFileFresh, readTextFile, writeTextFile } from '../cache'

interface FetchRenderedHtmlOptions {
  url: string
  cachePath: string
  maxAgeMs: number
  timeoutMs: number
  maxRetries: number
  waitForSelector?: string
}

interface FetchRenderedHtmlResult {
  url: string
  html: string
  fromCache: boolean
}

export async function fetchHtmlWithPlaywright(
  options: FetchRenderedHtmlOptions,
): Promise<FetchRenderedHtmlResult | null> {
  const cached = await readTextFile(options.cachePath)

  if (cached && (await isFileFresh(options.cachePath, options.maxAgeMs))) {
    return {
      url: options.url,
      html: cached,
      fromCache: true,
    }
  }

  let html: string | null = null
  let finalUrl = options.url
  let lastError: Error | null = null

  const crawler = new PlaywrightCrawler({
    minConcurrency: 1,
    maxConcurrency: 1,
    maxRequestRetries: options.maxRetries,
    requestHandlerTimeoutSecs: Math.ceil(options.timeoutMs / 1000),
    async requestHandler({ page, request }) {
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, {
          timeout: options.timeoutMs,
        })
      }

      html = await page.content()
      finalUrl = page.url() || request.loadedUrl || request.url
    },
    async failedRequestHandler({ request, error }) {
      finalUrl = request.loadedUrl ?? request.url
      lastError = error instanceof Error ? error : new Error(String(error))
    },
  })

  await crawler.run([options.url])

  if (!html) {
    if (lastError) {
      throw lastError
    }

    return cached
      ? {
          url: options.url,
          html: cached,
          fromCache: true,
        }
      : null
  }

  await writeTextFile(options.cachePath, html)

  return {
    url: finalUrl,
    html,
    fromCache: false,
  }
}

