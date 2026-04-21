import { getDetectedTimeZone } from './nba/daily'
import { DEFAULT_DIFFICULTY_ID, sanitizeDifficultyId } from './nba/difficulty'
import {
  DEFAULT_GAME_VARIANT,
  getDailySessionKey,
  getVariantKey,
} from './nba/variant'
import type {
  ClueMode,
  DifficultyId,
  DifficultyStats,
  EventModeId,
  GameMode,
  LocalProfile,
  ModeStats,
  PersistedState,
  PlayerThemeId,
  ProgressionState,
  StoredGameSession,
  ThemeMode,
  UnitSystem,
} from './nba/types'
import { createLocalProfile, sanitizeDisplayName } from './profile/profile'
import { createDefaultProgressionState } from './profile/progression'

const STORAGE_KEY = 'full-court-cipher:v4'
const LEGACY_STORAGE_KEY_V3 = 'full-court-cipher:v3'
const LEGACY_STORAGE_KEY_V2 = 'full-court-cipher:v2'
const LEGACY_STORAGE_KEY_V1 = 'full-court-cipher:v1'
const LEGACY_MAX_GUESSES = 8

interface LegacyModeStats {
  gamesPlayed?: unknown
  wins?: unknown
  losses?: unknown
  currentStreak?: unknown
  maxStreak?: unknown
  totalWinningGuesses?: unknown
  totalCompletedGuesses?: unknown
}

interface LegacyPersistedStateV1 {
  version?: unknown
  preferredMode?: unknown
  settings?: {
    units?: unknown
    theme?: unknown
  }
  dailySessions?: Record<string, unknown>
  practiceSession?: unknown
  stats?: {
    daily?: LegacyModeStats
    practice?: LegacyModeStats
  }
}

interface LegacyPersistedStateV2 {
  version?: unknown
  preferences?: {
    mode?: unknown
    clueMode?: unknown
    themeId?: unknown
  }
  settings?: {
    units?: unknown
    theme?: unknown
  }
  dailySessions?: Record<string, unknown>
  practiceSessions?: Record<string, unknown>
  stats?: {
    daily?: LegacyModeStats
    practice?: LegacyModeStats
  }
}

interface LegacyPersistedStateV3 {
  version?: unknown
  preferences?: {
    mode?: unknown
    clueMode?: unknown
    themeId?: unknown
    difficulty?: unknown
  }
  settings?: {
    units?: unknown
    theme?: unknown
  }
  dailySessions?: Record<string, unknown>
  practiceSessions?: Record<string, unknown>
  stats?: {
    daily?: unknown
    practice?: unknown
  }
}

function createEmptyStats(): ModeStats {
  return {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    currentStreak: 0,
    maxStreak: 0,
    totalCompletedGuesses: 0,
    totalWinningGuesses: 0,
  }
}

function createEmptyDifficultyStats(): DifficultyStats {
  return {
    overall: createEmptyStats(),
    byDifficulty: {
      easy: createEmptyStats(),
      medium: createEmptyStats(),
      hard: createEmptyStats(),
      impossible: createEmptyStats(),
      'elite-ball-knowledge': createEmptyStats(),
    },
  }
}

export function createSession(targetPlayerId: number): StoredGameSession {
  return {
    targetPlayerId,
    guessIds: [],
    status: 'in_progress',
    completedAt: null,
    revealedBonusClueIds: [],
    silhouetteRevealed: false,
  }
}

function sanitizeUnits(units: unknown): UnitSystem {
  return units === 'metric' ? 'metric' : 'imperial'
}

function sanitizeTheme(theme: unknown): ThemeMode {
  return theme === 'light' || theme === 'dark' ? theme : 'system'
}

function sanitizeMode(mode: unknown): GameMode {
  return mode === 'practice' ? 'practice' : 'daily'
}

function sanitizeClueMode(clueMode: unknown): ClueMode {
  return clueMode === 'career' ? 'career' : 'standard'
}

function sanitizeThemeId(themeId: unknown): PlayerThemeId {
  switch (themeId) {
    case 'rookies':
    case 'international':
    case 'all-stars':
    case 'under-25':
      return themeId
    default:
      return 'classic'
  }
}

