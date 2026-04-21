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
  GameMode,
  ModeStats,
  PersistedState,
  PlayerThemeId,
  StoredGameSession,
  ThemeMode,
  UnitSystem,
} from './nba/types'

const STORAGE_KEY = 'full-court-cipher:v3'
const LEGACY_STORAGE_KEY = 'full-court-cipher:v2'
const LEGACY_STORAGE_KEY_V1 = 'full-court-cipher:v1'
const LEGACY_MAX_GUESSES = 8

interface LegacyModeStats {
  gamesPlayed?: unknown
  wins?: unknown
  losses?: unknown
  currentStreak?: unknown
  maxStreak?: unknown
  totalWinningGuesses?: unknown
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

function migrateSessionKey(sessionKey: string): string {
  return `${sessionKey}:${DEFAULT_DIFFICULTY_ID}`
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

export function createDefaultState(): PersistedState {
  return {
    version: 3,
    preferences: {
      mode: 'daily',
      clueMode: DEFAULT_GAME_VARIANT.clueMode,
      themeId: DEFAULT_GAME_VARIANT.themeId,
      difficulty: DEFAULT_DIFFICULTY_ID,
    },
    settings: {
      units: 'imperial',
      theme: 'system',
    },
    dailySessions: {},
    practiceSessions: {},
    stats: {
      daily: createEmptyDifficultyStats(),
      practice: createEmptyDifficultyStats(),
    },
  }
}

function migrateLegacyStateV1(parsed: LegacyPersistedStateV1): PersistedState {
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
    version: 3,
    preferences: {
      mode: sanitizeMode(parsed.preferredMode),
      clueMode: DEFAULT_GAME_VARIANT.clueMode,
      themeId: DEFAULT_GAME_VARIANT.themeId,
      difficulty: DEFAULT_DIFFICULTY_ID,
    },
    settings: {
      units: sanitizeUnits(parsed.settings?.units),
      theme: sanitizeTheme(parsed.settings?.theme),
    },
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

function migrateLegacyStateV2(parsed: LegacyPersistedStateV2): PersistedState {
  return {
    version: 3,
    preferences: {
      mode: sanitizeMode(parsed.preferences?.mode),
      clueMode: sanitizeClueMode(parsed.preferences?.clueMode),
      themeId: sanitizeThemeId(parsed.preferences?.themeId),
      difficulty: DEFAULT_DIFFICULTY_ID,
    },
    settings: {
      units: sanitizeUnits(parsed.settings?.units),
      theme: sanitizeTheme(parsed.settings?.theme),
    },
    dailySessions: Object.fromEntries(
      Object.entries(sanitizeSessions(parsed.dailySessions)).map(([sessionKey, session]) => [
        migrateSessionKey(sessionKey),
        session,
      ]),
    ),
    practiceSessions: Object.fromEntries(
      Object.entries(sanitizeSessions(parsed.practiceSessions)).map(([sessionKey, session]) => [
        migrateSessionKey(sessionKey),
        session,
      ]),
    ),
    stats: {
      daily: migrateLegacyStats(parsed.stats?.daily),
      practice: migrateLegacyStats(parsed.stats?.practice),
    },
  }
}

function sanitizePersistedState(parsed: Partial<PersistedState>): PersistedState {
  return {
    version: 3,
    preferences: {
      mode: sanitizeMode(parsed.preferences?.mode),
      clueMode: sanitizeClueMode(parsed.preferences?.clueMode),
      themeId: sanitizeThemeId(parsed.preferences?.themeId),
      difficulty: sanitizeDifficultyId(parsed.preferences?.difficulty),
    },
    settings: {
      units: sanitizeUnits(parsed.settings?.units),
      theme: sanitizeTheme(parsed.settings?.theme),
    },
    dailySessions: sanitizeSessions(parsed.dailySessions),
    practiceSessions: sanitizeSessions(parsed.practiceSessions),
    stats: {
      daily: sanitizeDifficultyStats(parsed.stats?.daily),
      practice: sanitizeDifficultyStats(parsed.stats?.practice),
    },
  }
}

export function loadPersistedState(): PersistedState {
  if (typeof window === 'undefined') {
    return createDefaultState()
  }

  try {
    const rawValue =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY_V1)

    if (!rawValue) {
      return createDefaultState()
    }

    const parsed = JSON.parse(rawValue) as
      | Partial<PersistedState>
      | LegacyPersistedStateV1
      | LegacyPersistedStateV2

    if (parsed.version === 3) {
      return sanitizePersistedState(parsed as Partial<PersistedState>)
    }

    if (parsed.version === 2) {
      return migrateLegacyStateV2(parsed as LegacyPersistedStateV2)
    }

    if (parsed.version === 1) {
      return migrateLegacyStateV1(parsed as LegacyPersistedStateV1)
    }

    return createDefaultState()
  } catch {
    return createDefaultState()
  }
}

export function savePersistedState(state: PersistedState): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
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
  if (stats.gamesPlayed === 0) {
    return 'N/A'
  }

  return (stats.totalCompletedGuesses / stats.gamesPlayed).toFixed(1)
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
