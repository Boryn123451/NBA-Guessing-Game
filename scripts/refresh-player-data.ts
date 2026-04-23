import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DateTime } from 'luxon'

import { getCurrentSeason } from '../src/lib/nba/daily'
import { normalizeBirthDateValue, normalizePlayerAge } from '../src/lib/nba/age'
import {
  buildSearchText,
  canonicalizePosition,
  inchesToCentimeters,
  normalizeSearchValue,
  parseHeightToInches,
  positionTokensFromLabel,
  splitPlayerName,
} from '../src/lib/nba/normalize'
import { TEAM_BY_ID, TEAM_METADATA } from '../src/lib/nba/teamMetadata'
import { deriveActiveTenDayContracts } from '../src/lib/nba/tenDayContracts'
import type {
  DraftDetails,
  PlayerImageFallbackManifest,
  PlayerMovementRow,
  PlayerPoolData,
  PlayerRecord,
  ScheduledGame,
  SeasonSnapshot,
  ThemeFlags,
} from '../src/lib/nba/types'

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Referer: 'https://www.nba.com/',
  Origin: 'https://www.nba.com',
  Accept: 'application/json, text/plain, */*',
}

const PLAYER_INDEX_SOURCE = 'https://stats.nba.com/stats/playerindex?LeagueID=00&Season={season}'
const HISTORICAL_PLAYER_INDEX_SOURCE =
  'https://stats.nba.com/stats/playerindex?College=&Country=&Height=&Historical=1&LeagueID=00&Season={season}&TeamID=0'
const BIO_STATS_SOURCE =
  'https://stats.nba.com/stats/leaguedashplayerbiostats?College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear=&GameScope=&GameSegment=&Height=&LastNGames=0&LeagueID=00&Location=&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season={season}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&StarterBench=&TeamID=0&VsConference=&VsDivision=&Weight='
const ADVANCED_PLAYER_STATS_SOURCE =
  'https://stats.nba.com/stats/leaguedashplayerstats?College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear=&GameScope=&GameSegment=&Height=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season={season}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision=&Weight='
const TRANSACTION_SOURCE = 'https://stats.nba.com/js/data/playermovement/NBA_Player_Movement.json'
const SCHEDULE_SOURCE = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json'
const STANDINGS_SOURCE =
  'https://stats.nba.com/stats/leaguestandingsv3?LeagueID=00&Season={season}&SeasonType=Regular%20Season'
const DRAFT_HISTORY_SOURCE =
  'https://stats.nba.com/stats/drafthistory?LeagueID=00&SeasonYear={year}'
const FRANCHISE_PLAYERS_SOURCE =
  'https://stats.nba.com/stats/franchiseplayers?LeagueID=00&TeamID={teamId}&PerMode=PerGame'
const ALL_STAR_ROSTER_SOURCE = 'https://www.nba.com/allstar/{year}/roster'
const PLAYER_AWARDS_SOURCE = 'https://stats.nba.com/stats/playerawards?PlayerID={playerId}'
const COMMON_PLAYER_INFO_SOURCE =
  'https://stats.nba.com/stats/commonplayerinfo?LeagueID=00&PlayerID={playerId}'
const TWO_K_RATINGS_IMAGE_BASE = 'https://www.2kratings.com/wp-content/uploads'
const BASKETBALL_REFERENCE_BASE_URL = 'https://www.basketball-reference.com'
const BASKETBALL_REFERENCE_SEARCH_SOURCE =
  'https://www.basketball-reference.com/search/search.fcgi?search={query}'
const BASKETBALL_REFERENCE_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Accept: 'text/html,application/xhtml+xml',
}
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000
const DEFAULT_REQUEST_TIMEOUT_MS = resolveBoundedTimeout('REFRESH_REQUEST_TIMEOUT_MS', 45_000)
const DEFAULT_REQUEST_MAX_ATTEMPTS = resolvePositiveInteger('REFRESH_REQUEST_MAX_ATTEMPTS', 5)
const REQUEST_RETRY_BASE_DELAY_MS = 1_000
const CORE_SOURCE_TIMEOUT_MS = resolveBoundedTimeout('REFRESH_CORE_SOURCE_TIMEOUT_MS', DEFAULT_REQUEST_TIMEOUT_MS)
const COMMON_PLAYER_INFO_TIMEOUT_MS = resolveBoundedTimeout(
  'REFRESH_COMMON_PLAYER_INFO_TIMEOUT_MS',
  DEFAULT_REQUEST_TIMEOUT_MS,
)
const BASKETBALL_REFERENCE_TIMEOUT_MS = resolveBoundedTimeout(
  'REFRESH_BASKETBALL_REFERENCE_TIMEOUT_MS',
  DEFAULT_REQUEST_TIMEOUT_MS,
)
const PLAYER_AWARDS_TIMEOUT_MS = resolveBoundedTimeout(
  'REFRESH_PLAYER_AWARDS_TIMEOUT_MS',
  DEFAULT_REQUEST_TIMEOUT_MS,
)
const CURRENT_BIO_CONCURRENCY = resolvePositiveInteger('REFRESH_CURRENT_BIO_CONCURRENCY', 3)
const HISTORICAL_BIO_CONCURRENCY = resolvePositiveInteger('REFRESH_HISTORICAL_BIO_CONCURRENCY', 1)
const PLAYER_AWARDS_CONCURRENCY = resolvePositiveInteger('REFRESH_PLAYER_AWARDS_CONCURRENCY', 2)
const COMMON_PLAYER_INFO_CACHE_MAX_AGE_MS = resolvePositiveInteger(
  'REFRESH_COMMON_PLAYER_INFO_CACHE_MAX_AGE_MS',
  14 * 24 * 60 * 60 * 1000,
)
const BASKETBALL_REFERENCE_CACHE_MAX_AGE_MS = resolvePositiveInteger(
  'REFRESH_BASKETBALL_REFERENCE_CACHE_MAX_AGE_MS',
  180 * 24 * 60 * 60 * 1000,
)
const PLAYER_AWARDS_CACHE_MAX_AGE_MS = resolvePositiveInteger(
  'REFRESH_PLAYER_AWARDS_CACHE_MAX_AGE_MS',
  30 * 24 * 60 * 60 * 1000,
)
const COMMON_PLAYER_INFO_FAILURE_RETRY_MS = resolvePositiveInteger(
  'REFRESH_COMMON_PLAYER_INFO_FAILURE_RETRY_MS',
  12 * 60 * 60 * 1000,
)
const BASKETBALL_REFERENCE_FAILURE_RETRY_MS = resolvePositiveInteger(
  'REFRESH_BASKETBALL_REFERENCE_FAILURE_RETRY_MS',
  7 * 24 * 60 * 60 * 1000,
)
const BASKETBALL_REFERENCE_MIN_INTERVAL_MS = resolvePositiveInteger(
  'REFRESH_BASKETBALL_REFERENCE_MIN_INTERVAL_MS',
  3000,
)
const NBA_SOURCE_MIN_INTERVAL_MS = resolvePositiveInteger('REFRESH_NBA_MIN_INTERVAL_MS', 250)
const NBA_SOURCE_BATCH_SIZE = resolvePositiveInteger('REFRESH_NBA_BATCH_SIZE', 48)
const NBA_SOURCE_BATCH_COOLDOWN_MS = resolvePositiveInteger('REFRESH_NBA_BATCH_COOLDOWN_MS', 4_000)
const IMAGE_SOURCE_MIN_INTERVAL_MS = resolvePositiveInteger('REFRESH_IMAGE_MIN_INTERVAL_MS', 120)
const IMAGE_SOURCE_BATCH_SIZE = resolvePositiveInteger('REFRESH_IMAGE_BATCH_SIZE', 60)
const IMAGE_SOURCE_BATCH_COOLDOWN_MS = resolvePositiveInteger('REFRESH_IMAGE_BATCH_COOLDOWN_MS', 2_000)
const CURRENT_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000
const HISTORY_REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000
const FORCED_PLAYER_IDS = new Set(
  (process.env.REFRESH_FORCE_PLAYER_IDS ?? '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0),
)

type ResultValue = string | number | null
type EnrichmentField = 'birthDate' | 'entryDraftYear'
type EnrichmentSourceKey = 'commonPlayerInfo' | 'basketballReference'
type EnrichmentRecordStatus = 'complete' | 'partial' | 'missing_fields' | 'failed_last_attempt'
type RefreshMode = 'auto' | 'all' | 'current' | 'images' | 'repair-missing'

interface ResultSetResponse {
  resultSets: Array<{
    name?: string
    headers: string[]
    rowSet: ResultValue[][]
  }>
}

interface ScheduleResponse {
  leagueSchedule: {
    gameDates: Array<{
      games: ScheduledGame[]
    }>
  }
}

interface PlayerMovementResponse {
  NBA_Player_Movement: {
    rows: PlayerMovementRow[]
  }
}

interface StandingSnapshot {
  playoffRank: number | null
  playoffPicture: boolean | null
}

interface PlayerIdentity {
  id: number
  slug: string
  displayName: string
  firstName: string
  lastName: string
  isCurrentPlayer: boolean
}

interface PlayerBioProfile {
  birthDate: string | null
  isGreatest75: boolean
  entryDraftYear: number | null
  entryDraftYearSource: PlayerRecord['entryDraftYearSource']
}

interface RequestFailureSummary {
  count: number
  sampleUrl: string
  sampleMessage: string
}

interface EnrichmentSourceState {
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastFailureMessage: string | null
}

interface PlayerEnrichmentState {
  playerId: number
  status: EnrichmentRecordStatus
  missingFields: EnrichmentField[]
  updatedAt: string
  sources: Record<EnrichmentSourceKey, EnrichmentSourceState>
}

interface EnrichmentStatusManifest {
  schemaVersion: 1
  updatedAt: string
  players: Record<string, PlayerEnrichmentState>
}

interface BioRefreshOptions {
  missingOnly?: boolean
}

const requestFailureSummary = new Map<string, RequestFailureSummary>()
interface SourceThrottleState {
  nextRequestAt: number
  uncachedRequestCount: number
}

const sourceThrottleState: Record<'nba' | 'basketballReference' | 'image', SourceThrottleState> = {
  nba: { nextRequestAt: 0, uncachedRequestCount: 0 },
  basketballReference: { nextRequestAt: 0, uncachedRequestCount: 0 },
  image: { nextRequestAt: 0, uncachedRequestCount: 0 },
}

function resolvePositiveInteger(name: string, fallback: number): number {
  const rawValue = process.env[name]
  const parsedValue = rawValue ? Number(rawValue) : Number.NaN

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback
  }

  return Math.trunc(parsedValue)
}