function sanitizeEventId(eventId: unknown): EventModeId | null {
  switch (eventId) {
    case 'opening-week':
    case 'christmas-games':
    case 'all-star-weekend':
    case 'trade-deadline-week':
    case 'playoff-mode':
    case 'finals-mode':
    case 'awards-season':
    case 'draft-week':
      return eventId
    default:
      return null
  }
}

function sanitizeDifficultyStatsKey(
  byDifficulty: Partial<Record<DifficultyId, unknown>> | undefined,
  difficultyId: DifficultyId,
): ModeStats {
  return sanitizeStats(byDifficulty?.[difficultyId])
}

function sanitizeSession(session: unknown): StoredGameSession | null {
  if (!session || typeof session !== 'object') {
    return null
  }

  const value = session as Partial<StoredGameSession>

  if (
    typeof value.targetPlayerId !== 'number' ||
    !Array.isArray(value.guessIds) ||
    (value.status !== 'in_progress' && value.status !== 'won' && value.status !== 'lost')
  ) {
    return null
  }

  return {
    targetPlayerId: value.targetPlayerId,
    guessIds: value.guessIds.filter((guessId): guessId is number => typeof guessId === 'number'),
    status: value.status,
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : null,
    revealedBonusClueIds: Array.isArray(value.revealedBonusClueIds)
      ? value.revealedBonusClueIds.filter(
          (clueId): clueId is StoredGameSession['revealedBonusClueIds'][number] =>
            clueId === 'country' || clueId === 'draftTeam' || clueId === 'debutWindow',
        )
      : [],
    silhouetteRevealed: value.silhouetteRevealed === true,
  }
}

function sanitizeLegacyGuesses(stats: Partial<ModeStats>): number {
  const losses = typeof stats.losses === 'number' ? stats.losses : 0
  const totalWinningGuesses =
    typeof stats.totalWinningGuesses === 'number' ? stats.totalWinningGuesses : 0

  return totalWinningGuesses + losses * LEGACY_MAX_GUESSES
}

function sanitizeStats(stats: unknown): ModeStats {
  if (!stats || typeof stats !== 'object') {
    return createEmptyStats()
  }

  const value = stats as Partial<ModeStats>
  const totalWinningGuesses =
    typeof value.totalWinningGuesses === 'number' ? value.totalWinningGuesses : 0

  return {
    gamesPlayed: typeof value.gamesPlayed === 'number' ? value.gamesPlayed : 0,
    wins: typeof value.wins === 'number' ? value.wins : 0,
    losses: typeof value.losses === 'number' ? value.losses : 0,
    currentStreak: typeof value.currentStreak === 'number' ? value.currentStreak : 0,
    maxStreak: typeof value.maxStreak === 'number' ? value.maxStreak : 0,
    totalCompletedGuesses:
      typeof value.totalCompletedGuesses === 'number'
        ? value.totalCompletedGuesses
        : sanitizeLegacyGuesses(value),
    totalWinningGuesses,
  }
}

function sanitizeDifficultyStats(stats: unknown): DifficultyStats {
  if (!stats || typeof stats !== 'object') {
    return createEmptyDifficultyStats()
  }

  const value = stats as Partial<DifficultyStats>
  const byDifficulty = value.byDifficulty as Partial<Record<DifficultyId, unknown>> | undefined

  return {
    overall: sanitizeStats(value.overall),
    byDifficulty: {
      easy: sanitizeDifficultyStatsKey(byDifficulty, 'easy'),
      medium: sanitizeDifficultyStatsKey(byDifficulty, 'medium'),
      hard: sanitizeDifficultyStatsKey(byDifficulty, 'hard'),
      impossible: sanitizeDifficultyStatsKey(byDifficulty, 'impossible'),
      'elite-ball-knowledge': sanitizeDifficultyStatsKey(byDifficulty, 'elite-ball-knowledge'),
    },
  }
}

function sanitizeSessions(
  sessions: Record<string, unknown> | undefined,
): Record<string, StoredGameSession> {
  return Object.fromEntries(
    Object.entries(sessions ?? {})
      .map(([sessionKey, session]) => [sessionKey, sanitizeSession(session)])
      .filter((entry): entry is [string, StoredGameSession] => entry[1] !== null),
  )
}

