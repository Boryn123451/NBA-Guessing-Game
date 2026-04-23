export type Conference = 'East' | 'West' | 'Legacy'

export type Division =
  | 'Atlantic'
  | 'Central'
  | 'Southeast'
  | 'Northwest'
  | 'Pacific'
  | 'Southwest'
  | 'Legacy'

export type UnitSystem = 'imperial' | 'metric'

export type ThemeMode = 'system' | 'light' | 'dark'

export type GameMode = 'daily' | 'practice'

export type ClueMode = 'standard' | 'career' | 'draft'

export type PlayerPoolScopeId = 'current' | 'history'

export type EntryDecadeId =
  | '1950s'
  | '1960s'
  | '1970s'
  | '1980s'
  | '1990s'
  | '2000s'
  | '2010s'
  | '2020s'

export type DifficultyId =
  | 'easy'
  | 'medium'
  | 'hard'
  | 'impossible'
  | 'elite-ball-knowledge'

export type EventModeId =
  | 'opening-week'
  | 'christmas-games'
  | 'all-star-weekend'
  | 'trade-deadline-week'
  | 'playoff-mode'
  | 'finals-mode'
  | 'awards-season'
  | 'draft-week'

export type PlayerThemeId =
  | 'classic'
  | 'rookies'
  | 'international'
  | 'all-stars'
  | 'under-25'

export type RetroThemeId =
  | '1950s'
  | '1960s'
  | '1970s'
  | '1980s'
  | '1990s'
  | '2000s'
  | '2010s'
  | '2020s'

export type GameOutcome = 'in_progress' | 'won' | 'lost'

export type PositionToken = 'G' | 'F' | 'C'

export type ClueKey =
  | 'player'
  | 'team'
  | 'conference'
  | 'division'
  | 'position'
  | 'height'
  | 'age'
  | 'jerseyNumber'

export type ClueState = 'exact' | 'close' | 'miss' | 'unknown'

export type NumericDirection = 'up' | 'down' | null

export type BonusClueId = 'country' | 'draftTeam' | 'debutWindow'

export type BadgeId =
  | 'first-win'
  | 'three-day-streak'
  | 'seven-day-streak'
  | 'perfect-solve'
  | 'easy-crusher'
  | 'medium-grinder'
  | 'hard-winner'
  | 'impossible-solver'
  | 'elite-ball-knowledge-winner'
  | 'weekly-quest-completed'
  | 'event-mode-winner'

export type WeeklyQuestTemplateId =
  | 'win-three-games'
  | 'hard-or-above-win'
  | 'finish-two-dailies'
  | 'solve-in-five'
  | 'play-five-practice-rounds'
  | 'win-using-metric'
  | 'complete-event-round'
  | 'two-wins-in-a-row'

export interface TeamMetadata {
  id: number
  abbreviation: string
  city: string
  name: string
  slug: string
  conference: Conference
  division: Division
  colors: {
    primary: string
    accent: string
  }
}

export interface DraftDetails {
  year: number | null
  round: number | null
  pick: number | null
  teamId: number | null
  teamAbbreviation: string | null
  teamName: string | null
  isUndrafted: boolean
}

export type EntryDraftYearSource = 'draft' | 'undrafted-confirmed' | 'debut-fallback' | null

export interface CareerProfile {
  debutYear: number | null
  finalSeasonYear: number | null
  seasonsPlayed: number | null
  preNbaPath: string | null
  careerTeamIds: number[]
  careerTeamAbbreviations: string[]
  careerTeamNames: string[]
  previousTeamIds: number[]
  previousTeamAbbreviations: string[]
  previousTeamNames: string[]
  allStarAppearances: number
  allNbaSelections: number
  allDefensiveSelections: number
  championships: number
  finalsMvpAwards: number
  mvpAwards: number
  rookieOfTheYearAwards: number
  defensivePlayerOfTheYearAwards: number
  scoringTitles: number
  reboundTitles: number
  assistTitles: number
  isHallOfFame: boolean
  isGreatest75: boolean
  accolades: string[]
  primaryAccolade: string | null
  hasRichMetadata: boolean
}

export interface SeasonSnapshot {
  pointsPerGame: number | null
  reboundsPerGame: number | null
  assistsPerGame: number | null
  minutesPerGame: number | null
  playoffPicture: boolean | null
  playoffRank: number | null
  careerAccoladeLabel: string | null
}

export interface ThemeFlags {
  isRookie: boolean
  isInternational: boolean
  isAllStar: boolean
  isUnder25: boolean
}

export interface PlayerRecord {
  id: number
  slug: string
  displayName: string
  firstName: string
  lastName: string
  isCurrentPlayer: boolean
  isDefunctFranchise: boolean
  teamId: number
  teamAbbreviation: string
  teamName: string
  conference: Conference
  division: Division
  position: string
  positionTokens: PositionToken[]
  heightInInches: number | null
  heightCm: number | null
  currentAge: number | null
  birthDate: string | null
  jerseyNumber: number | null
  headshotUrl: string | null
  country: string | null
  college: string | null
  draft: DraftDetails
  entryDraftYear: number | null
  entryDraftYearSource: EntryDraftYearSource
  career: CareerProfile
  snapshot: SeasonSnapshot
  flags: ThemeFlags
  searchText: string
}

export interface PlayerImageFallbackManifest {
  schemaVersion: 1
  generatedAt: string
  source: string
  fallbacks: Record<string, string>
}

