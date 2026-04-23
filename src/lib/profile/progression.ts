import { getBadgeDefinition, evaluateBadgeUnlocks } from './badges'
import { createEmptyLocalRecords, createEmptyLocalStreaks, updateLocalRecords, updateLocalStreaks } from './records'
import { createWeeklyQuestBoard, advanceWeeklyQuestBoard, claimWeeklyQuest, ensureWeeklyQuestBoard } from './weeklyQuests'
import type {
  BadgeId,
  Celebration,
  DailyHistoryEntry,
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
  dedupeKey?: string,
): Celebration {
  return {
    id: `${type}:${(dedupeKey ?? `${title}:${body}`).toLowerCase().replace(/\s+/g, '-')}`,
    type,
    title,
    body,
    createdAt,
  }
}

function appendCelebrations(
  existing: Celebration[],
  incoming: Celebration[],
  limit = 12,
): Celebration[] {
  const deduped = [...existing]

  for (const celebration of incoming) {
    if (deduped.some((entry) => entry.id === celebration.id)) {
      continue
    }

    deduped.push(celebration)
  }

  return deduped.slice(-limit)
}

function calculateRoundPoints(context: RecordContext): number {
  if (!context.didWin) {
    return context.mode === 'daily' ? 4 : 2
  }

  const difficultyBonus = {
    easy: 6,
    medium: 8,
    hard: 12,
    impossible: 16,
    'elite-ball-knowledge': 20,
  }[context.difficultyId]
  const modeBonus = context.mode === 'daily' ? 10 : 5
  const efficiencyBonus = Math.max(0, 6 - context.guessCount)

  return difficultyBonus + modeBonus + efficiencyBonus
}

function updateDailyHistory(
  history: DailyHistoryEntry[],
  context: RecordContext,
  completedAt: string,
): DailyHistoryEntry[] {
  if (context.mode !== 'daily') {
    return history
  }

  const nextEntry: DailyHistoryEntry = {
    dateKey: context.dateKey,
    completedAt,
    didWin: context.didWin,
    guessCount: context.guessCount,
    difficultyId: context.difficultyId,
    clueMode: context.clueMode,
    themeId: context.themeId,
    eventId: context.eventId,
    entryDecadeId: context.entryDecadeId ?? null,
  }

  return [...history.filter((entry) => entry.dateKey !== context.dateKey), nextEntry].toSorted(
    (left, right) => left.dateKey.localeCompare(right.dateKey),
  )
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
    dailyHistory: [],
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
      buildCelebration('quest', `Quest complete: ${quest.title}`, `${quest.rewardPoints} points ready to claim.`, createdAt),
    )
  const recordLabels = [...new Set([...streakResult.newRecordLabels, ...recordResult.newRecordLabels])]
  const recordCelebrations =
    recordLabels.length > 0
      ? [
          buildCelebration(
            'record',
            recordLabels.length > 1 ? 'New personal records' : 'New personal record',
            recordLabels.join(' | '),
            createdAt,
            `record:${recordLabels.join('|')}`,
          ),
        ]
      : []
  const roundPoints = calculateRoundPoints(context)
  const statusCelebrations = [
    buildCelebration(
      'status',
      `+${roundPoints} points`,
      context.didWin
        ? 'Points added for the completed board.'
        : 'Points added for staying in the grind.',
      createdAt,
    ),
  ]

  return {
    profile: {
      ...profile,
      points: profile.points + roundPoints,
    },
    progression: {
      ...ensuredProgression,
      badges: nextBadges,
      weeklyQuests: questResult.board,
      records: recordResult.records,
      streaks: streakResult.streaks,
      dailyWinDateKeys: streakResult.dailyWinDateKeys,
      dailyHistory: updateDailyHistory(ensuredProgression.dailyHistory, context, createdAt),
      pendingCelebrations: appendCelebrations(ensuredProgression.pendingCelebrations, [
        ...statusCelebrations,
        ...questCelebrations,
        ...badgeCelebrations,
        ...recordCelebrations,
      ]),
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
      points: profile.points + claimResult.rewardPoints,
    },
    progression: {
      ...progression,
      weeklyQuests: claimResult.board,
      pendingCelebrations: appendCelebrations(progression.pendingCelebrations, [
        buildCelebration(
          'quest',
          'Reward claimed',
          `+${claimResult.rewardPoints} points added to your local profile.`,
          createdAt,
          `quest-claim:${questId}`,
        ),
      ]),
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

