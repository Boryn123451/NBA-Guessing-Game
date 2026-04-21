import { DateTime } from 'luxon'

import { doesWeekContainEventWindow } from '../nba/events'
import type {
  DifficultyId,
  EventModeId,
  GameMode,
  UnitSystem,
  WeeklyQuestBoard,
  WeeklyQuestProgress,
  WeeklyQuestTemplateId,
} from '../nba/types'

export interface WeeklyQuestContext {
  didWin: boolean
  guessCount: number
  mode: GameMode
  difficultyId: DifficultyId
  eventId: EventModeId | null
  units: UnitSystem
}

interface WeeklyQuestTemplateDefinition {
  id: WeeklyQuestTemplateId
  title: string
  description: string
  target: number
  rewardPoints: number
  advance: (
    quest: WeeklyQuestProgress,
    context: WeeklyQuestContext,
    currentWinStreak: number,
  ) => number
}

const QUEST_COUNT = 4

function hashString(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

const WEEKLY_QUEST_TEMPLATES: WeeklyQuestTemplateDefinition[] = [
  {
    id: 'win-three-games',
    title: 'Win 3 games',
    description: 'Stack three wins before the weekly board resets.',
    target: 3,
    rewardPoints: 45,
    advance: (quest, context) =>
      Math.min(quest.progress + (context.didWin ? 1 : 0), quest.target),
  },
  {
    id: 'hard-or-above-win',
    title: 'Win on Hard or above',
    description: 'Take one board on Hard, Impossible, or Elite Ball Knowledge.',
    target: 1,
    rewardPoints: 35,
    advance: (quest, context) =>
      Math.min(
        quest.progress +
          (context.didWin &&
          (context.difficultyId === 'hard' ||
            context.difficultyId === 'impossible' ||
            context.difficultyId === 'elite-ball-knowledge')
            ? 1
            : 0),
        quest.target,
      ),
  },
  {
    id: 'finish-two-dailies',
    title: 'Finish 2 daily games',
    description: 'Complete two Daily boards this week.',
    target: 2,
    rewardPoints: 25,
    advance: (quest, context) =>
      Math.min(quest.progress + (context.mode === 'daily' ? 1 : 0), quest.target),
  },
  {
    id: 'solve-in-five',
    title: 'Solve in 5 or fewer',
    description: 'Close one board in five guesses or less.',
    target: 1,
    rewardPoints: 30,
    advance: (quest, context) =>
      Math.min(quest.progress + (context.didWin && context.guessCount <= 5 ? 1 : 0), quest.target),
  },
  {
    id: 'play-five-practice-rounds',
    title: 'Play 5 practice rounds',
    description: 'Keep the reps coming in Practice mode.',
    target: 5,
    rewardPoints: 30,
    advance: (quest, context) =>
      Math.min(quest.progress + (context.mode === 'practice' ? 1 : 0), quest.target),
  },
  {
    id: 'win-using-metric',
    title: 'Win using Metric',
    description: 'Take one board while height is shown in metric units.',
    target: 1,
    rewardPoints: 20,
    advance: (quest, context) =>
      Math.min(quest.progress + (context.didWin && context.units === 'metric' ? 1 : 0), quest.target),
  },
  {
    id: 'complete-event-round',
    title: 'Complete an Event Mode round',
    description: 'Play one board with an active event mode selected.',
    target: 1,
    rewardPoints: 40,
    advance: (quest, context) =>
      Math.min(quest.progress + (context.eventId !== null ? 1 : 0), quest.target),
  },
  {
    id: 'two-wins-in-a-row',
    title: 'Get 2 wins in a row',
    description: 'Build a two-game heater before the week resets.',
    target: 2,
    rewardPoints: 35,
    advance: (quest, _context, currentWinStreak) =>
      Math.min(Math.max(quest.progress, currentWinStreak), quest.target),
  },
]

const TEMPLATE_BY_ID = new Map<WeeklyQuestTemplateId, WeeklyQuestTemplateDefinition>(
  WEEKLY_QUEST_TEMPLATES.map((template) => [template.id, template]),
)

function getEligibleTemplates(
  weekStartIso: string,
  weekEndIso: string,
  timeZone: string,
): WeeklyQuestTemplateDefinition[] {
  const eventQuestAvailable = doesWeekContainEventWindow(weekStartIso, weekEndIso, timeZone)

  return WEEKLY_QUEST_TEMPLATES.filter((template) =>
    template.id === 'complete-event-round' ? eventQuestAvailable : true,
  )
}

function buildQuestFromTemplate(
  template: WeeklyQuestTemplateDefinition,
  weekId: string,
): WeeklyQuestProgress {
  return {
    id: `${weekId}:${template.id}`,
    templateId: template.id,
    title: template.title,
    description: template.description,
    target: template.target,
    rewardPoints: template.rewardPoints,
    progress: 0,
    completedAt: null,
    claimedAt: null,
  }
}

export function getWeeklyQuestWindow(
  now: Date = new Date(),
  timeZone = 'UTC',
): { weekId: string; weekStartIso: string; weekEndIso: string } {
  const localNow = DateTime.fromJSDate(now, { zone: timeZone })
  const weekStart = localNow.startOf('week')
  const weekEnd = weekStart.plus({ days: 6 }).endOf('day')

  return {
    weekId: `${weekStart.weekYear}-W${weekStart.weekNumber.toString().padStart(2, '0')}`,
    weekStartIso: weekStart.toISODate() ?? '1970-01-01',
    weekEndIso: weekEnd.toISODate() ?? '1970-01-07',
  }
}

export function getNextWeeklyReset(now: Date = new Date(), timeZone = 'UTC'): DateTime {
  const localNow = DateTime.fromJSDate(now, { zone: timeZone })
  return localNow.startOf('week').plus({ weeks: 1 })
}

export function createWeeklyQuestBoard(
  now: Date = new Date(),
  timeZone = 'UTC',
): WeeklyQuestBoard {
  const { weekId, weekStartIso, weekEndIso } = getWeeklyQuestWindow(now, timeZone)
  const eligibleTemplates = getEligibleTemplates(weekStartIso, weekEndIso, timeZone)
  const selectedTemplates = eligibleTemplates
    .toSorted(
      (left, right) =>
        hashString(`${weekId}:${left.id}`) - hashString(`${weekId}:${right.id}`) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, QUEST_COUNT)

  return {
    weekId,
    generatedAt: DateTime.fromJSDate(now, { zone: timeZone }).toISO() ?? new Date().toISOString(),
    currentWinStreak: 0,
    quests: selectedTemplates.map((template) => buildQuestFromTemplate(template, weekId)),
  }
}

export function ensureWeeklyQuestBoard(
  board: WeeklyQuestBoard,
  now: Date = new Date(),
  timeZone = 'UTC',
): WeeklyQuestBoard {
  const { weekId } = getWeeklyQuestWindow(now, timeZone)
  return board.weekId === weekId ? board : createWeeklyQuestBoard(now, timeZone)
}

export function advanceWeeklyQuestBoard(
  board: WeeklyQuestBoard,
  context: WeeklyQuestContext,
  now: Date = new Date(),
  timeZone = 'UTC',
): { board: WeeklyQuestBoard; completedQuestIds: string[]; allCompleted: boolean } {
  const ensuredBoard = ensureWeeklyQuestBoard(board, now, timeZone)
  const nextWinStreak = context.didWin ? ensuredBoard.currentWinStreak + 1 : 0
  const completedQuestIds: string[] = []
  const completedAt = DateTime.fromJSDate(now, { zone: timeZone }).toISO() ?? new Date().toISOString()

  const quests = ensuredBoard.quests.map((quest) => {
    if (quest.completedAt) {
      return quest
    }

    const template = TEMPLATE_BY_ID.get(quest.templateId)

    if (!template) {
      return quest
    }

    const nextProgress = template.advance(quest, context, nextWinStreak)
    const didComplete = nextProgress >= quest.target

    if (didComplete) {
      completedQuestIds.push(quest.id)
    }

    return {
      ...quest,
      progress: nextProgress,
      completedAt: didComplete ? completedAt : null,
    }
  })

  return {
    board: {
      ...ensuredBoard,
      currentWinStreak: nextWinStreak,
      quests,
    },
    completedQuestIds,
    allCompleted: quests.length > 0 && quests.every((quest) => quest.completedAt !== null),
  }
}

export function claimWeeklyQuest(
  board: WeeklyQuestBoard,
  questId: string,
  now: Date = new Date(),
  timeZone = 'UTC',
): { board: WeeklyQuestBoard; rewardPoints: number } | null {
  const ensuredBoard = ensureWeeklyQuestBoard(board, now, timeZone)
  const claimedAt = DateTime.fromJSDate(now, { zone: timeZone }).toISO() ?? new Date().toISOString()
  let rewardPoints = 0

  const quests = ensuredBoard.quests.map((quest) => {
    if (quest.id !== questId || !quest.completedAt || quest.claimedAt) {
      return quest
    }

    rewardPoints = quest.rewardPoints

    return {
      ...quest,
      claimedAt,
    }
  })

  if (rewardPoints === 0) {
    return null
  }

  return {
    board: {
      ...ensuredBoard,
      quests,
    },
    rewardPoints,
  }
}