function sanitizeProfile(profile: unknown, now: Date): LocalProfile {
  if (!profile || typeof profile !== 'object') {
    return createLocalProfile(now.toISOString())
  }

  const value = profile as Partial<LocalProfile>

  return {
    profileId:
      typeof value.profileId === 'string' && value.profileId.trim().length > 0
        ? value.profileId
        : createLocalProfile(now.toISOString()).profileId,
    displayName: sanitizeDisplayName(value.displayName),
    createdAt:
      typeof value.createdAt === 'string' && value.createdAt.length > 0
        ? value.createdAt
        : now.toISOString(),
    reputationPoints:
      typeof value.reputationPoints === 'number' ? value.reputationPoints : 0,
  }
}

function sanitizeProgression(
  progression: unknown,
  now: Date,
  timeZone: string,
): ProgressionState {
  const fallback = createDefaultProgressionState(now, timeZone)

  if (!progression || typeof progression !== 'object') {
    return fallback
  }

  const value = progression as Partial<ProgressionState>
  const records = value.records ?? fallback.records
  const streaks = value.streaks ?? fallback.streaks

  return {
    badges:
      value.badges && typeof value.badges === 'object'
        ? (value.badges as ProgressionState['badges'])
        : fallback.badges,
    weeklyQuests:
      value.weeklyQuests &&
      typeof value.weeklyQuests === 'object' &&
      typeof value.weeklyQuests.weekId === 'string' &&
      Array.isArray(value.weeklyQuests.quests)
        ? {
            weekId: value.weeklyQuests.weekId,
            generatedAt:
              typeof value.weeklyQuests.generatedAt === 'string'
                ? value.weeklyQuests.generatedAt
                : fallback.weeklyQuests.generatedAt,
            currentWinStreak:
              typeof value.weeklyQuests.currentWinStreak === 'number'
                ? value.weeklyQuests.currentWinStreak
                : 0,
            quests: value.weeklyQuests.quests.filter(
              (quest): quest is ProgressionState['weeklyQuests']['quests'][number] =>
                Boolean(quest) &&
                typeof quest.id === 'string' &&
                typeof quest.title === 'string' &&
                typeof quest.description === 'string' &&
                typeof quest.target === 'number' &&
                typeof quest.rewardPoints === 'number' &&
                typeof quest.progress === 'number',
            ),
          }
        : fallback.weeklyQuests,
    records: {
      bestSolveByDifficulty: {
        easy:
          typeof records.bestSolveByDifficulty?.easy === 'number'
            ? records.bestSolveByDifficulty.easy
            : null,
        medium:
          typeof records.bestSolveByDifficulty?.medium === 'number'
            ? records.bestSolveByDifficulty.medium
            : null,
        hard:
          typeof records.bestSolveByDifficulty?.hard === 'number'
            ? records.bestSolveByDifficulty.hard
            : null,
        impossible:
          typeof records.bestSolveByDifficulty?.impossible === 'number'
            ? records.bestSolveByDifficulty.impossible
            : null,
        'elite-ball-knowledge':
          typeof records.bestSolveByDifficulty?.['elite-ball-knowledge'] === 'number'
            ? records.bestSolveByDifficulty['elite-ball-knowledge']
            : null,
      },
      longestWinStreak:
        typeof records.longestWinStreak === 'number' ? records.longestWinStreak : 0,
      bestDailyStreak:
        typeof records.bestDailyStreak === 'number' ? records.bestDailyStreak : 0,
      bestEventSolveByEvent:
        records.bestEventSolveByEvent && typeof records.bestEventSolveByEvent === 'object'
          ? records.bestEventSolveByEvent
          : {},
      eventWinsByEvent:
        records.eventWinsByEvent && typeof records.eventWinsByEvent === 'object'
          ? records.eventWinsByEvent
          : {},
    },
    streaks: {
      currentOverall:
        typeof streaks.currentOverall === 'number' ? streaks.currentOverall : 0,
      maxOverall: typeof streaks.maxOverall === 'number' ? streaks.maxOverall : 0,
      currentDaily: typeof streaks.currentDaily === 'number' ? streaks.currentDaily : 0,
      maxDaily: typeof streaks.maxDaily === 'number' ? streaks.maxDaily : 0,
      lastDailyWinDate:
        typeof streaks.lastDailyWinDate === 'string' ? streaks.lastDailyWinDate : null,
    },
    dailyWinDateKeys: Array.isArray(value.dailyWinDateKeys)
      ? value.dailyWinDateKeys.filter(
          (dateKey): dateKey is string => typeof dateKey === 'string',
        )
      : [],
    pendingCelebrations: Array.isArray(value.pendingCelebrations)
      ? value.pendingCelebrations.filter(
          (celebration): celebration is ProgressionState['pendingCelebrations'][number] =>
            Boolean(celebration) &&
            typeof celebration.id === 'string' &&
            typeof celebration.title === 'string' &&
            typeof celebration.body === 'string' &&
            typeof celebration.createdAt === 'string' &&
            (celebration.type === 'badge' ||
              celebration.type === 'quest' ||
              celebration.type === 'record'),
        )
      : [],
  }
}