function resolveBoundedTimeout(name: string, fallback: number): number {
  return Math.min(resolvePositiveInteger(name, fallback), FIVE_HOURS_MS)
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

type ThrottleSource = keyof typeof sourceThrottleState

function getThrottleSource(url: string): ThrottleSource {
  if (url.includes('bask')) {
    return 'basketballReference'
  }

  if (url.includes('2kratings.com')) {
    return 'image'
  }

  return 'nba'
}

function getThrottleConfig(source: ThrottleSource): {
  minIntervalMs: number
  batchSize: number
  batchCooldownMs: number
} {
  if (source === 'basketballReference') {
    return {
      minIntervalMs: BASKETBALL_REFERENCE_MIN_INTERVAL_MS,
      batchSize: 1,
      batchCooldownMs: BASKETBALL_REFERENCE_MIN_INTERVAL_MS,
    }
  }

  if (source === 'image') {
    return {
      minIntervalMs: IMAGE_SOURCE_MIN_INTERVAL_MS,
      batchSize: IMAGE_SOURCE_BATCH_SIZE,
      batchCooldownMs: IMAGE_SOURCE_BATCH_COOLDOWN_MS,
    }
  }

  return {
    minIntervalMs: NBA_SOURCE_MIN_INTERVAL_MS,
    batchSize: NBA_SOURCE_BATCH_SIZE,
    batchCooldownMs: NBA_SOURCE_BATCH_COOLDOWN_MS,
  }
}

async function throttleSourceRequest(url: string): Promise<void> {
  const source = getThrottleSource(url)
  const state = sourceThrottleState[source]
  const config = getThrottleConfig(source)
  const now = Date.now()
  const waitMs = Math.max(0, state.nextRequestAt - now)

  if (waitMs > 0) {
    await sleep(waitMs)
  }

  state.uncachedRequestCount += 1
  const applyBatchCooldown =
    config.batchSize > 0 && state.uncachedRequestCount % config.batchSize === 0
  state.nextRequestAt =
    Date.now() + (applyBatchCooldown ? config.batchCooldownMs : config.minIntervalMs)
}

function applyThrottlePenalty(url: string, error: unknown): void {
  const summary = getErrorSummary(error)

  if (!summary.includes('429') && !summary.includes('ECONNRESET') && !summary.includes('Timeout')) {
    return
  }

  const source = getThrottleSource(url)
  const state = sourceThrottleState[source]
  const config = getThrottleConfig(source)
  state.nextRequestAt = Math.max(state.nextRequestAt, Date.now() + config.batchCooldownMs)
}

function parseRefreshMode(argv: string[]): RefreshMode {
  const rawValue = argv[2]?.trim().toLowerCase()

  if (rawValue === 'all' || rawValue === 'full' || rawValue === 'history') {
    return 'all'
  }

  if (rawValue === 'current') {
    return 'current'
  }

  if (rawValue === 'images') {
    return 'images'
  }

  if (rawValue === 'repair-missing' || rawValue === 'add-missing' || rawValue === 'missing') {
    return 'repair-missing'
  }

  return 'auto'
}

function getRequestFailureKey(url: string): string {
  if (url.includes('commonplayerinfo')) {
    return 'commonPlayerInfo'
  }

  if (url.includes('playerawards')) {
    return 'playerAwards'
  }

  if (url.includes('drafthistory')) {
    return 'draftHistory'
  }

  if (url.includes('franchiseplayers')) {
    return 'franchisePlayers'
  }

  if (url.includes('basketball-reference.com/search')) {
    return 'basketballReferenceSearch'
  }

  if (url.includes('basketball-reference.com/players/')) {
    return 'basketballReferencePlayer'
  }

  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

function getErrorSummary(error: unknown): string {
  if (error instanceof Error && error.message) {
    return `${error.name}: ${error.message}`
  }

  return 'Unknown request failure'
}

function getRetryDelayMs(error: unknown, attempt: number): number {
  const multiplier = attempt + 1
  const summary = getErrorSummary(error)

  if (summary.includes('429') || summary.includes('ECONNRESET')) {
    return REQUEST_RETRY_BASE_DELAY_MS * 5 * multiplier
  }

  if (summary.includes('Timeout')) {
    return REQUEST_RETRY_BASE_DELAY_MS * 2 * multiplier
  }

  return REQUEST_RETRY_BASE_DELAY_MS * multiplier
}

function recordFailedRequest(url: string, error: unknown): void {
  const key = getRequestFailureKey(url)
  const existing = requestFailureSummary.get(key)

  requestFailureSummary.set(key, {
    count: (existing?.count ?? 0) + 1,
    sampleUrl: existing?.sampleUrl ?? url,
    sampleMessage: existing?.sampleMessage ?? getErrorSummary(error),
  })
}

function flushFailedRequestSummary(): void {
  if (requestFailureSummary.size === 0) {
    return
  }

  console.warn('Completed refresh with skipped requests:')

  for (const [key, summary] of requestFailureSummary.entries()) {
    console.warn(
      `- ${key}: ${summary.count} skipped request(s). Sample: ${summary.sampleUrl} :: ${summary.sampleMessage}`,
    )
  }
}

function cleanText(value: ResultValue): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()

  if (!normalized || normalized.toLowerCase() === 'none') {
    return null
  }

  return normalized
}

function parseNumberValue(value: ResultValue): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseIntegerValue(value: ResultValue): number | null {
  const parsed = parseNumberValue(value)
  return parsed === null ? null : Math.trunc(parsed)
}

function createHeadshotUrl(playerId: number): string {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`
}

function normalizeExternalPlayerName(value: string): string {
  return normalizeSearchValue(value)
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildPlayerIdentityFromRow(
  row: Record<string, ResultValue>,
): PlayerIdentity | null {
  const id = parseIntegerValue(row.PERSON_ID)

  if (id === null) {
    return null
  }

  const displayName = `${String(row.PLAYER_FIRST_NAME ?? '').trim()} ${String(
    row.PLAYER_LAST_NAME ?? '',
  ).trim()}`.trim()
  const { firstName, lastName } = splitPlayerName(displayName)

  return {
    id,
    slug: String(row.PLAYER_SLUG ?? '').trim(),
    displayName,
    firstName,
    lastName,
    isCurrentPlayer: false,
  }
}

function buildPlayerIdentityFromPlayer(player: PlayerRecord): PlayerIdentity {
  return {
    id: player.id,
    slug: player.slug,
    displayName: player.displayName,
    firstName: player.firstName,
    lastName: player.lastName,
    isCurrentPlayer: player.isCurrentPlayer,
  }
}

function mergePlayerBioProfiles(
  ...profiles: Array<Partial<PlayerBioProfile> | null | undefined>
): PlayerBioProfile | null {
  const birthDate = profiles.map((profile) => profile?.birthDate ?? null).find(isPresent) ?? null
  const entryDraftYear =
    profiles.map((profile) => profile?.entryDraftYear ?? null).find(isPresent) ?? null
  const entryDraftYearSource =
    profiles.map((profile) => profile?.entryDraftYearSource ?? null).find(isPresent) ?? null
  const isGreatest75 = profiles.some((profile) => profile?.isGreatest75 === true)

  if (!birthDate && entryDraftYear === null && !isGreatest75) {
    return null
  }

  return {
    birthDate,
    entryDraftYear,
    entryDraftYearSource,
    isGreatest75,
  }
}

function getMissingBioFields(profile: Partial<PlayerBioProfile> | null | undefined): EnrichmentField[] {
  const missingFields: EnrichmentField[] = []

  if (!profile?.birthDate) {
    missingFields.push('birthDate')
  }

  if (profile?.entryDraftYear === null || profile?.entryDraftYear === undefined) {
    missingFields.push('entryDraftYear')
  }

  return missingFields
}

function createEmptyEnrichmentSourceState(): EnrichmentSourceState {
  return {
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureMessage: null,
  }
}

function createEmptyPlayerEnrichmentState(playerId: number): PlayerEnrichmentState {
  return {
    playerId,
    status: 'missing_fields',
    missingFields: ['birthDate', 'entryDraftYear'],
    updatedAt: new Date(0).toISOString(),
    sources: {
      commonPlayerInfo: createEmptyEnrichmentSourceState(),
      basketballReference: createEmptyEnrichmentSourceState(),
    },
  }
}

async function readEnrichmentStatusManifest(cachePath: string): Promise<EnrichmentStatusManifest | null> {
  return readCachedJson<EnrichmentStatusManifest>(cachePath)
}

async function writeEnrichmentStatusManifest(
  cachePath: string,
  manifest: EnrichmentStatusManifest,
): Promise<void> {
  await mkdir(path.dirname(cachePath), { recursive: true })
  await writeFile(cachePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

function getRefreshCooldownMs(source: EnrichmentSourceKey): number {
  return source === 'commonPlayerInfo'
    ? COMMON_PLAYER_INFO_FAILURE_RETRY_MS
    : BASKETBALL_REFERENCE_FAILURE_RETRY_MS
}

function getSourceCacheMaxAgeMs(source: EnrichmentSourceKey): number {
  return source === 'commonPlayerInfo'
    ? COMMON_PLAYER_INFO_CACHE_MAX_AGE_MS
    : BASKETBALL_REFERENCE_CACHE_MAX_AGE_MS
}

function shouldRetryFailedSource(state: EnrichmentSourceState, source: EnrichmentSourceKey): boolean {
  if (!state.lastFailureAt) {
    return true
  }

  const lastFailureAt = Date.parse(state.lastFailureAt)

  if (!Number.isFinite(lastFailureAt)) {
    return true
  }

  return Date.now() - lastFailureAt >= getRefreshCooldownMs(source)
}

function isSourceStale(state: EnrichmentSourceState, source: EnrichmentSourceKey): boolean {
  if (!state.lastSuccessAt) {
    return true
  }

  const lastSuccessAt = Date.parse(state.lastSuccessAt)

  if (!Number.isFinite(lastSuccessAt)) {
    return true
  }

  return Date.now() - lastSuccessAt >= getSourceCacheMaxAgeMs(source)
}

function shouldRefreshFromSource(
  player: PlayerIdentity,
  source: EnrichmentSourceKey,
  statusState: PlayerEnrichmentState,
  missingFields: EnrichmentField[],
  missingOnly = false,
): boolean {
  if (FORCED_PLAYER_IDS.has(player.id)) {
    return true
  }

  if (missingOnly) {
    if (missingFields.length === 0) {
      return false
    }

    const sourceState = statusState.sources[source]

    if (!sourceState.lastAttemptAt) {
      return true
    }

    return shouldRetryFailedSource(sourceState, source)
  }

  if (source === 'basketballReference' && missingFields.length === 0) {
    return false
  }

  if (
    source === 'commonPlayerInfo' &&
    missingFields.length === 0 &&
    player.isCurrentPlayer &&
    isSourceStale(statusState.sources[source], source)
  ) {
    return true
  }

  if (missingFields.length === 0) {
    return false
  }

  const sourceState = statusState.sources[source]

  if (!sourceState.lastAttemptAt) {
    return true
  }

  return isSourceStale(sourceState, source) || shouldRetryFailedSource(sourceState, source)
}

function finalizePlayerEnrichmentState(
  state: PlayerEnrichmentState,
  mergedProfile: PlayerBioProfile | null,
): PlayerEnrichmentState {
  const missingFields = getMissingBioFields(mergedProfile)
  const hasSourceFailure = Object.values(state.sources).some((source) => source.lastFailureAt !== null)
  let status: EnrichmentRecordStatus

  if (missingFields.length === 0) {
    status = 'complete'
  } else if (hasSourceFailure) {
    status = 'failed_last_attempt'
  } else if (missingFields.length === 2) {
    status = 'missing_fields'
  } else {
    status = 'partial'
  }

  return {
    ...state,
    status,
    missingFields,
    updatedAt: new Date().toISOString(),
  }
}

async function fetchBasketballReferenceTextWithThrottle(
  url: string,
  cachePath: string,
): Promise<string | null> {
  const cached = await readCachedText(cachePath)

  if (cached && (await isCacheFresh(cachePath, BASKETBALL_REFERENCE_CACHE_MAX_AGE_MS))) {
    return cached
  }

  return fetchTextWithCache(
    url,
    cachePath,
    BASKETBALL_REFERENCE_HEADERS,
    BASKETBALL_REFERENCE_TIMEOUT_MS,
    4,
    BASKETBALL_REFERENCE_CACHE_MAX_AGE_MS,
  )
}

async function fetchJson<T>(
  url: string,
  headers: Record<string, string> = NBA_HEADERS,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  maxAttempts = DEFAULT_REQUEST_MAX_ATTEMPTS,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await throttleSourceRequest(url)
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`)
      }

      return (await response.json()) as T
    } catch (error) {
      lastError = error
      applyThrottlePenalty(url, error)
      await new Promise((resolve) => setTimeout(resolve, getRetryDelayMs(error, attempt)))
    }
  }

  throw lastError
}