export interface ExcludedTenDayPlayer {
  id: number
  displayName: string
  teamId: number
  teamName: string
  contractStartDate: string
  contractEndDate: string
}

export interface RosterFreshnessMetadata {
  refreshedAt: string
  asOfDate: string
  season: string
}

export interface EligibilityMetadata {
  rosterStatusRequired: boolean
  transactionAwareTenDayExclusion: boolean
  rosterPlayerCount: number
  eligiblePlayerCount: number
  excludedActiveTenDayCount: number
  rules: string[]
}

export interface PlayerPoolData {
  schemaVersion: 4 | 5
  season: string
  refreshedAt: string
  asOfDate: string
  rosterFreshness: RosterFreshnessMetadata
  eligibility: EligibilityMetadata
  sources: {
    rosters: string
    bioStats: string
    transactions: string
    schedule: string
    standings: string
    advancedStats: string
    draftHistory: string
    franchisePlayers: string
    allStarRoster: string
    playerAwards: string
    commonPlayerInfo?: string
    basketballReference?: string
  }
  excludedTenDayPlayers: ExcludedTenDayPlayer[]
  players: PlayerRecord[]
}

export interface PlayerMovementRow {
  Transaction_Type: string
  TRANSACTION_DATE: string
  TRANSACTION_DESCRIPTION: string
  TEAM_ID: number
  TEAM_SLUG: string
  PLAYER_ID: number
  PLAYER_SLUG: string
  Additional_Sort: number
  GroupSort: string
}

export interface ScheduledGameTeam {
  teamId: number
  teamTricode?: string
}

export interface ScheduledGame {
  gameId: string
  gameDateTimeUTC?: string
  gameDateUTC: string
  gameLabel?: string
  homeTeam: ScheduledGameTeam
  awayTeam: ScheduledGameTeam
}

export interface GuessFeedback {
  status: ClueState
  direction: NumericDirection
}

export interface GuessResult {
  guess: PlayerRecord
  isCorrect: boolean
  clues: Record<ClueKey, GuessFeedback>
}

export interface GameVariant {
  playerPoolScope: PlayerPoolScopeId
  clueMode: ClueMode
  themeId: PlayerThemeId
  eventId: EventModeId | null
  includePostseason: boolean
  entryDecadeId: EntryDecadeId | null
}

export interface StoredGameSession {
  targetPlayerId: number
  guessIds: number[]
  status: GameOutcome
  completedAt: string | null
  revealedBonusClueIds: BonusClueId[]
  silhouetteRevealed: boolean
}

export interface ModeStats {
  gamesPlayed: number
  wins: number
  losses: number
  currentStreak: number
  maxStreak: number
  totalCompletedGuesses: number
  totalWinningGuesses: number
}

export interface DifficultyStats {
  overall: ModeStats
  byDifficulty: Record<DifficultyId, ModeStats>
}

export interface LocalProfile {
  profileId: string
  displayName: string
  createdAt: string
  points: number
  unlockedRetroThemeIds: RetroThemeId[]
}

export interface BadgeUnlock {
  unlockedAt: string
}

export interface WeeklyQuestProgress {
  id: string
  templateId: WeeklyQuestTemplateId
  title: string
  description: string
  target: number
  rewardPoints: number
  progress: number
  completedAt: string | null
  claimedAt: string | null
}

export interface WeeklyQuestBoard {
  weekId: string
  generatedAt: string
  currentWinStreak: number
  quests: WeeklyQuestProgress[]
}

export interface LocalRecords {
  bestSolveByDifficulty: Record<DifficultyId, number | null>
  longestWinStreak: number
  bestDailyStreak: number
  bestEventSolveByEvent: Partial<Record<EventModeId, number>>
  eventWinsByEvent: Partial<Record<EventModeId, number>>
}

export interface DailyHistoryEntry {
  dateKey: string
  completedAt: string
  didWin: boolean
  guessCount: number
  difficultyId: DifficultyId
  clueMode: ClueMode
  themeId: PlayerThemeId
  eventId: EventModeId | null
  entryDecadeId: EntryDecadeId | null
}

export interface LocalStreaks {
  currentOverall: number
  maxOverall: number
  currentDaily: number
  maxDaily: number
  lastDailyWinDate: string | null
}

export interface Celebration {
  id: string
  type: 'badge' | 'quest' | 'record' | 'status'
  title: string
  body: string
  createdAt: string
}

export interface ProgressionState {
  badges: Partial<Record<BadgeId, BadgeUnlock>>
  weeklyQuests: WeeklyQuestBoard
  records: LocalRecords
  streaks: LocalStreaks
  dailyWinDateKeys: string[]
  dailyHistory: DailyHistoryEntry[]
  pendingCelebrations: Celebration[]
}

export interface PersistedState {
  version: 6
  preferences: {
    mode: GameMode
    playerPoolScope: PlayerPoolScopeId
    clueMode: ClueMode
    themeId: PlayerThemeId
    difficulty: DifficultyId
    eventId: EventModeId | null
    practiceIncludePostseason: boolean
    entryDecadeId: EntryDecadeId | null
  }
  settings: {
    units: UnitSystem
    theme: ThemeMode
    retroThemeId: RetroThemeId
  }
  profile: LocalProfile
  progression: ProgressionState
  dailySessions: Record<string, StoredGameSession>
  practiceSessions: Record<string, StoredGameSession>
  stats: Record<GameMode, DifficultyStats>
}
