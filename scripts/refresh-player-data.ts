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
const BIO_STATS_SOURCE =
  'https://stats.nba.com/stats/leaguedashplayerbiostats?College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear=&GameScope=&GameSegment=&Height=&LastNGames=0&LeagueID=00&Location=&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season={season}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&StarterBench=&TeamID=0&VsConference=&VsDivision=&Weight='
const TRANSACTION_SOURCE = 'https://stats.nba.com/js/data/playermovement/NBA_Player_Movement.json'
const SCHEDULE_SOURCE = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json'
const STANDINGS_SOURCE =
  'https://stats.nba.com/stats/leaguestandingsv3?LeagueID=00&Season={season}&SeasonType=Regular%20Season'
const DRAFT_HISTORY_SOURCE =
  'https://stats.nba.com/stats/drafthistory?LeagueID=00&SeasonYear={year}'
const FRANCHISE_PLAYERS_SOURCE =
  'https://stats.nba.com/stats/franchiseplayers?LeagueID=00&TeamID={teamId}&PerMode=PerGame'
const ALL_STAR_ROSTER_SOURCE = 'https://www.nba.com/allstar/{year}/roster'

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

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
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
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < 5; attempt += 1) {
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
): Promise<string> {
  let lastError: unknown

  for (let attempt = 0; attempt < 5; attempt += 1) {
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
): Promise<T | null> {
  try {
    return await fetchJson<T>(url, headers, timeoutMs)
  } catch (error) {
    console.warn(`Skipping failed request: ${url}`, error)
    return null
  }
}

async function fetchTextOrNull(
  url: string,
  headers: Record<string, string> = NBA_HEADERS,
  timeoutMs = 12000,
): Promise<string | null> {
  try {
    return await fetchText(url, headers, timeoutMs)
  } catch (error) {
    console.warn(`Skipping failed request: ${url}`, error)
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
): Promise<T | null> {
  const cached = await readCachedJson<T>(cachePath)

  if (cached) {
    return cached
  }

  const response = await fetchJsonOrNull<T>(url, headers, timeoutMs)

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
): Promise<string | null> {
  const cached = await readCachedText(cachePath)

  if (cached) {
    return cached
  }

  const response = await fetchTextOrNull(url, headers, timeoutMs)

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
    playoffPicture: standingSnapshot?.playoffPicture ?? null,
    playoffRank: standingSnapshot?.playoffRank ?? null,
    accoladeLabel: null,
  }
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

function normalizePlayer(
  row: Record<string, ResultValue>,
  ageMap: Map<number, number>,
  standingMap: Map<number, StandingSnapshot>,
  seasonStartYear: number,
): PlayerRecord | null {
  const teamId = parseIntegerValue(row.TEAM_ID)
  const rosterStatus = parseIntegerValue(row.ROSTER_STATUS)

  if (teamId === null || teamId === 0 || rosterStatus !== 1) {
    return null
  }

  const team = TEAM_BY_ID.get(teamId)
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
  const player: PlayerRecord = {
    id: playerId,
    slug: String(row.PLAYER_SLUG ?? '').trim(),
    displayName,
    firstName,
    lastName,
    teamId: team.id,
    teamAbbreviation: team.abbreviation,
    teamName: `${team.city} ${team.name}`,
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
      preNbaPath: college,
      careerTeamIds: [team.id],
      careerTeamAbbreviations: [team.abbreviation],
      careerTeamNames: [`${team.city} ${team.name}`],
      previousTeamIds: [],
      previousTeamAbbreviations: [],
      previousTeamNames: [],
      allStarAppearances: 0,
    },
    snapshot: buildBaseSnapshot(row, standingMap.get(team.id)),
    flags: {
      isRookie: debutYear === seasonStartYear,
      isInternational: false,
      isAllStar: false,
      isUnder25: false,
    },
    searchText: buildSearchText([
      displayName,
      team.abbreviation,
      team.city,
      team.name,
      position,
      country,
    ]),
  }

  player.flags = buildThemeFlags(player, seasonStartYear, false)
  return player
}

function buildAccoladeLabel(
  isCurrentAllStar: boolean,
  draft: DraftDetails,
  allStarYear: number,
): string | null {
  if (isCurrentAllStar) {
    return `${allStarYear} All-Star`
  }

  if (draft.pick === 1) {
    return 'Former No. 1 overall pick'
  }

  if (draft.pick !== null && draft.pick <= 5) {
    return 'Former top-five pick'
  }

  if (draft.pick !== null && draft.pick <= 14) {
    return 'Former lottery pick'
  }

  return null
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
  careerTeamIds: number[],
  currentAllStarIds: Set<number>,
  seasonStartYear: number,
  allStarYear: number,
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
  const enrichedPlayer: PlayerRecord = {
    ...player,
    draft,
    career: {
      ...player.career,
      careerTeamIds: uniqueCareerTeamIds,
      careerTeamAbbreviations: careerTeams.map((team) => team.abbreviation),
      careerTeamNames: careerTeams.map((team) => `${team.city} ${team.name}`),
      previousTeamIds,
      previousTeamAbbreviations: previousTeams.map((team) => team.abbreviation),
      previousTeamNames: previousTeams.map((team) => `${team.city} ${team.name}`),
      allStarAppearances: isCurrentAllStar ? 1 : 0,
    },
    snapshot: {
      ...player.snapshot,
      accoladeLabel: buildAccoladeLabel(isCurrentAllStar, draft, allStarYear),
    },
  }

  enrichedPlayer.flags = buildThemeFlags(enrichedPlayer, seasonStartYear, isCurrentAllStar)
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
  const [playerIndexResponse, bioStatsResponse, scheduleResponse, movementResponse, standingsResponse] =
    await Promise.all([
      fetchJson<ResultSetResponse>(PLAYER_INDEX_SOURCE.replace('{season}', season), NBA_HEADERS, 30000),
      fetchJson<ResultSetResponse>(BIO_STATS_SOURCE.replace('{season}', season), NBA_HEADERS, 30000),
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
  const standingMap = buildStandingMap(mapRows(standingsResponse, 'Standings'))
  const rosterRows = mapRows(playerIndexResponse, 'PlayerIndex')
  const rosterPlayers = rosterRows
    .map((row) => normalizePlayer(row, ageMap, standingMap, seasonStartYear))
    .filter((player): player is PlayerRecord => player !== null)
  const games = scheduleResponse.leagueSchedule.gameDates.flatMap((date) => date.games)
  const activeTenDayPlayers = deriveActiveTenDayContracts(
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
  const baseEligiblePlayers = rosterPlayers.filter((player) => !excludedIds.has(player.id))
  const eligiblePlayerIds = new Set(baseEligiblePlayers.map((player) => player.id))
  const draftYears = [...new Set(baseEligiblePlayers.map((player) => player.draft.year).filter(isPresent))]

  const draftPayloads = await mapWithConcurrency(draftYears, 4, async (year) => {
    const response = await fetchJsonWithCache<ResultSetResponse>(
      DRAFT_HISTORY_SOURCE.replace('{year}', `${year}`),
      path.join(cacheDirectory, 'draft-history', `${year}.json`),
      NBA_HEADERS,
      15000,
    )

    return [year, response] as const
  })

  const franchisePayloads = await mapWithConcurrency(TEAM_METADATA, 4, async (team) => {
    const response = await fetchJsonWithCache<ResultSetResponse>(
      FRANCHISE_PLAYERS_SOURCE.replace('{teamId}', `${team.id}`),
      path.join(cacheDirectory, 'franchise-players', `${team.id}.json`),
      NBA_HEADERS,
      20000,
    )

    return [team.id, response] as const
  })

  const allStarRosterHtml = await fetchTextWithCache(
    ALL_STAR_ROSTER_SOURCE.replace('{year}', `${allStarYear}`),
    path.join(cacheDirectory, 'all-star', `${allStarYear}.html`),
    {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/html,application/xhtml+xml',
    },
    15000,
  )
  const currentAllStarIds = allStarRosterHtml ? extractAllStarPlayerIds(allStarRosterHtml) : new Set<number>()
  const draftByPlayerId = new Map<number, Record<string, ResultValue>>()

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

  const careerTeamMap = new Map<number, Set<number>>()

  for (const player of baseEligiblePlayers) {
    careerTeamMap.set(player.id, new Set([player.teamId]))
  }

  for (const [teamId, response] of franchisePayloads) {
    if (!response) {
      continue
    }

    for (const row of mapRows(response)) {
      const playerId = parseIntegerValue(row.PERSON_ID)

      if (playerId !== null && eligiblePlayerIds.has(playerId)) {
        careerTeamMap.get(playerId)?.add(teamId)
      }
    }
  }

  const eligiblePlayers = baseEligiblePlayers
    .map((player) =>
      applyExtendedData(
        player,
        draftByPlayerId.get(player.id),
        [...(careerTeamMap.get(player.id) ?? new Set<number>())],
        currentAllStarIds,
        seasonStartYear,
        allStarYear,
      ),
    )
    .toSorted((left, right) => left.displayName.localeCompare(right.displayName))

  const playerPool: PlayerPoolData = {
    schemaVersion: 2,
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
      rosterPlayerCount: rosterPlayers.length,
      eligiblePlayerCount: eligiblePlayers.length,
      excludedActiveTenDayCount: activeTenDayPlayers.length,
      rules: [
        'Only current NBA roster rows with ROSTER_STATUS = 1 are eligible.',
        'Players on active 10-day contracts are excluded using transaction and schedule data.',
        'Guess lists and mystery-player pools are generated from the same eligible player set.',
      ],
    },
    sources: {
      rosters: PLAYER_INDEX_SOURCE.replace('{season}', season),
      bioStats: BIO_STATS_SOURCE.replace('{season}', season),
      transactions: TRANSACTION_SOURCE,
      schedule: SCHEDULE_SOURCE,
      standings: STANDINGS_SOURCE.replace('{season}', season),
      draftHistory: DRAFT_HISTORY_SOURCE,
      franchisePlayers: FRANCHISE_PLAYERS_SOURCE,
      allStarRoster: ALL_STAR_ROSTER_SOURCE.replace('{year}', `${allStarYear}`),
    },
    excludedTenDayPlayers: activeTenDayPlayers,
    players: eligiblePlayers,
  }

  const outputDirectory = path.resolve(currentFileDirectory, '../src/data/generated')
  const outputPath = path.join(outputDirectory, 'player-pool.json')

  await mkdir(outputDirectory, { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(playerPool, null, 2)}\n`, 'utf8')

  console.log(
    `Wrote ${eligiblePlayers.length} eligible players to ${outputPath}. Excluded ${activeTenDayPlayers.length} active 10-day contracts.`,
  )
}

void main()
