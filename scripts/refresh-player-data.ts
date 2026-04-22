import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DateTime } from 'luxon'

import { getCurrentSeason } from '../src/lib/nba/daily'
import {
  buildSearchText,
  canonicalizePosition,
  inchesToCentimeters,
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
const TWO_K_RATINGS_IMAGE_BASE = 'https://www.2kratings.com/wp-content/uploads'

type ResultValue = string | number | null

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

interface RequestFailureSummary {
  count: number
  sampleUrl: string
  sampleMessage: string
}

const requestFailureSummary = new Map<string, RequestFailureSummary>()

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

function getRequestFailureKey(url: string): string {
  if (url.includes('playerawards')) {
    return 'playerAwards'
  }

  if (url.includes('drafthistory')) {
    return 'draftHistory'
  }

  if (url.includes('franchiseplayers')) {
    return 'franchisePlayers'
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

async function fetchJson<T>(
  url: string,
  headers: Record<string, string> = NBA_HEADERS,
  timeoutMs = 12000,
  maxAttempts = 5,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
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
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }

  throw lastError
}

async function fetchText(
  url: string,
  headers: Record<string, string> = NBA_HEADERS,
  timeoutMs = 12000,
  maxAttempts = 5,
): Promise<string> {
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
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
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }

  throw lastError
}

async function fetchJsonOrNull<T>(
  url: string,
  headers: Record<string, string> = NBA_HEADERS,
  timeoutMs = 12000,
  maxAttempts = 5,
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
  timeoutMs = 12000,
  maxAttempts = 5,
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
  timeoutMs = 12000,
  maxAttempts = 5,
): Promise<T | null> {
  const cached = await readCachedJson<T>(cachePath)

  if (cached) {
    return cached
  }

  const response = await fetchJsonOrNull<T>(url, headers, timeoutMs, maxAttempts)

  if (response) {
    await mkdir(path.dirname(cachePath), { recursive: true })
    await writeFile(cachePath, `${JSON.stringify(response)}\n`, 'utf8')
  }

  return response
}

async function fetchTextWithCache(
  url: string,
  cachePath: string,
  headers: Record<string, string> = NBA_HEADERS,
  timeoutMs = 12000,
  maxAttempts = 5,
): Promise<string | null> {
  const cached = await readCachedText(cachePath)

  if (cached) {
    return cached
  }

  const response = await fetchTextOrNull(url, headers, timeoutMs, maxAttempts)

  if (response) {
    await mkdir(path.dirname(cachePath), { recursive: true })
    await writeFile(cachePath, response, 'utf8')
  }

  return response
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
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    })

    return response.ok
  } catch {
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
  }
}