function migrateLegacyStats(stats: LegacyModeStats | undefined): DifficultyStats {
  const legacyStats = sanitizeStats(stats)

  return {
    overall: legacyStats,
    byDifficulty: {
      easy: createEmptyStats(),
      medium: legacyStats,
      hard: createEmptyStats(),
      impossible: createEmptyStats(),
      'elite-ball-knowledge': createEmptyStats(),
    },
  }
}

function migrateV3SessionKey(sessionKey: string): string {
  const parts = sessionKey.split(':')

  if (/^\d{4}-\d{2}-\d{2}$/.test(parts[0] ?? '')) {
    const [dateKey, clueMode, themeId, difficultyId] = parts
    return [dateKey, clueMode, themeId, 'none', difficultyId].join(':')
  }

  if (parts.length === 3) {
    const [clueMode, themeId, difficultyId] = parts
    return [clueMode, themeId, 'none', difficultyId].join(':')
  }

  return sessionKey
}

export function createDefaultState(
  now: Date = new Date(),
  timeZone = getDetectedTimeZone(),
): PersistedState {
  return {
    version: 4,
    preferences: {
      mode: 'daily',
      clueMode: DEFAULT_GAME_VARIANT.clueMode,
      themeId: DEFAULT_GAME_VARIANT.themeId,
      difficulty: DEFAULT_DIFFICULTY_ID,
      eventId: null,
    },
    settings: {
      units: 'imperial',
      theme: 'system',
    },
    profile: createLocalProfile(now.toISOString()),
    progression: createDefaultProgressionState(now, timeZone),
    dailySessions: {},
    practiceSessions: {},
    stats: {
      daily: createEmptyDifficultyStats(),
      practice: createEmptyDifficultyStats(),
    },
  }
}

function migrateLegacyStateV1(
  parsed: LegacyPersistedStateV1,
  now: Date,
  timeZone: string,
): PersistedState {
  const dailySessions = Object.fromEntries(
    Object.entries(parsed.dailySessions ?? {})
      .map(([dateKey, session]) => [
        getDailySessionKey(dateKey, DEFAULT_GAME_VARIANT, DEFAULT_DIFFICULTY_ID),
        sanitizeSession(session),
      ])
      .filter((entry): entry is [string, StoredGameSession] => entry[1] !== null),
  )
  const practiceSession = sanitizeSession(parsed.practiceSession)

  return {
    version: 4,
    preferences: {
      mode: sanitizeMode(parsed.preferredMode),
      clueMode: DEFAULT_GAME_VARIANT.clueMode,
      themeId: DEFAULT_GAME_VARIANT.themeId,
      difficulty: DEFAULT_DIFFICULTY_ID,
      eventId: null,
    },
    settings: {
      units: sanitizeUnits(parsed.settings?.units),
      theme: sanitizeTheme(parsed.settings?.theme),
    },
    profile: createLocalProfile(now.toISOString()),
    progression: createDefaultProgressionState(now, timeZone),
    dailySessions,
    practiceSessions: practiceSession
      ? { [getVariantKey(DEFAULT_GAME_VARIANT) + `:${DEFAULT_DIFFICULTY_ID}`]: practiceSession }
      : {},
    stats: {
      daily: migrateLegacyStats(parsed.stats?.daily),
      practice: migrateLegacyStats(parsed.stats?.practice),
    },
  }
}