async function fetchText(
  url: string,
  headers: Record<string, string> = NBA_HEADERS,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  maxAttempts = DEFAULT_REQUEST_MAX_ATTEMPTS,
): Promise<string> {
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await throttleSourceRequest(url)
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`)
      }

      return await response.text()
    } catch (error) {
      lastError = error
      applyThrottlePenalty(url, error)
      await new Promise((resolve) => setTimeout(resolve, getRetryDelayMs(error, attempt)))
    }
  }

  throw lastError
}

async function fetchJsonOrNull<T>(
  url: string,
  headers: Record<string, string> = NBA_HEADERS,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  maxAttempts = DEFAULT_REQUEST_MAX_ATTEMPTS,
): Promise<T | null> {
  try {
    return await fetchJson<T>(url, headers, timeoutMs, maxAttempts)
  } catch (error) {
    recordFailedRequest(url, error)
    return null
  }
}

async function fetchTextOrNull(
  url: string,
  headers: Record<string, string> = NBA_HEADERS,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  maxAttempts = DEFAULT_REQUEST_MAX_ATTEMPTS,
): Promise<string | null> {
  try {
    return await fetchText(url, headers, timeoutMs, maxAttempts)
  } catch (error) {
    recordFailedRequest(url, error)
    return null
  }
}

async function readCachedJson<T>(cachePath: string): Promise<T | null> {
  try {
    const rawValue = await readFile(cachePath, 'utf8')
    return JSON.parse(rawValue) as T
  } catch {
    return null
  }
}

async function readCachedText(cachePath: string): Promise<string | null> {
  try {
    return await readFile(cachePath, 'utf8')
  } catch {
    return null
  }
}

async function fetchJsonWithCache<T>(
  url: string,
  cachePath: string,
  headers: Record<string, string> = NBA_HEADERS,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  maxAttempts = DEFAULT_REQUEST_MAX_ATTEMPTS,
  maxCacheAgeMs = Number.POSITIVE_INFINITY,
): Promise<T | null> {
  const cached = await readCachedJson<T>(cachePath)

  if (cached && (await isCacheFresh(cachePath, maxCacheAgeMs))) {
    return cached
  }

  const response = await fetchJsonOrNull<T>(url, headers, timeoutMs, maxAttempts)

  if (response) {
    await mkdir(path.dirname(cachePath), { recursive: true })
    await writeFile(cachePath, `${JSON.stringify(response)}\n`, 'utf8')
  }

  return response ?? cached
}

async function fetchTextWithCache(
  url: string,
  cachePath: string,
  headers: Record<string, string> = NBA_HEADERS,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  maxAttempts = DEFAULT_REQUEST_MAX_ATTEMPTS,
  maxCacheAgeMs = Number.POSITIVE_INFINITY,
): Promise<string | null> {
  const cached = await readCachedText(cachePath)

  if (cached && (await isCacheFresh(cachePath, maxCacheAgeMs))) {
    return cached
  }

  const response = await fetchTextOrNull(url, headers, timeoutMs, maxAttempts)

  if (response) {
    await mkdir(path.dirname(cachePath), { recursive: true })
    await writeFile(cachePath, response, 'utf8')
  }

  return response ?? cached
}

async function fetchJsonWithStaleFallback<T>(
  url: string,
  cachePath: string,
  headers: Record<string, string> = NBA_HEADERS,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  maxAttempts = DEFAULT_REQUEST_MAX_ATTEMPTS,
): Promise<T | null> {
  const cached = await readCachedJson<T>(cachePath)

  try {
    const response = await fetchJson<T>(url, headers, timeoutMs, maxAttempts)
    await mkdir(path.dirname(cachePath), { recursive: true })
    await writeFile(cachePath, `${JSON.stringify(response)}\n`, 'utf8')
    return response
  } catch (error) {
    if (cached) {
      return cached
    }

    recordFailedRequest(url, error)
    return null
  }
}

async function getCacheAgeMs(cachePath: string): Promise<number | null> {
  try {
    const metadata = await stat(cachePath)
    return Date.now() - metadata.mtimeMs
  } catch {
    return null
  }
}

async function isCacheFresh(cachePath: string, maxCacheAgeMs: number): Promise<boolean> {
  if (!Number.isFinite(maxCacheAgeMs)) {
    return true
  }

  const ageMs = await getCacheAgeMs(cachePath)
  return ageMs !== null && ageMs <= maxCacheAgeMs
}

function extractBasketballReferencePlayerPath(
  html: string,
  player: PlayerIdentity,
): string | null {
  const canonicalMatch = html.match(
    /<link rel="canonical" href="https:\/\/www\.basketball-reference\.com(\/players\/[a-z]\/[^"]+\.html)"/i,
  )

  if (canonicalMatch) {
    return canonicalMatch[1]
  }

  const targetNames = new Set(
    [
      player.displayName,
      `${player.firstName} ${player.lastName}`.trim(),
      `${player.firstName.replace(/\./g, '')} ${player.lastName}`.trim(),
    ].map(normalizeExternalPlayerName),
  )
  const playerPathPattern = /<a[^>]+href="(\/players\/[a-z]\/[^"]+\.html)"[^>]*>([^<]+)<\/a>/gi
  const candidates = new Map<string, string>()

  while (true) {
    const match = playerPathPattern.exec(html)

    if (!match) {
      break
    }

    candidates.set(match[1], match[2].replace(/&nbsp;/gi, ' ').trim())
  }

  if (candidates.size === 0) {
    return null
  }

  for (const [candidatePath, candidateName] of candidates.entries()) {
    if (targetNames.has(normalizeExternalPlayerName(candidateName))) {
      return candidatePath
    }
  }

  return candidates.size === 1 ? [...candidates.keys()][0] : null
}

function extractBasketballReferenceBirthDate(html: string): string | null {
  const patterns = [
    /itemprop="birthDate"[^>]*(?:datetime|data-birth|csk)="(\d{4}-\d{2}-\d{2})"/i,
    /data-birth="(\d{4}-\d{2}-\d{2})"/i,
    /csk="(\d{4}-\d{2}-\d{2})"[^>]*itemprop="birthDate"/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)

    if (match) {
      return normalizeBirthDateValue(match[1])
    }
  }

  return null
}

function extractBasketballReferenceEntryDraftYear(html: string): {
  year: number | null
  source: PlayerRecord['entryDraftYearSource']
} {
  const draftBlockMatch = html.match(/<strong>\s*Draft:\s*<\/strong>([\s\S]*?)<\/p>/i)

  if (draftBlockMatch) {
    const explicitDraftYearMatch = draftBlockMatch[1].match(/\/draft\/NBA_(\d{4})\.html/i)

    if (explicitDraftYearMatch) {
      return {
        year: Number(explicitDraftYearMatch[1]),
        source: 'draft',
      }
    }
  }

  const debutMatch = html.match(/<strong>\s*NBA Debut:\s*<\/strong>[\s\S]*?(\d{4})/i)

  if (debutMatch) {
    return {
      year: Number(debutMatch[1]),
      source: 'debut-fallback',
    }
  }

  return {
    year: null,
    source: null,
  }
}

async function fetchCommonPlayerProfile(
  playerId: number,
  cacheDirectory: string,
): Promise<PlayerBioProfile | null> {
  const response = await fetchJsonWithCache<ResultSetResponse>(
    COMMON_PLAYER_INFO_SOURCE.replace('{playerId}', `${playerId}`),
    path.join(cacheDirectory, 'common-player-info', `${playerId}.json`),
    NBA_HEADERS,
    COMMON_PLAYER_INFO_TIMEOUT_MS,
    4,
    COMMON_PLAYER_INFO_CACHE_MAX_AGE_MS,
  )

  if (!response) {
    return null
  }

  const row = mapRows(response, 'CommonPlayerInfo')[0]

  const draftYearRaw = cleanText(row?.DRAFT_YEAR)
  const parsedDraftYear = draftYearRaw ? Number(draftYearRaw) : null

  return row
    ? {
        birthDate: normalizeBirthDateValue(cleanText(row.BIRTHDATE)),
        isGreatest75: cleanText(row.GREATEST_75_FLAG) === 'Y',
        entryDraftYear: Number.isFinite(parsedDraftYear) ? parsedDraftYear : null,
        entryDraftYearSource: Number.isFinite(parsedDraftYear) ? 'draft' : null,
      }
    : null
}

async function fetchBasketballReferenceProfile(
  player: PlayerIdentity,
  cacheDirectory: string,
): Promise<Pick<PlayerBioProfile, 'birthDate' | 'entryDraftYear' | 'entryDraftYearSource'> | null> {
  const searchUrl = BASKETBALL_REFERENCE_SEARCH_SOURCE.replace(
    '{query}',
    encodeURIComponent(player.displayName),
  )
  const searchHtml = await fetchBasketballReferenceTextWithThrottle(
    searchUrl,
    path.join(cacheDirectory, 'basketball-reference-search', `${player.id}.html`),
  )

  if (!searchHtml) {
    return null
  }

  const playerPath = extractBasketballReferencePlayerPath(searchHtml, player)

  if (!playerPath) {
    return null
  }

  const playerHtml = await fetchBasketballReferenceTextWithThrottle(
    `${BASKETBALL_REFERENCE_BASE_URL}${playerPath}`,
    path.join(cacheDirectory, 'basketball-reference-player', `${player.id}.html`),
  )

  if (!playerHtml) {
    return null
  }

  const entryDraftYear = extractBasketballReferenceEntryDraftYear(playerHtml)

  return {
    birthDate: extractBasketballReferenceBirthDate(playerHtml),
    entryDraftYear: entryDraftYear.year,
    entryDraftYearSource: entryDraftYear.source,
  }
}

function buildExistingPlayerBioMap(
  currentPool: PlayerPoolData | null,
  historyPool: PlayerPoolData | null,
): Map<number, PlayerBioProfile> {
  const profiles = new Map<number, PlayerBioProfile>()

  for (const pool of [currentPool, historyPool]) {
    if (!pool) {
      continue
    }

    for (const player of pool.players) {
      const profile = mergePlayerBioProfiles({
        birthDate: normalizeBirthDateValue(player.birthDate),
        isGreatest75: player.career.isGreatest75,
        entryDraftYear: player.entryDraftYear ?? player.draft.year ?? player.career.debutYear ?? null,
        entryDraftYearSource:
          player.entryDraftYearSource ??
          (player.draft.year !== null
            ? 'draft'
            : player.career.debutYear !== null
              ? 'debut-fallback'
              : null),
      })

      if (profile) {
        profiles.set(player.id, profile)
      }
    }
  }

  return profiles
}

async function buildPlayerBioMap(
  players: PlayerIdentity[],
  cacheDirectory: string,
  existingPlayerBioMap: Map<number, PlayerBioProfile>,
  existingStatusManifest: EnrichmentStatusManifest | null,
  progressLabel = 'Bio enrichment',
  options: BioRefreshOptions = {},
): Promise<{ playerBioMap: Map<number, PlayerBioProfile>; statusManifest: EnrichmentStatusManifest }> {
  const identities = [...new Map(players.map((player) => [player.id, player])).values()]
  const currentPlayers = identities.filter((player) => player.isCurrentPlayer)
  const historicalPlayers = identities.filter((player) => !player.isCurrentPlayer)
  const progress = createProgressTracker(progressLabel, identities.length, {
    initialMsPerItem: 900,
  })
  const statusManifest: EnrichmentStatusManifest = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    players: { ...(existingStatusManifest?.players ?? {}) },
  }

  const buildProfile = async (
    player: PlayerIdentity,
  ): Promise<readonly [number, PlayerBioProfile] | null> => {
    try {
      const existingProfile = existingPlayerBioMap.get(player.id) ?? null
      const existingStatus =
        statusManifest.players[`${player.id}`] ?? createEmptyPlayerEnrichmentState(player.id)
      const initialMissingFields = getMissingBioFields(existingProfile)
      let commonPlayerProfile: PlayerBioProfile | null = null
      let basketballReferenceProfile:
        | Pick<PlayerBioProfile, 'birthDate' | 'entryDraftYear' | 'entryDraftYearSource'>
        | null = null

      if (
        shouldRefreshFromSource(
          player,
          'commonPlayerInfo',
          existingStatus,
          initialMissingFields,
          options.missingOnly,
        )
      ) {
        existingStatus.sources.commonPlayerInfo.lastAttemptAt = new Date().toISOString()
        commonPlayerProfile = await fetchCommonPlayerProfile(player.id, cacheDirectory)

        if (commonPlayerProfile) {
          existingStatus.sources.commonPlayerInfo.lastSuccessAt = new Date().toISOString()
          existingStatus.sources.commonPlayerInfo.lastFailureAt = null
          existingStatus.sources.commonPlayerInfo.lastFailureMessage = null
        } else {
          existingStatus.sources.commonPlayerInfo.lastFailureAt = new Date().toISOString()
          existingStatus.sources.commonPlayerInfo.lastFailureMessage = 'No data returned'
        }
      }

      const mergedBeforeBasketballReference = mergePlayerBioProfiles(commonPlayerProfile, existingProfile)
      const missingAfterCommon = getMissingBioFields(mergedBeforeBasketballReference)

      if (
        shouldRefreshFromSource(
          player,
          'basketballReference',
          existingStatus,
          missingAfterCommon,
          options.missingOnly,
        )
      ) {
        existingStatus.sources.basketballReference.lastAttemptAt = new Date().toISOString()
        basketballReferenceProfile = await fetchBasketballReferenceProfile(player, cacheDirectory)

        if (basketballReferenceProfile) {
          existingStatus.sources.basketballReference.lastSuccessAt = new Date().toISOString()
          existingStatus.sources.basketballReference.lastFailureAt = null
          existingStatus.sources.basketballReference.lastFailureMessage = null
        } else {
          existingStatus.sources.basketballReference.lastFailureAt = new Date().toISOString()
          existingStatus.sources.basketballReference.lastFailureMessage = 'No data returned'
        }
      }

      const mergedProfile = mergePlayerBioProfiles(
        commonPlayerProfile,
        existingProfile,
        basketballReferenceProfile,
      )
      statusManifest.players[`${player.id}`] = finalizePlayerEnrichmentState(existingStatus, mergedProfile)

      return mergedProfile ? ([player.id, mergedProfile] as const) : null
    } finally {
      progress.tick()
    }
  }

  const currentResults = await mapWithConcurrency(
    currentPlayers,
    CURRENT_BIO_CONCURRENCY,
    buildProfile,
  )
  const historicalResults = await mapWithConcurrency(
    historicalPlayers,
    HISTORICAL_BIO_CONCURRENCY,
    buildProfile,
  )

  statusManifest.updatedAt = new Date().toISOString()
  progress.finish()

  return {
    playerBioMap: new Map([...currentResults, ...historicalResults].filter(isPresent)),
    statusManifest,
  }
}

function mapRows(
  response: ResultSetResponse,
  resultSetName?: string,
): Array<Record<string, ResultValue>> {
  const resultSet = resultSetName
    ? response.resultSets.find((set) => set.name === resultSetName)
    : response.resultSets[0]

  if (!resultSet) {
    return []
  }

  return resultSet.rowSet.map((row) =>
    Object.fromEntries(resultSet.headers.map((header, index) => [header, row[index]])),
  )
}

function buildAgeMap(rows: Array<Record<string, ResultValue>>): Map<number, number> {
  return new Map(
    rows
      .map((row) => {
        const playerId = parseIntegerValue(row.PLAYER_ID)
        const age = parseNumberValue(row.AGE)
        return playerId === null || age === null ? null : ([playerId, age] as const)
      })
      .filter(isPresent),
  )
}

function buildStatMap(
  rows: Array<Record<string, ResultValue>>,
): Map<number, Record<string, ResultValue>> {
  return new Map(
    rows
      .map((row) => {
        const playerId = parseIntegerValue(row.PLAYER_ID)
        return playerId === null ? null : ([playerId, row] as const)
      })
      .filter(isPresent),
  )
}

function buildStandingMap(rows: Array<Record<string, ResultValue>>): Map<number, StandingSnapshot> {
  return new Map(
    rows
      .map((row) => {
        const teamId = parseIntegerValue(row.TeamID)
        const playoffRank = parseIntegerValue(row.PlayoffRank)

        return teamId === null
          ? null
          : ([
              teamId,
              {
                playoffRank,
                playoffPicture: playoffRank === null ? null : playoffRank <= 10,
              },
            ] as const)
      })
      .filter(isPresent),
  )
}

function buildBaseSnapshot(
  row: Record<string, ResultValue>,
  standingSnapshot: StandingSnapshot | undefined,
): SeasonSnapshot {
  return {
    pointsPerGame: parseNumberValue(row.PTS),
    reboundsPerGame: parseNumberValue(row.REB),
    assistsPerGame: parseNumberValue(row.AST),
    minutesPerGame: parseNumberValue(row.MIN),
    playoffPicture: standingSnapshot?.playoffPicture ?? null,
    playoffRank: standingSnapshot?.playoffRank ?? null,
    careerAccoladeLabel: null,
  }
}

function buildHistoricalSnapshot(row: Record<string, ResultValue>): SeasonSnapshot {
  return {
    pointsPerGame: parseNumberValue(row.PTS),
    reboundsPerGame: parseNumberValue(row.REB),
    assistsPerGame: parseNumberValue(row.AST),
    minutesPerGame: null,
    playoffPicture: null,
    playoffRank: null,
    careerAccoladeLabel: null,
  }
}

function getSeasonSpan(
  debutYear: number | null,
  finalSeasonYear: number | null,
): number | null {
  if (debutYear === null || finalSeasonYear === null || finalSeasonYear < debutYear) {
    return null
  }

  return finalSeasonYear - debutYear + 1
}

function buildDraftStub(row: Record<string, ResultValue>): DraftDetails {
  const draftYear = parseIntegerValue(row.DRAFT_YEAR)
  const draftRound = parseIntegerValue(row.DRAFT_ROUND)
  const draftPick = parseIntegerValue(row.DRAFT_NUMBER)

  return {
    year: draftYear,
    round: draftRound,
    pick: draftPick,
    teamId: null,
    teamAbbreviation: null,
    teamName: null,
    isUndrafted: draftYear === null || draftRound === null || draftPick === null,
  }
}

function buildThemeFlags(
  player: PlayerRecord,
  seasonStartYear: number,
  isCurrentAllStar: boolean,
): ThemeFlags {
  const normalizedCountry = player.country?.trim().toLowerCase()
  const isInternational = Boolean(
    normalizedCountry &&
      normalizedCountry !== 'usa' &&
      normalizedCountry !== 'u.s.a.' &&
      normalizedCountry !== 'united states' &&
      normalizedCountry !== 'united states of america',
  )

  return {
    isRookie: player.career.debutYear === seasonStartYear,
    isInternational,
    isAllStar: isCurrentAllStar,
    isUnder25: player.currentAge !== null && player.currentAge < 25,
  }
}

function normalizeFilenamePart(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/\./g, '')
    .replace(/&/g, 'and')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function build2KRatingsFallbackCandidates(player: PlayerRecord): string[] {
  const candidates = new Set<string>()
  const baseNames = [
    player.displayName,
    `${player.firstName} ${player.lastName}`.trim(),
    `${player.firstName} ${player.lastName.replace(/\b(Jr|Sr)\b/gi, '').trim()}`.trim(),
  ]

  for (const baseName of baseNames) {
    const normalizedName = normalizeFilenamePart(baseName)

    if (normalizedName) {
      candidates.add(`${TWO_K_RATINGS_IMAGE_BASE}/${normalizedName}-2K-Rating.png`)
    }
  }

  return [...candidates]
}

async function headExists(url: string, timeoutMs = 2500): Promise<boolean> {
  try {
    await throttleSourceRequest(url)
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    })

    return response.ok
  } catch (error) {
    applyThrottlePenalty(url, error)
    return false
  }
}

interface AwardCounts {
  championships: number
  allStarAppearances: number
  finalsMvp: number
  mvp: number
  rookieOfTheYear: number
  defensivePlayer: number
  sixthMan: number
  mostImproved: number
  allNba: number
  allDefense: number
  allRookie: number
  scoringTitles: number
  reboundTitles: number
  assistTitles: number
  hallOfFame: boolean
}

function createEmptyAwardCounts(): AwardCounts {
  return {
    championships: 0,
    allStarAppearances: 0,
    finalsMvp: 0,
    mvp: 0,
    rookieOfTheYear: 0,
    defensivePlayer: 0,
    sixthMan: 0,
    mostImproved: 0,
    allNba: 0,
    allDefense: 0,
    allRookie: 0,
    scoringTitles: 0,
    reboundTitles: 0,
    assistTitles: 0,
    hallOfFame: false,
  }
}

function incrementAwardCounts(
  counts: AwardCounts,
  description: string,
): AwardCounts {
  const normalized = description.toLowerCase()

  if (normalized.includes('nba champion')) {
    counts.championships += 1
  } else if (normalized.includes('hall of fame')) {
    counts.hallOfFame = true
  } else if (normalized.includes('all-star')) {
    counts.allStarAppearances += 1
  } else if (normalized.includes('finals most valuable player')) {
    counts.finalsMvp += 1
  } else if (normalized.includes('most valuable player')) {
    counts.mvp += 1
  } else if (normalized.includes('rookie of the year')) {
    counts.rookieOfTheYear += 1
  } else if (normalized.includes('defensive player of the year')) {
    counts.defensivePlayer += 1
  } else if (normalized.includes('sixth man')) {
    counts.sixthMan += 1
  } else if (normalized.includes('most improved player')) {
    counts.mostImproved += 1
  } else if (normalized.includes('all-nba')) {
    counts.allNba += 1
  } else if (normalized.includes('all-defensive')) {
    counts.allDefense += 1
  } else if (normalized.includes('all-rookie')) {
    counts.allRookie += 1
  } else if (normalized.includes('scoring champion') || normalized.includes('scoring title')) {
    counts.scoringTitles += 1
  } else if (
    normalized.includes('rebounding champion') ||
    normalized.includes('rebounding title')
  ) {
    counts.reboundTitles += 1
  } else if (normalized.includes('assist leader') || normalized.includes('assists leader')) {
    counts.assistTitles += 1
  }

  return counts
}

function formatCountedAccolade(label: string, count: number): string | null {
  if (count <= 0) {
    return null
  }

  return count === 1 ? label : `${label} x${count}`
}

function buildCareerAccolades(
  awardRows: Array<Record<string, ResultValue>>,
  draft: DraftDetails,
  isGreatest75: boolean,
): {
  labels: string[]
  championships: number
  allStarAppearances: number
  allNbaSelections: number
  allDefensiveSelections: number
  finalsMvpAwards: number
  mvpAwards: number
  rookieOfTheYearAwards: number
  defensivePlayerOfTheYearAwards: number
  scoringTitles: number
  reboundTitles: number
  assistTitles: number
  isHallOfFame: boolean
  isGreatest75: boolean
  primary: string | null
} {
  const counts = awardRows.reduce((result, row) => {
    const description = cleanText(row.DESCRIPTION)
    return description ? incrementAwardCounts(result, description) : result
  }, createEmptyAwardCounts())

  const labels = [
    counts.hallOfFame ? 'Hall of Fame' : null,
    isGreatest75 ? 'NBA 75 Team' : null,
    formatCountedAccolade('NBA Champion', counts.championships),
    formatCountedAccolade('NBA Finals MVP', counts.finalsMvp),
    formatCountedAccolade('NBA MVP', counts.mvp),
    formatCountedAccolade('NBA Defensive Player of the Year', counts.defensivePlayer),
    formatCountedAccolade('NBA Rookie of the Year', counts.rookieOfTheYear),
    formatCountedAccolade('NBA Sixth Man of the Year', counts.sixthMan),
    formatCountedAccolade('NBA Most Improved Player', counts.mostImproved),
    formatCountedAccolade('All-NBA', counts.allNba),
    formatCountedAccolade('All-Defensive Team', counts.allDefense),
    formatCountedAccolade('All-Star', counts.allStarAppearances),
    formatCountedAccolade('All-Rookie Team', counts.allRookie),
    formatCountedAccolade('Scoring Champion', counts.scoringTitles),
    formatCountedAccolade('Rebounding Champion', counts.reboundTitles),
    formatCountedAccolade('Assist Leader', counts.assistTitles),
    draft.pick === 1
      ? 'Former No. 1 overall pick'
      : draft.pick !== null && draft.pick <= 5
        ? 'Former top-five pick'
        : draft.pick !== null && draft.pick <= 14
          ? 'Former lottery pick'
          : draft.isUndrafted
            ? 'Undrafted'
            : null,
  ].filter(isPresent)

  return {
    labels,
    championships: counts.championships,
    allStarAppearances: counts.allStarAppearances,
    allNbaSelections: counts.allNba,
    allDefensiveSelections: counts.allDefense,
    finalsMvpAwards: counts.finalsMvp,
    mvpAwards: counts.mvp,
    rookieOfTheYearAwards: counts.rookieOfTheYear,
    defensivePlayerOfTheYearAwards: counts.defensivePlayer,
    scoringTitles: counts.scoringTitles,
    reboundTitles: counts.reboundTitles,
    assistTitles: counts.assistTitles,
    isHallOfFame: counts.hallOfFame,
    isGreatest75,
    primary: labels[0] ?? null,
  }
}

function hasRichMetadata(player: PlayerRecord): boolean {
  return Boolean(
    player.country &&
      player.career.debutYear !== null &&
      player.heightInInches !== null &&
      player.jerseyNumber !== null &&
      player.teamAbbreviation &&
      (player.draft.year !== null || player.draft.isUndrafted),
  )
}

function buildTeamContext(row: Record<string, ResultValue>): {
  teamId: number
  teamAbbreviation: string
  teamName: string
  conference: PlayerRecord['conference']
  division: PlayerRecord['division']
  isDefunctFranchise: boolean
} | null {
  const teamId = parseIntegerValue(row.TEAM_ID)

  if (teamId === null || teamId === 0) {
    return null
  }

  const mappedTeam = TEAM_BY_ID.get(teamId)
  const teamAbbreviation = cleanText(row.TEAM_ABBREVIATION) ?? mappedTeam?.abbreviation ?? 'LEG'
  const teamName = cleanText(row.TEAM_NAME)
  const teamCity = cleanText(row.TEAM_CITY)

  if (mappedTeam) {
    return {
      teamId: mappedTeam.id,
      teamAbbreviation: mappedTeam.abbreviation,
      teamName: `${mappedTeam.city} ${mappedTeam.name}`,
      conference: mappedTeam.conference,
      division: mappedTeam.division,
      isDefunctFranchise: parseIntegerValue(row.IS_DEFUNCT) === 1,
    }
  }

  return {
    teamId,
    teamAbbreviation,
    teamName: teamCity && teamName ? `${teamCity} ${teamName}` : teamAbbreviation,
    conference: 'Legacy',
    division: 'Legacy',
    isDefunctFranchise: true,
  }
}

function applyBirthDateData(
  player: PlayerRecord,
  playerBioMap: Map<number, PlayerBioProfile>,
  referenceDate: string,
  seasonStartYear: number,
): PlayerRecord {
  const playerBio = playerBioMap.get(player.id)
  const birthDate = playerBio?.birthDate ?? normalizeBirthDateValue(player.birthDate)
  const entryDraftYear =
    player.entryDraftYear ??
    player.draft.year ??
    playerBio?.entryDraftYear ??
    player.career.debutYear ??
    null
  const entryDraftYearSource =
    player.entryDraftYearSource ??
    (player.draft.year !== null ? 'draft' : null) ??
    playerBio?.entryDraftYearSource ??
    (entryDraftYear !== null ? 'debut-fallback' : null)
  const nextPlayer: PlayerRecord = {
    ...player,
    birthDate,
    currentAge: normalizePlayerAge(birthDate, player.currentAge, referenceDate),
    entryDraftYear,
    entryDraftYearSource,
    career: {
      ...player.career,
      isGreatest75: playerBio?.isGreatest75 ?? player.career.isGreatest75,
    },
  }

  nextPlayer.flags = buildThemeFlags(nextPlayer, seasonStartYear, nextPlayer.flags.isAllStar)
  return nextPlayer
}

function normalizePlayer(
  row: Record<string, ResultValue>,
  ageMap: Map<number, number>,
  statsMap: Map<number, Record<string, ResultValue>>,
  standingMap: Map<number, StandingSnapshot>,
  seasonStartYear: number,
): PlayerRecord | null {
  const rosterStatus = parseIntegerValue(row.ROSTER_STATUS)

  if (rosterStatus !== 1) {
    return null
  }

  const team = buildTeamContext(row)
  const playerId = parseIntegerValue(row.PERSON_ID)

  if (!team || playerId === null) {
    return null
  }

  const displayName = `${String(row.PLAYER_FIRST_NAME ?? '').trim()} ${String(
    row.PLAYER_LAST_NAME ?? '',
  ).trim()}`.trim()
  const { firstName, lastName } = splitPlayerName(displayName)
  const position = canonicalizePosition(String(row.POSITION ?? ''))
  const heightInInches = parseHeightToInches(
    typeof row.HEIGHT === 'string' ? row.HEIGHT : null,
  )
  const college = cleanText(row.COLLEGE)
  const country = cleanText(row.COUNTRY)
  const debutYear = parseIntegerValue(row.FROM_YEAR)
  const finalSeasonYear = parseIntegerValue(row.TO_YEAR)
  const statRow = statsMap.get(playerId) ?? row
  const player: PlayerRecord = {
    id: playerId,
    slug: String(row.PLAYER_SLUG ?? '').trim(),
    displayName,
    firstName,
    lastName,
    isCurrentPlayer: true,
    isDefunctFranchise: team.isDefunctFranchise,
    teamId: team.teamId,
    teamAbbreviation: team.teamAbbreviation,
    teamName: team.teamName,
    conference: team.conference,
    division: team.division,
    position,
    positionTokens: positionTokensFromLabel(position),
    heightInInches,
    heightCm: inchesToCentimeters(heightInInches),
    currentAge: ageMap.get(playerId) ?? null,
    birthDate: null,
    jerseyNumber: parseIntegerValue(row.JERSEY_NUMBER),
    headshotUrl: createHeadshotUrl(playerId),
    country,
    college,
    draft: buildDraftStub(row),
    entryDraftYear: parseIntegerValue(row.DRAFT_YEAR),
    entryDraftYearSource: parseIntegerValue(row.DRAFT_YEAR) === null ? null : 'draft',
    career: {
      debutYear,
      finalSeasonYear,
      seasonsPlayed: getSeasonSpan(debutYear, finalSeasonYear),
      preNbaPath: college,
      careerTeamIds: [team.teamId],
      careerTeamAbbreviations: [team.teamAbbreviation],
      careerTeamNames: [team.teamName],
      previousTeamIds: [],
      previousTeamAbbreviations: [],
      previousTeamNames: [],
      allStarAppearances: 0,
      allNbaSelections: 0,
      allDefensiveSelections: 0,
      championships: 0,
      finalsMvpAwards: 0,
      mvpAwards: 0,
      rookieOfTheYearAwards: 0,
      defensivePlayerOfTheYearAwards: 0,
      scoringTitles: 0,
      reboundTitles: 0,
      assistTitles: 0,
      isHallOfFame: false,
      isGreatest75: false,
      accolades: [],
      primaryAccolade: null,
      hasRichMetadata: false,
    },
    snapshot: buildBaseSnapshot(statRow, standingMap.get(team.teamId)),
    flags: {
      isRookie: debutYear === seasonStartYear,
      isInternational: false,
      isAllStar: false,
      isUnder25: false,
    },
    searchText: buildSearchText([
      displayName,
      team.teamAbbreviation,
      team.teamName,
      position,
      country,
    ]),
  }

  player.flags = buildThemeFlags(player, seasonStartYear, false)
  return player
}

function normalizeHistoricalPlayer(
  row: Record<string, ResultValue>,
  seasonStartYear: number,
): PlayerRecord | null {
  const team = buildTeamContext(row)
  const playerId = parseIntegerValue(row.PERSON_ID)

  if (!team || playerId === null) {
    return null
  }

  const displayName = `${String(row.PLAYER_FIRST_NAME ?? '').trim()} ${String(
    row.PLAYER_LAST_NAME ?? '',
  ).trim()}`.trim()
  const { firstName, lastName } = splitPlayerName(displayName)
  const position = canonicalizePosition(
    String(row.POSITION ?? ''),
  )
  const heightInInches = parseHeightToInches(
    typeof row.HEIGHT === 'string' ? row.HEIGHT : null,
  )
  const college = cleanText(row.COLLEGE)
  const country = cleanText(row.COUNTRY)
  const debutYear = parseIntegerValue(row.FROM_YEAR)
  const finalSeasonYear = parseIntegerValue(row.TO_YEAR)

  return {
    id: playerId,
    slug: String(row.PLAYER_SLUG ?? '').trim(),
    displayName,
    firstName,
    lastName,
    isCurrentPlayer: false,
    isDefunctFranchise: team.isDefunctFranchise,
    teamId: team.teamId,
    teamAbbreviation: team.teamAbbreviation,
    teamName: team.teamName,
    conference: team.conference,
    division: team.division,
    position,
    positionTokens: positionTokensFromLabel(position),
    heightInInches,
    heightCm: inchesToCentimeters(heightInInches),
    currentAge: null,
    birthDate: null,
    jerseyNumber: parseIntegerValue(row.JERSEY_NUMBER),
    headshotUrl: createHeadshotUrl(playerId),
    country,
    college,
    draft: buildDraftStub(row),
    entryDraftYear: parseIntegerValue(row.DRAFT_YEAR),
    entryDraftYearSource: parseIntegerValue(row.DRAFT_YEAR) === null ? null : 'draft',
    career: {
      debutYear,
      finalSeasonYear,
      seasonsPlayed: getSeasonSpan(debutYear, finalSeasonYear),
      preNbaPath: college,
      careerTeamIds: [team.teamId],
      careerTeamAbbreviations: [team.teamAbbreviation],
      careerTeamNames: [team.teamName],
      previousTeamIds: [],
      previousTeamAbbreviations: [],
      previousTeamNames: [],
      allStarAppearances: 0,
      allNbaSelections: 0,
      allDefensiveSelections: 0,
      championships: 0,
      finalsMvpAwards: 0,
      mvpAwards: 0,
      rookieOfTheYearAwards: 0,
      defensivePlayerOfTheYearAwards: 0,
      scoringTitles: 0,
      reboundTitles: 0,
      assistTitles: 0,
      isHallOfFame: false,
      isGreatest75: false,
      accolades: [],
      primaryAccolade: null,
      hasRichMetadata: false,
    },
    snapshot: buildHistoricalSnapshot(row),
    flags: {
      isRookie: debutYear === seasonStartYear,
      isInternational: false,
      isAllStar: false,
      isUnder25: false,
    },
    searchText: buildSearchText([
      displayName,
      team.teamAbbreviation,
      team.teamName,
      position,
      country,
    ]),
  }
}

function extractAllStarPlayerIds(html: string): Set<number> {
  const playerIds = new Set<number>()
  const pattern = /data-content-id="(\d+)"/g

  while (true) {
    const match = pattern.exec(html)

    if (!match) {
      return playerIds
    }

    playerIds.add(Number(match[1]))
  }
}

function applyExtendedData(
  player: PlayerRecord,
  draftRow: Record<string, ResultValue> | undefined,
  awardRows: Array<Record<string, ResultValue>>,
  careerTeamIds: number[],
  currentAllStarIds: Set<number>,
  seasonStartYear: number,
): PlayerRecord {
  const draft: DraftDetails = draftRow
    ? {
        ...player.draft,
        year: parseIntegerValue(draftRow.SEASON) ?? player.draft.year,
        round: parseIntegerValue(draftRow.ROUND_NUMBER) ?? player.draft.round,
        pick: parseIntegerValue(draftRow.OVERALL_PICK) ?? player.draft.pick,
        teamId: parseIntegerValue(draftRow.TEAM_ID),
        teamAbbreviation: cleanText(draftRow.TEAM_ABBREVIATION),
        teamName:
          cleanText(draftRow.TEAM_CITY) && cleanText(draftRow.TEAM_NAME)
            ? `${cleanText(draftRow.TEAM_CITY)} ${cleanText(draftRow.TEAM_NAME)}`
            : null,
        isUndrafted: false,
      }
    : player.draft
  const uniqueCareerTeamIds = [...new Set(careerTeamIds.length > 0 ? careerTeamIds : [player.teamId])]
  const careerTeams = uniqueCareerTeamIds
    .map((teamId) => TEAM_BY_ID.get(teamId))
    .filter(isPresent)
  const previousTeamIds = uniqueCareerTeamIds.filter((teamId) => teamId !== player.teamId)
  const previousTeams = previousTeamIds
    .map((teamId) => TEAM_BY_ID.get(teamId))
    .filter(isPresent)
  const isCurrentAllStar = currentAllStarIds.has(player.id)
  const careerAccolades = buildCareerAccolades(awardRows, draft, player.career.isGreatest75)
  const enrichedPlayer: PlayerRecord = {
    ...player,
    draft,
    entryDraftYear: draft.year ?? player.entryDraftYear ?? player.career.debutYear ?? null,
    entryDraftYearSource:
      draft.year !== null
        ? 'draft'
        : player.entryDraftYearSource ?? (player.career.debutYear !== null ? 'debut-fallback' : null),
    career: {
      ...player.career,
      careerTeamIds: uniqueCareerTeamIds,
      careerTeamAbbreviations:
        careerTeams.length > 0 ? careerTeams.map((team) => team.abbreviation) : [player.teamAbbreviation],
      careerTeamNames:
        careerTeams.length > 0 ? careerTeams.map((team) => `${team.city} ${team.name}`) : [player.teamName],
      previousTeamIds,
      previousTeamAbbreviations: previousTeams.map((team) => team.abbreviation),
      previousTeamNames: previousTeams.map((team) => `${team.city} ${team.name}`),
      allStarAppearances: Math.max(careerAccolades.allStarAppearances, isCurrentAllStar ? 1 : 0),
      allNbaSelections: careerAccolades.allNbaSelections,
      allDefensiveSelections: careerAccolades.allDefensiveSelections,
      championships: careerAccolades.championships,
      finalsMvpAwards: careerAccolades.finalsMvpAwards,
      mvpAwards: careerAccolades.mvpAwards,
      rookieOfTheYearAwards: careerAccolades.rookieOfTheYearAwards,
      defensivePlayerOfTheYearAwards: careerAccolades.defensivePlayerOfTheYearAwards,
      scoringTitles: careerAccolades.scoringTitles,
      reboundTitles: careerAccolades.reboundTitles,
      assistTitles: careerAccolades.assistTitles,
      isHallOfFame: careerAccolades.isHallOfFame,
      isGreatest75: careerAccolades.isGreatest75,
      accolades: careerAccolades.labels,
      primaryAccolade: careerAccolades.primary,
      hasRichMetadata: false,
    },
    snapshot: {
      ...player.snapshot,
      careerAccoladeLabel: careerAccolades.primary,
    },
  }

  enrichedPlayer.flags = buildThemeFlags(enrichedPlayer, seasonStartYear, isCurrentAllStar)
  enrichedPlayer.career.hasRichMetadata = hasRichMetadata(enrichedPlayer)
  return enrichedPlayer
}

function coerceExistingPlayerRecord(
  player: PlayerRecord,
  seasonStartYear: number,
): PlayerRecord {
  const legacySnapshot = player.snapshot as SeasonSnapshot & { accoladeLabel?: string | null }
  const primaryAccolade =
    player.career.primaryAccolade ?? legacySnapshot.careerAccoladeLabel ?? legacySnapshot.accoladeLabel ?? null
  const coercedPlayer: PlayerRecord = {
    ...player,
    isCurrentPlayer: player.isCurrentPlayer ?? true,
    isDefunctFranchise: player.isDefunctFranchise ?? false,
    entryDraftYear: player.entryDraftYear ?? player.draft.year ?? player.career.debutYear ?? null,
    entryDraftYearSource:
      player.entryDraftYearSource ??
      (player.draft.year !== null
        ? 'draft'
        : player.career.debutYear !== null
          ? 'debut-fallback'
          : null),
    career: {
      ...player.career,
      finalSeasonYear: player.career.finalSeasonYear ?? player.career.debutYear ?? null,
      seasonsPlayed:
        player.career.seasonsPlayed ??
        getSeasonSpan(
          player.career.debutYear,
          player.career.finalSeasonYear ?? player.career.debutYear ?? null,
        ),
      allStarAppearances: player.career.allStarAppearances ?? 0,
      allNbaSelections: player.career.allNbaSelections ?? 0,
      allDefensiveSelections: player.career.allDefensiveSelections ?? 0,
      championships: player.career.championships ?? 0,
      finalsMvpAwards: player.career.finalsMvpAwards ?? 0,
      mvpAwards: player.career.mvpAwards ?? 0,
      rookieOfTheYearAwards: player.career.rookieOfTheYearAwards ?? 0,
      defensivePlayerOfTheYearAwards: player.career.defensivePlayerOfTheYearAwards ?? 0,
      scoringTitles: player.career.scoringTitles ?? 0,
      reboundTitles: player.career.reboundTitles ?? 0,
      assistTitles: player.career.assistTitles ?? 0,
      isHallOfFame: player.career.isHallOfFame ?? false,
      isGreatest75: player.career.isGreatest75 ?? false,
      accolades: player.career.accolades ?? (primaryAccolade ? [primaryAccolade] : []),
      primaryAccolade,
      hasRichMetadata: false,
    },
    snapshot: {
      ...legacySnapshot,
      minutesPerGame: legacySnapshot.minutesPerGame ?? null,
      careerAccoladeLabel: primaryAccolade,
    },
  }

  coercedPlayer.flags = buildThemeFlags(coercedPlayer, seasonStartYear, coercedPlayer.flags.isAllStar)
  coercedPlayer.career.hasRichMetadata = hasRichMetadata(coercedPlayer)
  return coercedPlayer
}

function applyAwardDataToExistingPlayer(
  player: PlayerRecord,
  awardRows: Array<Record<string, ResultValue>>,
  currentAllStarIds: Set<number>,
  seasonStartYear: number,
): PlayerRecord {
  const currentAllStar = currentAllStarIds.has(player.id)
  const careerAccolades = buildCareerAccolades(
    awardRows,
    player.draft,
    player.career.isGreatest75,
  )
  const accolades = [...new Set([...player.career.accolades, ...careerAccolades.labels])]
  const enrichedPlayer: PlayerRecord = {
    ...player,
    career: {
      ...player.career,
      allStarAppearances: Math.max(
        player.career.allStarAppearances,
        careerAccolades.allStarAppearances,
        currentAllStar ? 1 : 0,
      ),
      allNbaSelections: Math.max(player.career.allNbaSelections, careerAccolades.allNbaSelections),
      allDefensiveSelections: Math.max(
        player.career.allDefensiveSelections,
        careerAccolades.allDefensiveSelections,
      ),
      championships: Math.max(player.career.championships, careerAccolades.championships),
      finalsMvpAwards: Math.max(player.career.finalsMvpAwards, careerAccolades.finalsMvpAwards),
      mvpAwards: Math.max(player.career.mvpAwards, careerAccolades.mvpAwards),
      rookieOfTheYearAwards: Math.max(
        player.career.rookieOfTheYearAwards,
        careerAccolades.rookieOfTheYearAwards,
      ),
      defensivePlayerOfTheYearAwards: Math.max(
        player.career.defensivePlayerOfTheYearAwards,
        careerAccolades.defensivePlayerOfTheYearAwards,
      ),
      scoringTitles: Math.max(player.career.scoringTitles, careerAccolades.scoringTitles),
      reboundTitles: Math.max(player.career.reboundTitles, careerAccolades.reboundTitles),
      assistTitles: Math.max(player.career.assistTitles, careerAccolades.assistTitles),
      isHallOfFame: player.career.isHallOfFame || careerAccolades.isHallOfFame,
      isGreatest75: player.career.isGreatest75 || careerAccolades.isGreatest75,
      accolades,
      primaryAccolade: accolades[0] ?? player.career.primaryAccolade,
      hasRichMetadata: false,
    },
    snapshot: {
      ...player.snapshot,
      minutesPerGame: player.snapshot.minutesPerGame ?? null,
      careerAccoladeLabel: accolades[0] ?? player.snapshot.careerAccoladeLabel,
    },
  }

  enrichedPlayer.flags = buildThemeFlags(enrichedPlayer, seasonStartYear, currentAllStar)
  enrichedPlayer.career.hasRichMetadata = hasRichMetadata(enrichedPlayer)
  return enrichedPlayer
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1

      if (currentIndex >= items.length) {
        return
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )

  return results
}

interface ProgressTracker {
  tick(increment?: number): void
  finish(): void
}

interface ProgressTrackerOptions {
  initialMsPerItem?: number
  warmupItems?: number
}

function formatEta(milliseconds: number): string {
  const safeMilliseconds = Math.max(0, Math.round(milliseconds))
  const totalSeconds = Math.ceil(safeMilliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }

  return `${seconds}s`
}

function createProgressTracker(
  label: string,
  total: number,
  options: ProgressTrackerOptions = {},
): ProgressTracker {
  const startTime = Date.now()
  const initialMsPerItem = Math.max(1, options.initialMsPerItem ?? 1000)
  const warmupItems = Math.max(1, options.warmupItems ?? 8)
  let completed = 0
  let lastRenderAt = 0
  let lastLineLength = 0
  let finished = false

  function render(force = false): void {
    if (finished) {
      return
    }

    const now = Date.now()

    if (!force && now - lastRenderAt < 250) {
      return
    }

    lastRenderAt = now
    const progress = total === 0 ? 1 : completed / total
    const elapsedMs = Math.max(1, now - startTime)
    const remaining = Math.max(0, total - completed)
    const observedMsPerItem =
      completed <= 0 ? initialMsPerItem : elapsedMs / completed
    const blendedMsPerItem =
      completed >= warmupItems
        ? observedMsPerItem
        : ((observedMsPerItem * completed) + (initialMsPerItem * (warmupItems - completed))) /
          warmupItems
    const etaMs = remaining * blendedMsPerItem
    const message =
      `${label}: ${completed}/${total}` +
      ` (${Math.round(progress * 100)}%)` +
      ` ETA ${formatEta(etaMs)}`

    if (process.stdout.isTTY) {
      const paddedMessage = message.padEnd(lastLineLength, ' ')
      process.stdout.write(`\r${paddedMessage}`)
      lastLineLength = Math.max(lastLineLength, paddedMessage.length)
    } else if (force || completed === total) {
      console.log(message)
    }
  }

  if (total === 0) {
    console.log(`${label}: 0/0 (100%) ETA 0s`)
    return {
      tick() {},
      finish() {},
    }
  }

  render(true)

  return {
    tick(increment = 1) {
      completed = Math.min(total, completed + increment)
      render()
    },
    finish() {
      completed = total
      render(true)

      if (process.stdout.isTTY) {
        process.stdout.write('\n')
      }

      finished = true
    },
  }
}

function buildPlayerPoolData(
  season: string,
  refreshedAt: string,
  asOfDate: string,
  rosterPlayerCount: number,
  eligiblePlayerCount: number,
  activeTenDayPlayers: PlayerPoolData['excludedTenDayPlayers'],
  players: PlayerRecord[],
  usingExistingPoolFallback: boolean,
  allStarYear: number,
): PlayerPoolData {
  return {
    schemaVersion: 5,
    season,
    refreshedAt,
    asOfDate,
    rosterFreshness: {
      refreshedAt,
      asOfDate,
      season,
    },
    eligibility: {
      rosterStatusRequired: true,
      transactionAwareTenDayExclusion: true,
      rosterPlayerCount,
      eligiblePlayerCount,
      excludedActiveTenDayCount: activeTenDayPlayers.length,
      rules: [
        'Only current NBA roster rows with ROSTER_STATUS = 1 are eligible.',
        'Players on active 10-day contracts are excluded using transaction and schedule data.',
        'Guess lists and mystery-player pools are generated from the same eligible player set.',
        usingExistingPoolFallback
          ? 'Core NBA endpoints were unavailable during this refresh, so the previous generated pool was rehydrated and re-enriched.'
          : 'Current roster data was refreshed directly from NBA sources.',
      ],
    },
    sources: {
      rosters: PLAYER_INDEX_SOURCE.replace('{season}', season),
      bioStats: BIO_STATS_SOURCE.replace('{season}', season),
      transactions: TRANSACTION_SOURCE,
      schedule: SCHEDULE_SOURCE,
      standings: STANDINGS_SOURCE.replace('{season}', season),
      advancedStats: ADVANCED_PLAYER_STATS_SOURCE.replace('{season}', season),
      draftHistory: DRAFT_HISTORY_SOURCE,
      franchisePlayers: FRANCHISE_PLAYERS_SOURCE,
      allStarRoster: ALL_STAR_ROSTER_SOURCE.replace('{year}', `${allStarYear}`),
      playerAwards: PLAYER_AWARDS_SOURCE,
      commonPlayerInfo: COMMON_PLAYER_INFO_SOURCE,
      basketballReference: BASKETBALL_REFERENCE_SEARCH_SOURCE,
    },
    excludedTenDayPlayers: activeTenDayPlayers,
    players,
  }
}

function buildHistoryPlayerPoolData(
  season: string,
  refreshedAt: string,
  asOfDate: string,
  rosterPlayerCount: number,
  activeTenDayPlayers: PlayerPoolData['excludedTenDayPlayers'],
  players: PlayerRecord[],
  allStarYear: number,
): PlayerPoolData {
  return {
    schemaVersion: 5,
    season,
    refreshedAt,
    asOfDate,
    rosterFreshness: {
      refreshedAt,
      asOfDate,
      season,
    },
    eligibility: {
      rosterStatusRequired: false,
      transactionAwareTenDayExclusion: true,
      rosterPlayerCount,
      eligiblePlayerCount: players.length,
      excludedActiveTenDayCount: activeTenDayPlayers.length,
      rules: [
        'All-time history uses the official NBA historical player index for the same season snapshot.',
        'Active 10-day contract players are excluded from the shared current-day pool.',
        'Historical players are enriched with official NBA data first, then Basketball-Reference only for missing fields.',
        'History mode stays practice-only so Daily remains deterministic on the current roster.',
      ],
    },
    sources: {
      rosters: HISTORICAL_PLAYER_INDEX_SOURCE.replace('{season}', season),
      bioStats: BIO_STATS_SOURCE.replace('{season}', season),
      transactions: TRANSACTION_SOURCE,
      schedule: SCHEDULE_SOURCE,
      standings: STANDINGS_SOURCE.replace('{season}', season),
      advancedStats: ADVANCED_PLAYER_STATS_SOURCE.replace('{season}', season),
      draftHistory: DRAFT_HISTORY_SOURCE,
      franchisePlayers: FRANCHISE_PLAYERS_SOURCE,
      allStarRoster: ALL_STAR_ROSTER_SOURCE.replace('{year}', `${allStarYear}`),
      playerAwards: PLAYER_AWARDS_SOURCE,
      commonPlayerInfo: COMMON_PLAYER_INFO_SOURCE,
      basketballReference: BASKETBALL_REFERENCE_SEARCH_SOURCE,
    },
    excludedTenDayPlayers: activeTenDayPlayers,
    players,
  }
}

async function writeGeneratedPools(
  outputDirectory: string,
  outputPath: string,
  historyOutputPath: string,
  playerPool: PlayerPoolData,
  historyPlayerPool: PlayerPoolData,
): Promise<void> {
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(playerPool, null, 2)}\n`, 'utf8')
  await writeFile(historyOutputPath, `${JSON.stringify(historyPlayerPool, null, 2)}\n`, 'utf8')
}

