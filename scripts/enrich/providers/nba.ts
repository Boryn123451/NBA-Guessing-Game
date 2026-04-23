import path from 'node:path'

import { normalizeBirthDateValue } from '../../../src/lib/nba/age'
import { enrichConfig } from '../config'
import { isFileFresh, readJsonFile, writeJsonFile, sleep } from '../cache'
import type { ProviderResult } from '../types'

const COMMON_PLAYER_INFO_SOURCE =
  'https://stats.nba.com/stats/commonplayerinfo?LeagueID=00&PlayerID={playerId}'

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Referer: 'https://www.nba.com/',
  Origin: 'https://www.nba.com',
  Accept: 'application/json, text/plain, */*',
}

let nextNbaRequestAt = 0
let uncachedNbaRequestCount = 0

function isThrottleWorthyError(error: unknown): boolean {
  const summary = error instanceof Error ? error.message : String(error)
  return summary.includes('429') || summary.includes('ECONNRESET') || summary.includes('Timeout')
}

async function throttleNbaRequest(): Promise<void> {
  const now = Date.now()
  const waitMs = Math.max(0, nextNbaRequestAt - now)

  if (waitMs > 0) {
    await sleep(waitMs)
  }

  uncachedNbaRequestCount += 1
  const applyBatchCooldown =
    enrichConfig.nbaBatchSize > 0 && uncachedNbaRequestCount % enrichConfig.nbaBatchSize === 0
  nextNbaRequestAt =
    Date.now() +
    (applyBatchCooldown ? enrichConfig.nbaBatchCooldownMs : enrichConfig.nbaMinDelayMs)
}

interface ResultSetResponse {
  resultSets: Array<{
    name?: string
    headers: string[]
    rowSet: Array<Array<string | number | null>>
  }>
}

function parseDraftYear(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  if (typeof value !== 'string') {
    return null
  }

  const parsedValue = Number(value.trim())
  return Number.isFinite(parsedValue) ? Math.trunc(parsedValue) : null
}

async function fetchJsonWithRetry(url: string): Promise<ResultSetResponse> {
  let lastError: unknown

  for (let attempt = 0; attempt < enrichConfig.maxRetries; attempt += 1) {
    try {
      await throttleNbaRequest()
      const response = await fetch(url, {
        headers: NBA_HEADERS,
        signal: AbortSignal.timeout(enrichConfig.nbaTimeoutMs),
      })

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }

      return (await response.json()) as ResultSetResponse
    } catch (error) {
      lastError = error
      if (isThrottleWorthyError(error)) {
        nextNbaRequestAt = Math.max(
          nextNbaRequestAt,
          Date.now() + enrichConfig.nbaBatchCooldownMs,
        )
      }
      await sleep(500 * (attempt + 1) ** 2)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

function mapResultSet(response: ResultSetResponse): Record<string, unknown> | null {
  const resultSet = response.resultSets.find((entry) => entry.name === 'CommonPlayerInfo') ?? response.resultSets[0]

  if (!resultSet?.rowSet[0]) {
    return null
  }

  return Object.fromEntries(resultSet.headers.map((header, index) => [header, resultSet.rowSet[0][index]]))
}

export async function fetchNbaCommonPlayerInfo(playerId: number): Promise<ProviderResult | null> {
  const rawCachePath = path.join(enrichConfig.rawDirectory, 'nba', `${playerId}.json`)
  const parsedCachePath = path.join(enrichConfig.parsedDirectory, 'nba', `${playerId}.json`)
  const cachedParsed = await readJsonFile<ProviderResult>(parsedCachePath)

  if (cachedParsed && (await isFileFresh(parsedCachePath, enrichConfig.commonPlayerInfoMaxAgeMs))) {
    return {
      ...cachedParsed,
      fromCache: true,
    }
  }

  const url = COMMON_PLAYER_INFO_SOURCE.replace('{playerId}', `${playerId}`)
  const response = await fetchJsonWithRetry(url)
  await writeJsonFile(rawCachePath, response)

  const row = mapResultSet(response)

  if (!row) {
    return null
  }

  const result: ProviderResult = {
    source: 'nba',
    transport: 'api',
    url,
    fetchedAt: new Date().toISOString(),
    fromCache: false,
    birthDate: normalizeBirthDateValue(typeof row.BIRTHDATE === 'string' ? row.BIRTHDATE : null),
    entryDraftYear: parseDraftYear(row.DRAFT_YEAR),
    entryDraftYearSource: parseDraftYear(row.DRAFT_YEAR) === null ? null : 'draft',
  }

  await writeJsonFile(parsedCachePath, result)
  return result
}