function migrateLegacyStateV2(
  parsed: LegacyPersistedStateV2,
  now: Date,
  timeZone: string,
): PersistedState {
  return {
    version: 4,
    preferences: {
      mode: sanitizeMode(parsed.preferences?.mode),
      clueMode: sanitizeClueMode(parsed.preferences?.clueMode),
      themeId: sanitizeThemeId(parsed.preferences?.themeId),
      difficulty: DEFAULT_DIFFICULTY_ID,
      eventId: null,
    },
    settings: {
      units: sanitizeUnits(parsed.settings?.units),
      theme: sanitizeTheme(parsed.settings?.theme),
    },
    profile: createLocalProfile(now.toISOString()),
    progression: createDefaultProgressionState(now, timeZone),
    dailySessions: Object.fromEntries(
      Object.entries(sanitizeSessions(parsed.dailySessions)).map(([sessionKey, session]) => [
        `${sessionKey}:${DEFAULT_DIFFICULTY_ID}`,
        session,
      ]),
    ),
    practiceSessions: Object.fromEntries(
      Object.entries(sanitizeSessions(parsed.practiceSessions)).map(([sessionKey, session]) => [
        `${sessionKey}:${DEFAULT_DIFFICULTY_ID}`,
        session,
      ]),
    ),
    stats: {
      daily: migrateLegacyStats(parsed.stats?.daily),
      practice: migrateLegacyStats(parsed.stats?.practice),
    },
  }
}

function migrateLegacyStateV3(
  parsed: LegacyPersistedStateV3,
  now: Date,
  timeZone: string,
): PersistedState {
  return {
    version: 4,
    preferences: {
      mode: sanitizeMode(parsed.preferences?.mode),
      clueMode: sanitizeClueMode(parsed.preferences?.clueMode),
      themeId: sanitizeThemeId(parsed.preferences?.themeId),
      difficulty: sanitizeDifficultyId(parsed.preferences?.difficulty),
      eventId: null,
    },
    settings: {
      units: sanitizeUnits(parsed.settings?.units),
      theme: sanitizeTheme(parsed.settings?.theme),
    },
    profile: createLocalProfile(now.toISOString()),
    progression: createDefaultProgressionState(now, timeZone),
    dailySessions: Object.fromEntries(
      Object.entries(sanitizeSessions(parsed.dailySessions)).map(([sessionKey, session]) => [
        migrateV3SessionKey(sessionKey),
        session,
      ]),
    ),
    practiceSessions: Object.fromEntries(
      Object.entries(sanitizeSessions(parsed.practiceSessions)).map(([sessionKey, session]) => [
        migrateV3SessionKey(sessionKey),
        session,
      ]),
    ),
    stats: {
      daily: sanitizeDifficultyStats(parsed.stats?.daily),
      practice: sanitizeDifficultyStats(parsed.stats?.practice),
    },
  }
}

export function coercePersistedState(
  parsed: unknown,
  now: Date = new Date(),
  timeZone = getDetectedTimeZone(),
): PersistedState {
  if (!parsed || typeof parsed !== 'object') {
    return createDefaultState(now, timeZone)
  }

  const value = parsed as Partial<PersistedState> &
    LegacyPersistedStateV1 &
    LegacyPersistedStateV2 &
    LegacyPersistedStateV3

  if (value.version === 4) {
    return {
      version: 4,
      preferences: {
        mode: sanitizeMode(value.preferences?.mode),
        clueMode: sanitizeClueMode(value.preferences?.clueMode),
        themeId: sanitizeThemeId(value.preferences?.themeId),
        difficulty: sanitizeDifficultyId(value.preferences?.difficulty),
        eventId: sanitizeEventId(value.preferences?.eventId),
      },
      settings: {
        units: sanitizeUnits(value.settings?.units),
        theme: sanitizeTheme(value.settings?.theme),
      },
      profile: sanitizeProfile(value.profile, now),
      progression: sanitizeProgression(value.progression, now, timeZone),
      dailySessions: sanitizeSessions(value.dailySessions),
      practiceSessions: sanitizeSessions(value.practiceSessions),
      stats: {
        daily: sanitizeDifficultyStats(value.stats?.daily),
        practice: sanitizeDifficultyStats(value.stats?.practice),
      },
    }
  }

  if (value.version === 3) {
    return migrateLegacyStateV3(value as LegacyPersistedStateV3, now, timeZone)
  }

  if (value.version === 2) {
    return migrateLegacyStateV2(value as LegacyPersistedStateV2, now, timeZone)
  }

  if (value.version === 1) {
    return migrateLegacyStateV1(value as LegacyPersistedStateV1, now, timeZone)
  }

  return createDefaultState(now, timeZone)
}

