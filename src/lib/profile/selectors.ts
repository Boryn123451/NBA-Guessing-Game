import { DIFFICULTY_DEFINITIONS } from '../nba/difficulty'
import type {
  DifficultyId,
  DifficultyStats,
  GameMode,
  ModeStats,
  ProgressionState,
} from '../nba/types'

export interface CombinedProfileStats {
  overall: ModeStats
  daily: ModeStats
  practice: ModeStats
  byDifficulty: Record<DifficultyId, ModeStats>
}

function combineModeStatsRows(rows: ModeStats[]): ModeStats {
  return rows.reduce<ModeStats>(
    (total, row) => ({
      gamesPlayed: total.gamesPlayed + row.gamesPlayed,
      wins: total.wins + row.wins,
      losses: total.losses + row.losses,
      currentStreak: Math.max(total.currentStreak, row.currentStreak),
      maxStreak: Math.max(total.maxStreak, row.maxStreak),
      totalCompletedGuesses: total.totalCompletedGuesses + row.totalCompletedGuesses,
      totalWinningGuesses: total.totalWinningGuesses + row.totalWinningGuesses,
    }),
    {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      maxStreak: 0,
      totalCompletedGuesses: 0,
      totalWinningGuesses: 0,
    },
  )
}

function combineDifficultyStatsRows(
  stats: Record<GameMode, DifficultyStats>,
  difficultyId: DifficultyId,
): ModeStats {
  return combineModeStatsRows([
    stats.daily.byDifficulty[difficultyId],
    stats.practice.byDifficulty[difficultyId],
  ])
}

export function getCombinedProfileStats(
  stats: Record<GameMode, DifficultyStats>,
): CombinedProfileStats {
  return {
    overall: combineModeStatsRows([stats.daily.overall, stats.practice.overall]),
    daily: stats.daily.overall,
    practice: stats.practice.overall,
    byDifficulty: Object.fromEntries(
      DIFFICULTY_DEFINITIONS.map((difficulty) => [
        difficulty.id,
        combineDifficultyStatsRows(stats, difficulty.id),
      ]),
    ) as Record<DifficultyId, ModeStats>,
  }
}

export function getUnlockedBadgeIds(progression: ProgressionState) {
  return Object.keys(progression.badges) as (keyof ProgressionState['badges'])[]
}

export function getCompletedQuestCount(progression: ProgressionState): number {
  return progression.weeklyQuests.quests.filter((quest) => quest.completedAt !== null).length
}