async function buildImageFallbackManifest(
  players: PlayerRecord[],
  refreshedAt: string,
  existingManifest: PlayerImageFallbackManifest | null,
  missingOnly = false,
): Promise<PlayerImageFallbackManifest> {
  const existingFallbacks = { ...(existingManifest?.fallbacks ?? {}) }
  const candidates = missingOnly
    ? players.filter((player) => !existingFallbacks[`${player.id}`])
    : players
  const progress = createProgressTracker(
    missingOnly ? 'Missing image fallback scan' : 'Image fallback scan',
    candidates.length,
    {
      initialMsPerItem: 180,
    },
  )
  const imageFallbackEntries = await mapWithConcurrency(candidates, 16, async (player) => {
    try {
      for (const candidateUrl of build2KRatingsFallbackCandidates(player)) {
        if (await headExists(candidateUrl)) {
          return [player.id, candidateUrl] as const
        }
      }

      return null
    } finally {
      progress.tick()
    }
  })
  progress.finish()

  return {
    schemaVersion: 1,
    generatedAt: refreshedAt,
    source: '2KRatings static image fallback manifest',
    fallbacks: {
      ...existingFallbacks,
      ...Object.fromEntries(
        imageFallbackEntries
          .filter(isPresent)
          .map(([playerId, url]) => [`${playerId}`, url]),
      ),
    },
  }
}

