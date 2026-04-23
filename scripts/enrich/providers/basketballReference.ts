import path from 'node:path'

import { normalizeBirthDateValue } from '../../../src/lib/nba/age'
import { normalizeSearchValue, splitPlayerName } from '../../../src/lib/nba/normalize'
import { enrichConfig } from '../config'
import { readJsonFile, sleep, writeJsonFile } from '../cache'
import type { ProviderResult } from '../types'
import { fetchHtmlWithCheerio } from './crawleeHttp'
import { fetchHtmlWithPlaywright } from './crawleePlaywright'

const BASKETBALL_REFERENCE_BASE_URL = 'https://www.basketball-reference.com'
const BASKETBALL_REFERENCE_SEARCH_SOURCE =
  'https://www.basketball-reference.com/search/search.fcgi?search={query}'

let nextBasketballReferenceRequestAt = 0

function normalizeExternalPlayerName(value: string): string {
  return normalizeSearchValue(value)
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractPlayerPath(html: string, displayName: string): string | null {
  const canonicalMatch = html.match(
    /<link rel="canonical" href="https:\/\/www\.basketball-reference\.com(\/players\/[a-z]\/[^"]+\.html)"/i,
  )

  if (canonicalMatch) {
    return canonicalMatch[1]
  }

  const { firstName, lastName } = splitPlayerName(displayName)
  const targetNames = new Set(
    [
      displayName,
      `${firstName} ${lastName}`.trim(),
      `${firstName.replace(/\./g, '')} ${lastName}`.trim(),
    ].map(normalizeExternalPlayerName),
  )
  const playerPathPattern = /<a[^>]+href="(\/players\/[a-z]\/[^"]+\.html)"[^>]*>([^<]+)<\/a>/gi

  while (true) {
    const match = playerPathPattern.exec(html)

    if (!match) {
      return null
    }

    if (targetNames.has(normalizeExternalPlayerName(match[2]))) {
      return match[1]
    }
  }
}

function extractBirthDate(html: string): string | null {
  const dataBirthMatch = html.match(/data-birth="(\d{4}-\d{2}-\d{2})"/i)

  if (dataBirthMatch) {
    return normalizeBirthDateValue(dataBirthMatch[1])
  }

  const birthDateMatch = html.match(/itemprop="birthDate"[^>]*datetime="(\d{4}-\d{2}-\d{2})"/i)
  return birthDateMatch ? normalizeBirthDateValue(birthDateMatch[1]) : null
}

function extractEntryDraftYear(html: string): { year: number | null; source: ProviderResult['entryDraftYearSource'] } {
  const draftLinkMatch = html.match(/\/draft\/NBA_(\d{4})\.html/i)

  if (draftLinkMatch) {
    return {
      year: Number(draftLinkMatch[1]),
      source: 'draft',
    }
  }

  const debutMatch = html.match(/NBA Debut[^<]*<\/strong>\s*([^<]*?)(\d{4})/i)

  if (debutMatch) {
    return {
      year: Number(debutMatch[2]),
      source: 'debut-fallback',
    }
  }

  return {
    year: null,
    source: null,
  }
}

async function throttleBasketballReference(): Promise<void> {
  const waitMs = Math.max(0, nextBasketballReferenceRequestAt - Date.now())
  nextBasketballReferenceRequestAt =
    Math.max(nextBasketballReferenceRequestAt, Date.now()) + enrichConfig.basketballReferenceMinDelayMs

  if (waitMs > 0) {
    await sleep(waitMs)
  }
}

async function fetchSearchPage(
  playerId: number,
  displayName: string,
  transport: 'http' | 'playwright',
): Promise<{ html: string; fromCache: boolean; url: string } | null> {
  const url = BASKETBALL_REFERENCE_SEARCH_SOURCE.replace('{query}', encodeURIComponent(displayName))
  const cachePath = path.join(
    enrichConfig.rawDirectory,
    'basketball-reference',
    transport,
    `${playerId}-search.html`,
  )

  await throttleBasketballReference()

  if (transport === 'playwright') {
    return fetchHtmlWithPlaywright({
      url,
      cachePath,
      maxAgeMs: enrichConfig.basketballReferenceMaxAgeMs,
      timeoutMs: enrichConfig.playwrightTimeoutMs,
      maxRetries: enrichConfig.maxRetries,
      waitForSelector: 'body',
    })
  }

  return fetchHtmlWithCheerio({
    url,
    cachePath,
    maxAgeMs: enrichConfig.basketballReferenceMaxAgeMs,
    timeoutMs: enrichConfig.httpTimeoutMs,
    maxRetries: enrichConfig.maxRetries,
  })
}

async function fetchPlayerPage(
  playerId: number,
  playerPath: string,
  transport: 'http' | 'playwright',
): Promise<{ html: string; fromCache: boolean; url: string } | null> {
  const url = `${BASKETBALL_REFERENCE_BASE_URL}${playerPath}`
  const cachePath = path.join(
    enrichConfig.rawDirectory,
    'basketball-reference',
    transport,
    `${playerId}-player.html`,
  )

  await throttleBasketballReference()

  if (transport === 'playwright') {
    return fetchHtmlWithPlaywright({
      url,
      cachePath,
      maxAgeMs: enrichConfig.basketballReferenceMaxAgeMs,
      timeoutMs: enrichConfig.playwrightTimeoutMs,
      maxRetries: enrichConfig.maxRetries,
      waitForSelector: '#meta',
    })
  }

  return fetchHtmlWithCheerio({
    url,
    cachePath,
    maxAgeMs: enrichConfig.basketballReferenceMaxAgeMs,
    timeoutMs: enrichConfig.httpTimeoutMs,
    maxRetries: enrichConfig.maxRetries,
  })
}

export async function fetchBasketballReferenceProfile(
  playerId: number,
  displayName: string,
  transport: 'http' | 'playwright',
): Promise<ProviderResult | null> {
  const parsedCachePath = path.join(
    enrichConfig.parsedDirectory,
    'basketball-reference',
    transport,
    `${playerId}.json`,
  )
  const cachedParsed = await readJsonFile<ProviderResult>(parsedCachePath)

  if (cachedParsed) {
    return {
      ...cachedParsed,
      fromCache: true,
    }
  }

  const searchPage = await fetchSearchPage(playerId, displayName, transport)

  if (!searchPage) {
    return null
  }

  const playerPath = extractPlayerPath(searchPage.html, displayName)

  if (!playerPath) {
    return null
  }

  const playerPage = await fetchPlayerPage(playerId, playerPath, transport)

  if (!playerPage) {
    return null
  }

  const entryDraftYear = extractEntryDraftYear(playerPage.html)
  const result: ProviderResult = {
    source: 'basketballReference',
    transport,
    url: playerPage.url,
    fetchedAt: new Date().toISOString(),
    fromCache: searchPage.fromCache && playerPage.fromCache,
    birthDate: extractBirthDate(playerPage.html),
    entryDraftYear: entryDraftYear.year,
    entryDraftYearSource: entryDraftYear.source,
  }

  await writeJsonFile(parsedCachePath, result)
  return result
}

