import { DateTime } from 'luxon'

import type {
  DifficultyId,
  EventModeId,
  GameMode,
  LocalRecords,
  LocalStreaks,
} from '../nba/types'

export interface RecordContext {
  mode: GameMode
  difficultyId: DifficultyId
  eventId: EventModeId | null
  didWin: boolean
  guessCount: number
  dateKey: string
}

function createEmptyDifficultySolveMap(): Record<DifficultyId, number | null> {
  return {
    easy: null,
    medium: null,
    hard: null,
    impossible: null,
    'elite-ball-knowledge': null,
  }
}

export function createEmptyLocalRecords(): LocalRecords {
  return {
    bestSolveByDifficulty: createEmptyDifficultySolveMap(),
    longestWinStreak: 0,
    bestDailyStreak: 0,
    bestEventSolveByEvent: {},
    eventWinsByEvent: {},
  }
}

export function createEmptyLocalStreaks(): LocalStreaks {
  return {
    currentOverall: 0,
    maxOverall: 0,
    currentDaily: 0,
    maxDaily: 0,
    lastDailyWinDate: null,
  }
}

function isPreviousDay(previousDateKey: string, nextDateKey: string): boolean {
  const previousDate = DateTime.fromISO(previousDateKey, { zone: 'utc' }).startOf('day')
  const nextDate = DateTime.fromISO(nextDateKey, { zone: 'utc' }).startOf('day')

  return previousDate.plus({ days: 1 }).toISODate() === nextDate.toISODate()
}

export function updateLocalStreaks(
  streaks: LocalStreaks,
  dailyWinDateKeys: string[],
  context: RecordContext,
): { streaks: LocalStreaks; dailyWinDateKeys: string[]; newRecordLabels: string[] } {
  const nextOverall = context.didWin ? streaks.currentOverall + 1 : 0
  const nextMaxOverall = Math.max(streaks.maxOverall, nextOverall)
  let nextDaily = streaks.currentDaily
  let nextMaxDaily = streaks.maxDaily
  let nextLastDailyWinDate = streaks.lastDailyWinDate
  let nextDailyWinDateKeys = dailyWinDateKeys
  const newRecordLabels: string[] = []

  if (nextMaxOverall > streaks.maxOverall) {
    newRecordLabels.push(`Longest win streak: ${nextMaxOverall}`)
  }

  if (
    context.didWin &&
    context.mode === 'daily' &&
    !dailyWinDateKeys.includes(context.dateKey)
  ) {
    nextDaily = streaks.lastDailyWinDate
      ? isPreviousDay(streaks.lastDailyWinDate, context.dateKey)
        ? streaks.currentDaily + 1
        : 1
      : 1
    nextMaxDaily = Math.max(streaks.maxDaily, nextDaily)
    nextLastDailyWinDate = context.dateKey
    nextDailyWinDateKeys = [...dailyWinDateKeys, context.dateKey].toSorted()

    if (nextMaxDaily > streaks.maxDaily) {
      newRecordLabels.push(`Best daily streak: ${nextMaxDaily}`)
    }
  }

  return {
    streaks: {
      currentOverall: nextOverall,
      maxOverall: nextMaxOverall,
      currentDaily: nextDaily,
      maxDaily: nextMaxDaily,
      lastDailyWinDate: nextLastDailyWinDate,
    },
    dailyWinDateKeys: nextDailyWinDateKeys,
    newRecordLabels,
  }
}

export function updateLocalRecords(
  records: LocalRecords,
  streaks: LocalStreaks,
  context: RecordContext,
): { records: LocalRecords; newRecordLabels: string[] } {
  const nextRecords: LocalRecords = {
    ...records,
    bestSolveByDifficulty: { ...records.bestSolveByDifficulty },
    bestEventSolveByEvent: { ...records.bestEventSolveByEvent },
    eventWinsByEvent: { ...records.eventWinsByEvent },
    longestWinStreak: Math.max(records.longestWinStreak, streaks.maxOverall),
    bestDailyStreak: Math.max(records.bestDailyStreak, streaks.maxDaily),
  }
  const newRecordLabels: string[] = []

  if (context.didWin) {
    const currentBestSolve = records.bestSolveByDifficulty[context.difficultyId]

    if (currentBestSolve === null || context.guessCount < currentBestSolve) {
      nextRecords.bestSolveByDifficulty[context.difficultyId] = context.guessCount
      newRecordLabels.push(
        `Best ${context.difficultyId.replace(/-/g, ' ')} solve: ${context.guessCount} guesses`,
      )
    }

    if (context.eventId) {
      nextRecords.eventWinsByEvent[context.eventId] =
        (nextRecords.eventWinsByEvent[context.eventId] ?? 0) + 1

      const bestEventSolve = records.bestEventSolveByEvent[context.eventId]

      if (bestEventSolve === undefined || context.guessCount < bestEventSolve) {
        nextRecords.bestEventSolveByEvent[context.eventId] = context.guessCount
        newRecordLabels.push(
          `Best ${context.eventId.replace(/-/g, ' ')} solve: ${context.guessCount} guesses`,
        )
      }
    }
  }

  return {
    records: nextRecords,
    newRecordLabels,
  }
}
