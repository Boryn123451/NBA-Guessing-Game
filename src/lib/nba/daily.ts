import { DateTime } from 'luxon'

import { getVariantKey } from './variant'
import type { GameVariant, PlayerRecord } from './types'

export const DEFAULT_DAILY_TIME_ZONE = 'UTC'

function hashString(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

export function getDetectedTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_DAILY_TIME_ZONE
  } catch {
    return DEFAULT_DAILY_TIME_ZONE
  }
}

export function getLeagueDateKey(
  now: Date = new Date(),
  timeZone = DEFAULT_DAILY_TIME_ZONE,
): string {
  return DateTime.fromJSDate(now, { zone: timeZone }).toISODate() ?? '1970-01-01'
}

export function getNextReset(
  now: Date = new Date(),
  timeZone = DEFAULT_DAILY_TIME_ZONE,
): DateTime {
  const localNow = DateTime.fromJSDate(now, { zone: timeZone })
  return localNow.plus({ days: 1 }).startOf('day')
}

export function getResetCountdown(
  now: Date = new Date(),
  timeZone = DEFAULT_DAILY_TIME_ZONE,
): number {
  return Math.max(getNextReset(now, timeZone).toMillis() - now.getTime(), 0)
}

export function formatCountdown(totalMilliseconds: number): string {
  const totalSeconds = Math.floor(totalMilliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':')
}

export function pickDailyPlayer(
  players: PlayerRecord[],
  dateKey: string,
  variant: GameVariant,
): PlayerRecord {
  const orderedPlayers = players.toSorted((left, right) => left.id - right.id)
  const seed = hashString(
    `${dateKey}:${getVariantKey(variant)}:${orderedPlayers.length}:full-court-cipher`,
  )
  const index = seed % orderedPlayers.length

  return orderedPlayers[index]
}

export function pickPracticePlayer(
  players: PlayerRecord[],
  excludedPlayerIds: number[] = [],
): PlayerRecord {
  const excluded = new Set(excludedPlayerIds)
  const eligiblePlayers = players.filter((player) => !excluded.has(player.id))
  const pool = eligiblePlayers.length > 0 ? eligiblePlayers : players
  const index = Math.floor(Math.random() * pool.length)

  return pool[index]
}

export function getCurrentSeason(now: Date = new Date()): string {
  const date = DateTime.fromJSDate(now, { zone: 'America/New_York' })
  const startYear = date.month >= 7 ? date.year : date.year - 1
  const endYear = (startYear + 1).toString().slice(-2)

  return `${startYear}-${endYear}`
}