function incrementAwardCounts(
  counts: AwardCounts,
  description: string,
): AwardCounts {
  const normalized = description.toLowerCase()

  if (normalized.includes('nba champion')) {
    counts.championships += 1
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
): { labels: string[]; championships: number; allStarAppearances: number; primary: string | null } {
  const counts = awardRows.reduce((result, row) => {
    const description = cleanText(row.DESCRIPTION)
    return description ? incrementAwardCounts(result, description) : result
  }, createEmptyAwardCounts())

  const labels = [
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
      championships: 0,
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
      championships: 0,
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
  const careerAccolades = buildCareerAccolades(awardRows, draft)
  const enrichedPlayer: PlayerRecord = {
    ...player,
    draft,
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
      championships: careerAccolades.championships,
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
    career: {
      ...player.career,
      finalSeasonYear: player.career.finalSeasonYear ?? player.career.debutYear ?? null,
      seasonsPlayed:
        player.career.seasonsPlayed ??
        getSeasonSpan(
          player.career.debutYear,
          player.career.finalSeasonYear ?? player.career.debutYear ?? null,
        ),
      championships: player.career.championships ?? 0,
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
  const careerAccolades = buildCareerAccolades(awardRows, player.draft)
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
      championships: Math.max(player.career.championships, careerAccolades.championships),
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

async function main(): Promise<void> {
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
  const existingPool = await readCachedJson<PlayerPoolData>(outputPath)
  const existingHistoryPool = await readCachedJson<PlayerPoolData>(historyOutputPath)
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
        fetchJson<ResultSetResponse>(PLAYER_INDEX_SOURCE.replace('{season}', season), NBA_HEADERS, 30000),
        fetchJson<ResultSetResponse>(
          HISTORICAL_PLAYER_INDEX_SOURCE.replace('{season}', season),
          NBA_HEADERS,
          30000,
        ),
        fetchJson<ResultSetResponse>(BIO_STATS_SOURCE.replace('{season}', season), NBA_HEADERS, 30000),
        fetchJson<ResultSetResponse>(
          ADVANCED_PLAYER_STATS_SOURCE.replace('{season}', season),
          NBA_HEADERS,
          30000,
        ),
        fetchJson<ScheduleResponse>(
          SCHEDULE_SOURCE,
          {
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/json, text/plain, */*',
          },
          30000,
        ),
        fetchJson<PlayerMovementResponse>(TRANSACTION_SOURCE, NBA_HEADERS, 30000),
        fetchJson<ResultSetResponse>(STANDINGS_SOURCE.replace('{season}', season), NBA_HEADERS, 30000),
      ])

    const ageMap = buildAgeMap(mapRows(bioStatsResponse))
    const statMap = buildStatMap(mapRows(advancedPlayerStatsResponse))
    const standingMap = buildStandingMap(mapRows(standingsResponse, 'Standings'))
    const rosterRows = mapRows(playerIndexResponse, 'PlayerIndex')
    historicalRosterRows = mapRows(historicalPlayerIndexResponse, 'PlayerIndex')
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
    if (!existingPool || !existingHistoryPool) {
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
    historyPlayers = existingHistoryPool.players.map((player) =>
      coerceExistingPlayerRecord(player, seasonStartYear),
    )
    currentAllStarIds = new Set(
      rosterPlayers.filter((player) => player.flags.isAllStar).map((player) => player.id),
    )
  }

  const excludedIds = new Set(activeTenDayPlayers.map((player) => player.id))
  const eligiblePlayerIds = new Set(baseEligiblePlayers.map((player) => player.id))
  const historicalRowsForPool = historicalRosterRows.filter((row) => {
    const playerId = parseIntegerValue(row.PERSON_ID)
    return playerId !== null && !excludedIds.has(playerId)
  })
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

  const [
    playerAwardsPayloads,
    draftPayloads,
    franchisePayloads,
  ] = await Promise.all([
    mapWithConcurrency(baseEligiblePlayers, 6, async (player) => {
      const response = await fetchJsonWithCache<ResultSetResponse>(
        PLAYER_AWARDS_SOURCE.replace('{playerId}', `${player.id}`),
        path.join(cacheDirectory, 'player-awards', `${player.id}.json`),
        NBA_HEADERS,
        6500,
        3,
      )

      return [player.id, response] as const
    }),
    mapWithConcurrency(allDraftYears, 2, async (year) => {
      const response = await fetchJsonWithCache<ResultSetResponse>(
        DRAFT_HISTORY_SOURCE.replace('{year}', `${year}`),
        path.join(cacheDirectory, 'draft-history', `${year}.json`),
        NBA_HEADERS,
        30000,
      )

      return [year, response] as const
    }),
    mapWithConcurrency(TEAM_METADATA, 4, async (team) => {
      const response = await fetchJsonWithCache<ResultSetResponse>(
        FRANCHISE_PLAYERS_SOURCE.replace('{teamId}', `${team.id}`),
        path.join(cacheDirectory, 'franchise-players', `${team.id}.json`),
        NBA_HEADERS,
        20000,
      )

      return [team.id, response] as const
    }),
  ])

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

  if (!usingExistingPoolFallback) {
    const inactiveHistoryPlayers = historicalRowsForPool
      .filter((row) => {
        const playerId = parseIntegerValue(row.PERSON_ID)
        return playerId !== null && !eligiblePlayerIds.has(playerId)
      })
      .map((row) =>
        normalizeHistoricalPlayer(row, seasonStartYear),
      )
      .filter((player): player is PlayerRecord => player !== null)
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

  const imageFallbackEntries = await mapWithConcurrency(eligiblePlayers, 16, async (player) => {
    for (const candidateUrl of build2KRatingsFallbackCandidates(player)) {
      if (await headExists(candidateUrl)) {
        return [player.id, candidateUrl] as const
      }
    }

    return null
  })
  const imageFallbackManifest: PlayerImageFallbackManifest = {
    schemaVersion: 1,
    generatedAt: refreshedAt,
    source: '2KRatings static image fallback manifest',
    fallbacks: Object.fromEntries(
      imageFallbackEntries
        .filter(isPresent)
        .map(([playerId, url]) => [`${playerId}`, url]),
    ),
  }

  const playerPool: PlayerPoolData = {
    schemaVersion: 4,
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
      eligiblePlayerCount: eligiblePlayers.length,
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
    },
    excludedTenDayPlayers: activeTenDayPlayers,
    players: eligiblePlayers,
  }

  const historyPlayerPool: PlayerPoolData = {
    schemaVersion: 4,
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
      rosterPlayerCount: historicalRowsForPool.length,
      eligiblePlayerCount: historyPlayers.length,
      excludedActiveTenDayCount: activeTenDayPlayers.length,
      rules: [
        'All-time history uses the official NBA historical player index for the same season snapshot.',
        'Active 10-day contract players are excluded from the shared current-day pool.',
        'Historical players are enriched with official draft history, franchise lineage, and award data where the cached responses are available.',
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
    },
    excludedTenDayPlayers: activeTenDayPlayers,
    players: historyPlayers,
  }

  await mkdir(outputDirectory, { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(playerPool, null, 2)}\n`, 'utf8')
  await writeFile(historyOutputPath, `${JSON.stringify(historyPlayerPool, null, 2)}\n`, 'utf8')
  await writeFile(imageFallbackPath, `${JSON.stringify(imageFallbackManifest, null, 2)}\n`, 'utf8')
  flushFailedRequestSummary()

  console.log(
    `Wrote ${eligiblePlayers.length} current players to ${outputPath}. Wrote ${historyPlayers.length} history players to ${historyOutputPath}. Excluded ${activeTenDayPlayers.length} active 10-day contracts. Built ${Object.keys(imageFallbackManifest.fallbacks).length} 2KRatings fallback images.`,
  )
}

void main()
