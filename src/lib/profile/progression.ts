import { getBadgeDefinition, evaluateBadgeUnlocks } from './badges'
import { createEmptyLocalRecords, createEmptyLocalStreaks, updateLocalRecords, updateLocalStreaks } from './records'
import { createWeeklyQuestBoard, advanceWeeklyQuestBoard, claimWeeklyQuest, ensureWeeklyQuestBoard } from './weeklyQuests'
import type {
  BadgeId,
  Celebration,
  DifficultyStats,
  LocalProfile,
  ProgressionState,
  WeeklyQuestBoard,
} from '../nba/types'
import type { BadgeEvaluationContext } from './badges'
import type { RecordContext } from './records'
import type { WeeklyQuestContext } from './weeklyQuests'

function buildCelebration(
  type: Celebration['type'],
  title: string,
  body: string,
  createdAt: string,
): Celebration {
  return {
    id: `${type}:${createdAt}:${title.toLowerCase().replace(/\s+/g, '-')}`,
    type,
    title,
    body,
    createdAt,
  }
}

function combineWins(stats: Record<string, DifficultyStats>): number {
  return Object.values(stats).reduce((total, modeStats) => total + modeStats.overall.wins, 0)
}

export function createDefaultProgressionState(
  now: Date = new Date(),
  timeZone = 'UTC',
): ProgressionState {
  return {
    badges: {},
    weeklyQuests: createWeeklyQuestBoard(now, timeZone),
    records: createEmptyLocalRecords(),
    streaks: createEmptyLocalStreaks(),
    dailyWinDateKeys: [],
    pendingCelebrations: [],
  }
}

export function ensureProgressionState(
  progression: ProgressionState,
  now: Date = new Date(),
  timeZone = 'UTC',
): ProgressionState {
  return {
    ...progression,
    weeklyQuests: ensureWeeklyQuestBoard(progression.weeklyQuests, now, timeZone),
  }
}

export function applyCompletedRoundProgression(options: {
  profile: LocalProfile
  progression: ProgressionState
  stats: Record<string, DifficultyStats>
  context: RecordContext & WeeklyQuestContext
  now: Date
  timeZone: string
}): { profile: LocalProfile; progression: ProgressionState } {
  const { context, now, profile, stats, timeZone } = options
  const ensuredProgression = ensureProgressionState(options.progression, now, timeZone)
  const createdAt = now.toISOString()
  const streakResult = updateLocalStreaks(
    ensuredProgression.streaks,
    ensuredProgression.dailyWinDateKeys,
    context,
  )
  const recordResult = updateLocalRecords(ensuredProgression.records, streakResult.streaks, context)
  const questResult = advanceWeeklyQuestBoard(
    ensuredProgression.weeklyQuests,
    context,
    now,
    timeZone,
  )
  const badgeEvaluation: BadgeEvaluationContext = {
    totalWins: combineWins(stats),
    didWin: context.didWin,
    guessCount: context.guessCount,
    difficultyId: context.difficultyId,
    eventId: context.eventId,
    bestDailyStreak: Math.max(recordResult.records.bestDailyStreak, streakResult.streaks.maxDaily),
    weeklyQuestSetCompleted: questResult.allCompleted,
  }
  const unlockedBadgeIds = evaluateBadgeUnlocks(
    Object.keys(ensuredProgression.badges) as BadgeId[],
    badgeEvaluation,
  )
  const nextBadges = { ...ensuredProgression.badges }
  const badgeCelebrations = unlockedBadgeIds.map((badgeId) => {
    nextBadges[badgeId] = {
      unlockedAt: createdAt,
    }

    const definition = getBadgeDefinition(badgeId)

    return buildCelebration('badge', `Badge unlocked: ${definition.label}`, definition.description, createdAt)
  })
  const questCelebrations = questResult.completedQuestIds
    .map((questId) => questResult.board.quests.find((quest) => quest.id === questId))
    .filter((quest): quest is WeeklyQuestBoard['quests'][number] => Boolean(quest))
    .map((quest) =>
      buildCelebration('quest', `Quest complete: ${quest.title}`, `${quest.rewardPoints} rep ready to claim.`, createdAt),
    )
  const recordCelebrations = [...new Set([...streakResult.newRecordLabels, ...recordResult.newRecordLabels])]
    .map((label) => buildCelebration('record', 'New personal record', label, createdAt))

  return {
    profile,
    progression: {
      ...ensuredProgression,
      badges: nextBadges,
      weeklyQuests: questResult.board,
      records: recordResult.records,
      streaks: streakResult.streaks,
      dailyWinDateKeys: streakResult.dailyWinDateKeys,
      pendingCelebrations: [
        ...ensuredProgression.pendingCelebrations,
        ...questCelebrations,
        ...badgeCelebrations,
        ...recordCelebrations,
      ].slice(-10),
    },
  }
}

export function claimWeeklyQuestReward(options: {
  profile: LocalProfile
  progression: ProgressionState
  questId: string
  now: Date
  timeZone: string
}): { profile: LocalProfile; progression: ProgressionState } | null {
  const { now, progression, profile, questId, timeZone } = options
  const claimResult = claimWeeklyQuest(progression.weeklyQuests, questId, now, timeZone)

  if (!claimResult) {
    return null
  }

  const createdAt = now.toISOString()

  return {
    profile: {
      ...profile,
      reputationPoints: profile.reputationPoints + claimResult.rewardPoints,
    },
    progression: {
      ...progression,
      weeklyQuests: claimResult.board,
      pendingCelebrations: [
        ...progression.pendingCelebrations,
        buildCelebration(
          'quest',
          'Reward claimed',
          `+${claimResult.rewardPoints} reputation added to your local profile.`,
          createdAt,
        ),
      ].slice(-10),
    },
  }
}

export function dismissCelebration(
  progression: ProgressionState,
  celebrationId: string,
): ProgressionState {
  return {
    ...progression,
    pendingCelebrations: progression.pendingCelebrations.filter(
      (celebration) => celebration.id !== celebrationId,
    ),
  }
}