function isPoolRefreshDue(
  pool: PlayerPoolData | null,
  intervalMs: number,
  now: Date,
): boolean {
  if (!pool?.refreshedAt) {
    return true
  }

  const refreshedAt = Date.parse(pool.refreshedAt)

  if (!Number.isFinite(refreshedAt)) {
    return true
  }

  return now.getTime() - refreshedAt >= intervalMs
}

async function main(): Promise<void> {
  const requestedMode = parseRefreshMode(process.argv)
  const now = new Date()
  const refreshedAt = now.toISOString()
  const asOfDate = DateTime.fromJSDate(now, { zone: 'utc' }).toISODate()

  if (!asOfDate) {
    throw new Error('Unable to compute refresh date')
  }

  const season = getCurrentSeason(now)
  const seasonStartYear = Number(season.slice(0, 4))
  const allStarYear = seasonStartYear + 1
  const currentFileDirectory = path.dirname(fileURLToPath(import.meta.url))
  const cacheDirectory = path.resolve(currentFileDirectory, `.cache/nba/${season}`)
  const outputDirectory = path.resolve(currentFileDirectory, '../src/data/generated')
  const outputPath = path.join(outputDirectory, 'player-pool.json')
  const historyOutputPath = path.join(outputDirectory, 'history-player-pool.json')
  const imageFallbackPath = path.join(outputDirectory, 'player-image-fallbacks.json')
  const enrichmentStatusPath = path.join(cacheDirectory, 'enrichment-status.json')
  const existingPool = await readCachedJson<PlayerPoolData>(outputPath)
  const existingHistoryPool = await readCachedJson<PlayerPoolData>(historyOutputPath)
  const existingImageFallbackManifest =
    await readCachedJson<PlayerImageFallbackManifest>(imageFallbackPath)
  const existingPlayerBioMap = buildExistingPlayerBioMap(existingPool, existingHistoryPool)
  const existingEnrichmentStatusManifest = await readEnrichmentStatusManifest(enrichmentStatusPath)
  const effectiveMode = requestedMode === 'auto'
    ? isPoolRefreshDue(existingHistoryPool, HISTORY_REFRESH_INTERVAL_MS, now)
      ? 'all'
      : isPoolRefreshDue(existingPool, CURRENT_REFRESH_INTERVAL_MS, now)
        ? 'current'
        : !existingImageFallbackManifest
          ? 'images'
          : null
    : requestedMode

  if (effectiveMode === null) {
    console.log('Refresh skipped. Current pool is younger than 7 days and history pool is younger than 30 days.')
    return
  }

  console.log(`Refresh mode: ${effectiveMode}`)

  if (effectiveMode === 'images') {
    if (!existingPool) {
      throw new Error('Current player pool is missing. Run the current refresh first.')
    }

    const imageFallbackManifest = await buildImageFallbackManifest(
      existingPool.players,
      refreshedAt,
      existingImageFallbackManifest,
    )
    await mkdir(outputDirectory, { recursive: true })
    await writeFile(imageFallbackPath, `${JSON.stringify(imageFallbackManifest, null, 2)}\n`, 'utf8')
    console.log(
      `Built ${Object.keys(imageFallbackManifest.fallbacks).length} 2KRatings fallback images at ${imageFallbackPath}.`,
    )
    return
  }

  if (effectiveMode === 'repair-missing') {
    if (!existingPool && !existingHistoryPool) {
      throw new Error('Generated pools are missing. Run current or history refresh first.')
    }

    const currentPlayers = (existingPool?.players ?? []).map((player) =>
      coerceExistingPlayerRecord(player, seasonStartYear),
    )
    const historyPlayers = (existingHistoryPool?.players ?? []).map((player) =>
      coerceExistingPlayerRecord(player, seasonStartYear),
    )
    const playersById = new Map<number, PlayerRecord>()

    for (const player of [...currentPlayers, ...historyPlayers]) {
      if (!playersById.has(player.id)) {
        playersById.set(player.id, player)
      }
    }

    const candidateIdentities = [...playersById.values()]
      .filter((player) => {
        const profile = existingPlayerBioMap.get(player.id)
        return FORCED_PLAYER_IDS.has(player.id) || getMissingBioFields(profile).length > 0
      })
      .map((player) => buildPlayerIdentityFromPlayer(player))

    const { playerBioMap, statusManifest } = await buildPlayerBioMap(
      candidateIdentities,
      cacheDirectory,
      existingPlayerBioMap,
      existingEnrichmentStatusManifest,
      'Missing bio repair',
      { missingOnly: true },
    )
    const mergedPlayerBioMap = new Map(existingPlayerBioMap)

    for (const [playerId, profile] of playerBioMap) {
      mergedPlayerBioMap.set(playerId, profile)
    }

    const nextCurrentPlayers = currentPlayers.map((player) =>
      applyBirthDateData(player, mergedPlayerBioMap, asOfDate, seasonStartYear),
    )
    const nextHistoryPlayers = historyPlayers.map((player) =>
      applyBirthDateData(player, mergedPlayerBioMap, asOfDate, seasonStartYear),
    )
    const nextImageFallbackManifest = existingPool
      ? await buildImageFallbackManifest(
          nextCurrentPlayers,
          refreshedAt,
          existingImageFallbackManifest,
          true,
        )
      : existingImageFallbackManifest

    await mkdir(outputDirectory, { recursive: true })
    await writeEnrichmentStatusManifest(enrichmentStatusPath, statusManifest)

    if (existingPool) {
      await writeFile(
        outputPath,
        `${JSON.stringify(
          {
            ...existingPool,
            refreshedAt,
            asOfDate,
            rosterFreshness: {
              ...existingPool.rosterFreshness,
              refreshedAt,
              asOfDate,
            },
            players: nextCurrentPlayers,
          },
          null,
          2,
        )}\n`,
        'utf8',
      )
    }

    if (existingHistoryPool) {
      await writeFile(
        historyOutputPath,
        `${JSON.stringify(
          {
            ...existingHistoryPool,
            refreshedAt,
            asOfDate,
            rosterFreshness: {
              ...existingHistoryPool.rosterFreshness,
              refreshedAt,
              asOfDate,
            },
            players: nextHistoryPlayers,
          },
          null,
          2,
        )}\n`,
        'utf8',
      )
    }

    if (nextImageFallbackManifest) {
      await writeFile(imageFallbackPath, `${JSON.stringify(nextImageFallbackManifest, null, 2)}\n`, 'utf8')
    }

    flushFailedRequestSummary()
    console.log(
      `Repaired missing data for ${candidateIdentities.length} player records. Filled ${playerBioMap.size} bio profiles.`,
    )
    return
  }

  const currentOnlyMode = effectiveMode === 'current'
  let rosterPlayers: PlayerRecord[] = []
  let historicalRosterRows: Array<Record<string, ResultValue>> = []
  let activeTenDayPlayers: PlayerPoolData['excludedTenDayPlayers'] = []
  let baseEligiblePlayers: PlayerRecord[] = []
  let historyPlayers: PlayerRecord[] = []
  let rosterPlayerCount = 0
  let draftYears: number[] = []
  let currentAllStarIds = new Set<number>()
  let usingExistingPoolFallback = false

  try {
    const [
      playerIndexResponse,
      historicalPlayerIndexResponse,
      bioStatsResponse,
      advancedPlayerStatsResponse,
      scheduleResponse,
      movementResponse,
      standingsResponse,
    ] =
      await Promise.all([
        fetchJsonWithStaleFallback<ResultSetResponse>(
          PLAYER_INDEX_SOURCE.replace('{season}', season),
          path.join(cacheDirectory, 'core', 'player-index.json'),
          NBA_HEADERS,
          CORE_SOURCE_TIMEOUT_MS,
        ),
        currentOnlyMode
          ? Promise.resolve(null)
          : fetchJsonWithStaleFallback<ResultSetResponse>(
              HISTORICAL_PLAYER_INDEX_SOURCE.replace('{season}', season),
              path.join(cacheDirectory, 'core', 'historical-player-index.json'),
              NBA_HEADERS,
              CORE_SOURCE_TIMEOUT_MS,
            ),
        fetchJsonWithStaleFallback<ResultSetResponse>(
          BIO_STATS_SOURCE.replace('{season}', season),
          path.join(cacheDirectory, 'core', 'bio-stats.json'),
          NBA_HEADERS,
          CORE_SOURCE_TIMEOUT_MS,
        ),
        fetchJsonWithStaleFallback<ResultSetResponse>(
          ADVANCED_PLAYER_STATS_SOURCE.replace('{season}', season),
          path.join(cacheDirectory, 'core', 'advanced-player-stats.json'),
          NBA_HEADERS,
          CORE_SOURCE_TIMEOUT_MS,
        ),
        fetchJsonWithStaleFallback<ScheduleResponse>(
          SCHEDULE_SOURCE,
          path.join(cacheDirectory, 'core', 'schedule.json'),
          {
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/json, text/plain, */*',
          },
          CORE_SOURCE_TIMEOUT_MS,
        ),
        fetchJsonWithStaleFallback<PlayerMovementResponse>(
          TRANSACTION_SOURCE,
          path.join(cacheDirectory, 'core', 'player-movement.json'),
          NBA_HEADERS,
          CORE_SOURCE_TIMEOUT_MS,
        ),
        fetchJsonWithStaleFallback<ResultSetResponse>(
          STANDINGS_SOURCE.replace('{season}', season),
          path.join(cacheDirectory, 'core', 'standings.json'),
          NBA_HEADERS,
          CORE_SOURCE_TIMEOUT_MS,
        ),
      ])

    if (
      !playerIndexResponse ||
      !bioStatsResponse ||
      !advancedPlayerStatsResponse ||
      !scheduleResponse ||
      !movementResponse ||
      !standingsResponse ||
      (!currentOnlyMode && !historicalPlayerIndexResponse)
    ) {
      throw new Error('Core NBA sources are unavailable and no stale cache was found')
    }

    const ageMap = buildAgeMap(mapRows(bioStatsResponse))
    const statMap = buildStatMap(mapRows(advancedPlayerStatsResponse))
    const standingMap = buildStandingMap(mapRows(standingsResponse, 'Standings'))
    const rosterRows = mapRows(playerIndexResponse, 'PlayerIndex')
    historicalRosterRows =
      currentOnlyMode || !historicalPlayerIndexResponse
        ? []
        : mapRows(historicalPlayerIndexResponse, 'PlayerIndex')
    rosterPlayers = rosterRows
      .map((row) => normalizePlayer(row, ageMap, statMap, standingMap, seasonStartYear))
      .filter((player): player is PlayerRecord => player !== null)
    const games = scheduleResponse.leagueSchedule.gameDates.flatMap((date) => date.games)
    activeTenDayPlayers = deriveActiveTenDayContracts(
      movementResponse.NBA_Player_Movement.rows,
      games,
      asOfDate,
    ).map((player) => {
      const team = TEAM_BY_ID.get(player.teamId)

      return {
        ...player,
        teamName: team ? `${team.city} ${team.name}` : player.teamName,
      }
    })

    const excludedIds = new Set(activeTenDayPlayers.map((player) => player.id))
    baseEligiblePlayers = rosterPlayers.filter((player) => !excludedIds.has(player.id))
    rosterPlayerCount = rosterPlayers.length
    draftYears = [...new Set(baseEligiblePlayers.map((player) => player.draft.year).filter(isPresent))]
  } catch (error) {
    if (!existingPool || (!currentOnlyMode && !existingHistoryPool)) {
      throw error
    }

    console.warn('Core NBA refresh failed. Rebuilding from the existing generated pool instead.', error)
    usingExistingPoolFallback = true
    rosterPlayers = existingPool.players.map((player) =>
      coerceExistingPlayerRecord(player, seasonStartYear),
    )
    activeTenDayPlayers = existingPool.excludedTenDayPlayers ?? []
    baseEligiblePlayers = rosterPlayers
    rosterPlayerCount = existingPool.eligibility?.rosterPlayerCount ?? rosterPlayers.length
    draftYears = []
    historyPlayers = (existingHistoryPool?.players ?? []).map((player) =>
      coerceExistingPlayerRecord(player, seasonStartYear),
    )
    currentAllStarIds = new Set(
      rosterPlayers.filter((player) => player.flags.isAllStar).map((player) => player.id),
    )
  }

  const excludedIds = new Set(activeTenDayPlayers.map((player) => player.id))
  const historicalRowsForPool = historicalRosterRows.filter((row) => {
    const playerId = parseIntegerValue(row.PERSON_ID)
    return playerId !== null && !excludedIds.has(playerId)
  })
  const playerIdentities = new Map<number, PlayerIdentity>()

  for (const player of baseEligiblePlayers) {
    playerIdentities.set(player.id, buildPlayerIdentityFromPlayer(player))
  }

  if (currentOnlyMode) {
    // Keep the weekly refresh focused on the live roster only.
  } else if (usingExistingPoolFallback) {
    for (const player of historyPlayers) {
      playerIdentities.set(player.id, buildPlayerIdentityFromPlayer(player))
    }
  } else {
    for (const row of historicalRowsForPool) {
      const playerIdentity = buildPlayerIdentityFromRow(row)

      if (playerIdentity) {
        playerIdentities.set(playerIdentity.id, playerIdentity)
      }
    }
  }

  const currentEligibleIds = new Set(baseEligiblePlayers.map((player) => player.id))
  const preservedInactiveHistoryPlayers = (existingHistoryPool?.players ?? [])
    .filter((player) => !player.isCurrentPlayer)
    .map((player) => coerceExistingPlayerRecord(player, seasonStartYear))
  const coreHistoryPlayers = usingExistingPoolFallback
    ? historyPlayers
    : currentOnlyMode
      ? [...baseEligiblePlayers, ...preservedInactiveHistoryPlayers].toSorted((left, right) =>
          left.displayName.localeCompare(right.displayName),
        )
    : [
        ...baseEligiblePlayers,
        ...historicalRowsForPool
          .filter((row) => {
            const playerId = parseIntegerValue(row.PERSON_ID)
            return playerId !== null && !currentEligibleIds.has(playerId)
          })
          .map((row) => normalizeHistoricalPlayer(row, seasonStartYear))
          .filter((player): player is PlayerRecord => player !== null),
      ].toSorted((left, right) => left.displayName.localeCompare(right.displayName))

  await writeGeneratedPools(
    outputDirectory,
    outputPath,
    historyOutputPath,
    buildPlayerPoolData(
      season,
      refreshedAt,
      asOfDate,
      rosterPlayerCount,
      baseEligiblePlayers.length,
      activeTenDayPlayers,
      baseEligiblePlayers.toSorted((left, right) => left.displayName.localeCompare(right.displayName)),
      usingExistingPoolFallback,
      allStarYear,
    ),
    buildHistoryPlayerPoolData(
      season,
      refreshedAt,
      asOfDate,
      currentOnlyMode
        ? existingHistoryPool?.eligibility?.rosterPlayerCount ?? coreHistoryPlayers.length
        : historicalRowsForPool.length,
      activeTenDayPlayers,
      coreHistoryPlayers,
      allStarYear,
    ),
  )

  const { playerBioMap, statusManifest } = await buildPlayerBioMap(
    [...playerIdentities.values()],
    cacheDirectory,
    existingPlayerBioMap,
    existingEnrichmentStatusManifest,
    currentOnlyMode ? 'Current bio enrichment' : 'Full bio enrichment',
  )
  await writeEnrichmentStatusManifest(enrichmentStatusPath, statusManifest)

  baseEligiblePlayers = baseEligiblePlayers.map((player) =>
    applyBirthDateData(player, playerBioMap, asOfDate, seasonStartYear),
  )

  if (usingExistingPoolFallback) {
    historyPlayers = historyPlayers.map((player) =>
      applyBirthDateData(player, playerBioMap, asOfDate, seasonStartYear),
    )
  }

  const eligiblePlayerIds = new Set(baseEligiblePlayers.map((player) => player.id))
  const historicalDraftYears = usingExistingPoolFallback
    ? []
    : [
        ...new Set(
          historicalRowsForPool
            .map((row) => parseIntegerValue(row.DRAFT_YEAR))
            .filter(isPresent),
        ),
      ]
  const allDraftYears = [...new Set([...draftYears, ...historicalDraftYears])].sort((left, right) => left - right)
  const playerAwardsProgress = createProgressTracker('Player awards', baseEligiblePlayers.length, {
    initialMsPerItem: 700,
  })
  const draftHistoryProgress = createProgressTracker('Draft history', allDraftYears.length, {
    initialMsPerItem: 1500,
  })
  const franchiseProgress = createProgressTracker('Franchise history', TEAM_METADATA.length, {
    initialMsPerItem: 1200,
  })

  const [
    playerAwardsPayloads,
    draftPayloads,
    franchisePayloads,
  ] = await Promise.all([
    mapWithConcurrency(baseEligiblePlayers, PLAYER_AWARDS_CONCURRENCY, async (player) => {
      try {
        const response = await fetchJsonWithCache<ResultSetResponse>(
          PLAYER_AWARDS_SOURCE.replace('{playerId}', `${player.id}`),
          path.join(cacheDirectory, 'player-awards', `${player.id}.json`),
          NBA_HEADERS,
          PLAYER_AWARDS_TIMEOUT_MS,
          4,
          PLAYER_AWARDS_CACHE_MAX_AGE_MS,
        )

        return [player.id, response] as const
      } finally {
        playerAwardsProgress.tick()
      }
    }),
    mapWithConcurrency(allDraftYears, 2, async (year) => {
      try {
        const response = await fetchJsonWithCache<ResultSetResponse>(
          DRAFT_HISTORY_SOURCE.replace('{year}', `${year}`),
          path.join(cacheDirectory, 'draft-history', `${year}.json`),
          NBA_HEADERS,
          30000,
        )

        return [year, response] as const
      } finally {
        draftHistoryProgress.tick()
      }
    }),
    mapWithConcurrency(TEAM_METADATA, 4, async (team) => {
      try {
        const response = await fetchJsonWithCache<ResultSetResponse>(
          FRANCHISE_PLAYERS_SOURCE.replace('{teamId}', `${team.id}`),
          path.join(cacheDirectory, 'franchise-players', `${team.id}.json`),
          NBA_HEADERS,
          20000,
        )

        return [team.id, response] as const
      } finally {
        franchiseProgress.tick()
      }
    }),
  ])
  playerAwardsProgress.finish()
  draftHistoryProgress.finish()
  franchiseProgress.finish()

  if (!usingExistingPoolFallback) {
    const allStarRosterHtml = await fetchTextWithCache(
      ALL_STAR_ROSTER_SOURCE.replace('{year}', `${allStarYear}`),
      path.join(cacheDirectory, 'all-star', `${allStarYear}.html`),
      {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      15000,
    )
    currentAllStarIds = allStarRosterHtml ? extractAllStarPlayerIds(allStarRosterHtml) : new Set<number>()
  }

  const draftByPlayerId = new Map<number, Record<string, ResultValue>>()
  const awardsByPlayerId = new Map<number, Array<Record<string, ResultValue>>>()

  for (const [, response] of draftPayloads) {
    if (!response) {
      continue
    }

    for (const row of mapRows(response, 'DraftHistory')) {
      const playerId = parseIntegerValue(row.PERSON_ID)

      if (playerId !== null) {
        draftByPlayerId.set(playerId, row)
      }
    }
  }

  for (const [playerId, response] of playerAwardsPayloads) {
    awardsByPlayerId.set(playerId, response ? mapRows(response, 'PlayerAwards') : [])
  }

  const careerTeamMap = new Map<number, Set<number>>()

  for (const row of historicalRowsForPool) {
    const playerId = parseIntegerValue(row.PERSON_ID)
    const teamContext = buildTeamContext(row)

    if (playerId === null || !teamContext) {
      continue
    }

    careerTeamMap.set(playerId, new Set([teamContext.teamId]))
  }

  for (const [teamId, response] of franchisePayloads) {
    if (!response) {
      continue
    }

    for (const row of mapRows(response)) {
      const playerId = parseIntegerValue(row.PERSON_ID)

      if (playerId !== null) {
        const existingTeams = careerTeamMap.get(playerId) ?? new Set<number>()
        existingTeams.add(teamId)
        careerTeamMap.set(playerId, existingTeams)
      }
    }
  }

  const eligiblePlayers = baseEligiblePlayers
    .map((player) =>
      usingExistingPoolFallback
        ? applyAwardDataToExistingPlayer(
            player,
            awardsByPlayerId.get(player.id) ?? [],
            currentAllStarIds,
            seasonStartYear,
          )
        : applyExtendedData(
            player,
            draftByPlayerId.get(player.id),
            awardsByPlayerId.get(player.id) ?? [],
            [...(careerTeamMap.get(player.id) ?? new Set<number>())],
            currentAllStarIds,
            seasonStartYear,
          ),
    )
    .toSorted((left, right) => left.displayName.localeCompare(right.displayName))

  if (!usingExistingPoolFallback && !currentOnlyMode) {
    const inactiveHistoryPlayers = historicalRowsForPool
      .filter((row) => {
        const playerId = parseIntegerValue(row.PERSON_ID)
        return playerId !== null && !eligiblePlayerIds.has(playerId)
      })
      .map((row) =>
        normalizeHistoricalPlayer(row, seasonStartYear),
      )
      .filter((player): player is PlayerRecord => player !== null)
      .map((player) => applyBirthDateData(player, playerBioMap, asOfDate, seasonStartYear))
      .map((player) =>
        applyExtendedData(
          player,
          draftByPlayerId.get(player.id),
          [],
          [...(careerTeamMap.get(player.id) ?? new Set<number>())],
          new Set<number>(),
          seasonStartYear,
        ),
      )

    historyPlayers = [...eligiblePlayers, ...inactiveHistoryPlayers].toSorted((left, right) =>
      left.displayName.localeCompare(right.displayName),
    )
  }

  if (currentOnlyMode) {
    historyPlayers = [...eligiblePlayers, ...preservedInactiveHistoryPlayers].toSorted((left, right) =>
      left.displayName.localeCompare(right.displayName),
    )
  }

  const imageFallbackEntries = await mapWithConcurrency(eligiblePlayers, 16, async (player) => {
    for (const candidateUrl of build2KRatingsFallbackCandidates(player)) {
      if (await headExists(candidateUrl)) {
        return [player.id, candidateUrl] as const
      }
    }

    return null
  })
  const imageFallbackManifest: PlayerImageFallbackManifest =
    imageFallbackEntries.some(isPresent) || !existingImageFallbackManifest
      ? {
          schemaVersion: 1,
          generatedAt: refreshedAt,
          source: '2KRatings static image fallback manifest',
          fallbacks: Object.fromEntries(
            imageFallbackEntries
              .filter(isPresent)
              .map(([playerId, url]) => [`${playerId}`, url]),
          ),
        }
      : existingImageFallbackManifest

  await writeGeneratedPools(
    outputDirectory,
    outputPath,
    historyOutputPath,
    buildPlayerPoolData(
      season,
      refreshedAt,
      asOfDate,
      rosterPlayerCount,
      eligiblePlayers.length,
      activeTenDayPlayers,
      eligiblePlayers,
      usingExistingPoolFallback,
      allStarYear,
    ),
    buildHistoryPlayerPoolData(
      season,
      refreshedAt,
      asOfDate,
      historicalRowsForPool.length,
      activeTenDayPlayers,
      historyPlayers,
      allStarYear,
    ),
  )
  await writeFile(imageFallbackPath, `${JSON.stringify(imageFallbackManifest, null, 2)}\n`, 'utf8')
  flushFailedRequestSummary()

  console.log(
    `Wrote ${eligiblePlayers.length} current players to ${outputPath}. Wrote ${historyPlayers.length} history players to ${historyOutputPath}. Excluded ${activeTenDayPlayers.length} active 10-day contracts. Built ${Object.keys(imageFallbackManifest.fallbacks).length} 2KRatings fallback images.`,
  )
}

void main()
