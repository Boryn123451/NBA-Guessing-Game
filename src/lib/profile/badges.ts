import type { BadgeId, DifficultyId, EventModeId } from '../nba/types'

export interface BadgeDefinition {
  id: BadgeId
  label: string
  description: string
}

export interface BadgeEvaluationContext {
  totalWins: number
  didWin: boolean
  guessCount: number
  difficultyId: DifficultyId
  eventId: EventModeId | null
  bestDailyStreak: number
  weeklyQuestSetCompleted: boolean
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first-win',
    label: 'First Win',
    description: 'Take your first board.',
  },
  {
    id: 'three-day-streak',
    label: '3-Day Streak',
    description: 'Win Daily boards on three separate days in a row.',
  },
  {
    id: 'seven-day-streak',
    label: '7-Day Streak',
    description: 'Push the Daily streak all the way to seven.',
  },
  {
    id: 'perfect-solve',
    label: 'Perfect Solve',
    description: 'Win in a single guess.',
  },
  {
    id: 'easy-crusher',
    label: 'Easy Crusher',
    description: 'Win a board on Easy.',
  },
  {
    id: 'medium-grinder',
    label: 'Medium Grinder',
    description: 'Win a board on Medium.',
  },
  {
    id: 'hard-winner',
    label: 'Hard Winner',
    description: 'Win a board on Hard.',
  },
  {
    id: 'impossible-solver',
    label: 'Impossible Solver',
    description: 'Win a board on Impossible.',
  },
  {
    id: 'elite-ball-knowledge-winner',
    label: 'Elite Ball Knowledge Winner',
    description: 'Beat the harshest difficulty in the game.',
  },
  {
    id: 'weekly-quest-completed',
    label: 'Weekly Quest Completed',
    description: 'Finish an entire weekly quest set.',
  },
  {
    id: 'event-mode-winner',
    label: 'Event Mode Winner',
    description: 'Win any active Event Mode board.',
  },
]

const BADGE_BY_ID = new Map<BadgeId, BadgeDefinition>(
  BADGE_DEFINITIONS.map((badge) => [badge.id, badge]),
)

export function getBadgeDefinition(badgeId: BadgeId): BadgeDefinition {
  return BADGE_BY_ID.get(badgeId) ?? BADGE_DEFINITIONS[0]
}

export function evaluateBadgeUnlocks(
  unlockedBadgeIds: BadgeId[],
  context: BadgeEvaluationContext,
): BadgeId[] {
  const unlocked = new Set(unlockedBadgeIds)
  const nextBadges: BadgeId[] = []

  function maybeUnlock(badgeId: BadgeId, condition: boolean): void {
    if (condition && !unlocked.has(badgeId)) {
      unlocked.add(badgeId)
      nextBadges.push(badgeId)
    }
  }

  maybeUnlock('first-win', context.didWin && context.totalWins === 1)
  maybeUnlock('three-day-streak', context.bestDailyStreak >= 3)
  maybeUnlock('seven-day-streak', context.bestDailyStreak >= 7)
  maybeUnlock('perfect-solve', context.didWin && context.guessCount === 1)
  maybeUnlock('easy-crusher', context.didWin && context.difficultyId === 'easy')
  maybeUnlock('medium-grinder', context.didWin && context.difficultyId === 'medium')
  maybeUnlock('hard-winner', context.didWin && context.difficultyId === 'hard')
  maybeUnlock('impossible-solver', context.didWin && context.difficultyId === 'impossible')
  maybeUnlock(
    'elite-ball-knowledge-winner',
    context.didWin && context.difficultyId === 'elite-ball-knowledge',
  )
  maybeUnlock('weekly-quest-completed', context.weeklyQuestSetCompleted)
  maybeUnlock('event-mode-winner', context.didWin && context.eventId !== null)

  return nextBadges
}