function safeStorageGet(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const probeKey = '__fcc-storage-probe__'
    window.localStorage.setItem(probeKey, '1')
    window.localStorage.removeItem(probeKey)
    return true
  } catch {
    return false
  }
}

export function loadPersistedState(): PersistedState {
  const now = new Date()
  const timeZone = getDetectedTimeZone()

  if (typeof window === 'undefined') {
    return createDefaultState(now, timeZone)
  }

  try {
    const rawValue =
      safeStorageGet(STORAGE_KEY) ??
      safeStorageGet(LEGACY_STORAGE_KEY_V3) ??
      safeStorageGet(LEGACY_STORAGE_KEY_V2) ??
      safeStorageGet(LEGACY_STORAGE_KEY_V1)

    if (!rawValue) {
      return createDefaultState(now, timeZone)
    }

    return coercePersistedState(JSON.parse(rawValue), now, timeZone)
  } catch {
    return createDefaultState(now, timeZone)
  }
}

export function savePersistedState(state: PersistedState): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can be blocked on GitHub Pages or in strict browser modes.
  }
}

function recordModeStats(stats: ModeStats, session: StoredGameSession): ModeStats {
  const didWin = session.status === 'won'
  const nextCurrentStreak = didWin ? stats.currentStreak + 1 : 0

  return {
    gamesPlayed: stats.gamesPlayed + 1,
    wins: stats.wins + (didWin ? 1 : 0),
    losses: stats.losses + (didWin ? 0 : 1),
    currentStreak: nextCurrentStreak,
    maxStreak: Math.max(stats.maxStreak, nextCurrentStreak),
    totalCompletedGuesses: stats.totalCompletedGuesses + session.guessIds.length,
    totalWinningGuesses: stats.totalWinningGuesses + (didWin ? session.guessIds.length : 0),
  }
}

export function recordCompletedGame(
  stats: DifficultyStats,
  difficultyId: DifficultyId,
  session: StoredGameSession,
): DifficultyStats {
  return {
    overall: recordModeStats(stats.overall, session),
    byDifficulty: {
      ...stats.byDifficulty,
      [difficultyId]: recordModeStats(stats.byDifficulty[difficultyId], session),
    },
  }
}

export function getAverageGuesses(stats: ModeStats): string {
  if (stats.wins === 0) {
    return 'N/A'
  }

  return (stats.totalWinningGuesses / stats.wins).toFixed(1)
}

export function getWinRate(stats: ModeStats): string {
  if (stats.gamesPlayed === 0) {
    return '0%'
  }

  return `${Math.round((stats.wins / stats.gamesPlayed) * 100)}%`
}

export function getStoredSession(
  state: PersistedState,
  mode: GameMode,
  sessionKey: string,
): StoredGameSession | null {
  return mode === 'daily'
    ? state.dailySessions[sessionKey] ?? null
    : state.practiceSessions[sessionKey] ?? null
}

export function replaceModeSession(
  state: PersistedState,
  mode: GameMode,
  session: StoredGameSession,
  sessionKey: string,
): PersistedState {
  return mode === 'daily'
    ? {
        ...state,
        dailySessions: {
          ...state.dailySessions,
          [sessionKey]: session,
        },
      }
    : {
        ...state,
        practiceSessions: {
          ...state.practiceSessions,
          [sessionKey]: session,
        },
      }
}
