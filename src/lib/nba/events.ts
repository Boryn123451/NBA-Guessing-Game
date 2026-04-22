import { DateTime } from 'luxon'

import type { BadgeId, EventModeId, PlayerRecord } from './types'

interface EventWindow {
  month: number
  day: number
}

export interface EventModeDefinition {
  id: EventModeId
  title: string
  subtitle: string
  description: string
  priority: number
  accentColor: string
  start: EventWindow
  end: EventWindow
  badgeRewardId: BadgeId | null
  specialRuleText: string | null
  filter: (player: PlayerRecord) => boolean
}

export interface ActiveEventMode extends EventModeDefinition {
  playerCount: number
  isActive: boolean
  startsAt: string
  endsAt: string
  countdownMs: number
}

const CHRISTMAS_TEAM_ABBREVIATIONS = new Set([
  'NYK',
  'SAS',
  'MIN',
  'DAL',
  'PHX',
  'DEN',
  'LAL',
  'GSW',
  'BOS',
  'PHI',
])

export const EVENT_MODE_DEFINITIONS: EventModeDefinition[] = [
  {
    id: 'opening-week',
    title: 'Opening Week',
    subtitle: 'Young cores, new rotations, fresh noise.',
    description: 'Focus on rookies and under-25 players to mirror the early-season spotlight.',
    priority: 20,
    accentColor: '#f97316',
    start: { month: 10, day: 20 },
    end: { month: 10, day: 31 },
    badgeRewardId: 'event-mode-winner',
    specialRuleText: 'Pool narrows to rookies and young breakout candidates.',
    filter: (player) => player.flags.isRookie || player.flags.isUnder25,
  },
  {
    id: 'christmas-games',
    title: 'Christmas Games',
    subtitle: 'Showcase rosters from the holiday slate.',
    description: 'Only players from the featured Christmas teams stay in the pool.',
    priority: 90,
    accentColor: '#dc2626',
    start: { month: 12, day: 23 },
    end: { month: 12, day: 26 },
    badgeRewardId: 'event-mode-winner',
    specialRuleText: 'Pool narrows to the Christmas showcase teams.',
    filter: (player) => CHRISTMAS_TEAM_ABBREVIATIONS.has(player.teamAbbreviation),
  },
  {
    id: 'all-star-weekend',
    title: 'All-Star Weekend',
    subtitle: 'Star power and rising-stage names.',
    description: 'All-Stars stay in, with rookies joining to keep the weekend feel broader.',
    priority: 80,
    accentColor: '#0ea5e9',
    start: { month: 2, day: 13 },
    end: { month: 2, day: 18 },
    badgeRewardId: 'event-mode-winner',
    specialRuleText: 'Pool favors current All-Stars, plus rookies for Rising Stars overlap.',
    filter: (player) => player.flags.isAllStar || player.flags.isRookie,
  },
  {
    id: 'trade-deadline-week',
    title: 'Trade Deadline Week',
    subtitle: 'Roamers, relocations, and roster chaos.',
    description: 'Spot players with real NBA movement on their career record.',
    priority: 70,
    accentColor: '#a855f7',
    start: { month: 2, day: 5 },
    end: { month: 2, day: 12 },
    badgeRewardId: 'event-mode-winner',
    specialRuleText: 'Pool favors players with previous NBA teams on record.',
    filter: (player) => player.career.previousTeamIds.length > 0,
  },
  {
    id: 'playoff-mode',
    title: 'Playoff Mode',
    subtitle: 'Only teams in the postseason picture.',
    description: 'Current playoff-race players only.',
    priority: 60,
    accentColor: '#22c55e',
    start: { month: 4, day: 10 },
    end: { month: 5, day: 20 },
    badgeRewardId: 'event-mode-winner',
    specialRuleText: 'Pool uses teams currently inside the playoff picture.',
    filter: (player) => player.snapshot.playoffPicture === true,
  },
  {
    id: 'finals-mode',
    title: 'Finals Mode',
    subtitle: 'Contenders only.',
    description: 'The pool tightens around top-seeded teams.',
    priority: 85,
    accentColor: '#f59e0b',
    start: { month: 6, day: 1 },
    end: { month: 6, day: 20 },
    badgeRewardId: 'event-mode-winner',
    specialRuleText: 'Pool narrows to teams sitting at the top of the current standings snapshot.',
    filter: (player) => player.snapshot.playoffRank !== null && player.snapshot.playoffRank <= 2,
  },
  {
    id: 'awards-season',
    title: 'Awards Season',
    subtitle: 'Accolades, headlines, and major-case names.',
    description: 'Players with notable accolades or current All-Star status take over the board.',
    priority: 50,
    accentColor: '#eab308',
    start: { month: 5, day: 21 },
    end: { month: 6, day: 5 },
    badgeRewardId: 'event-mode-winner',
    specialRuleText: 'Pool favors players with an accolade clue or All-Star status.',
    filter: (player) => player.snapshot.careerAccoladeLabel !== null || player.flags.isAllStar,
  },
  {
    id: 'draft-week',
    title: 'Draft Week',
    subtitle: 'Rookie focus and fresh names.',
    description: 'The pool collapses back onto rookies during draft week.',
    priority: 65,
    accentColor: '#14b8a6',
    start: { month: 6, day: 22 },
    end: { month: 6, day: 30 },
    badgeRewardId: 'event-mode-winner',
    specialRuleText: 'Pool narrows to rookies and first-year players.',
    filter: (player) => player.flags.isRookie,
  },
]

const EVENT_BY_ID = new Map<EventModeId, EventModeDefinition>(
  EVENT_MODE_DEFINITIONS.map((eventMode) => [eventMode.id, eventMode]),
)

function getWindowForYear(
  eventMode: EventModeDefinition,
  year: number,
  timeZone: string,
): { start: DateTime; end: DateTime } {
  const start = DateTime.fromObject(
    {
      year,
      month: eventMode.start.month,
      day: eventMode.start.day,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
    },
    { zone: timeZone },
  )
  let end = DateTime.fromObject(
    {
      year,
      month: eventMode.end.month,
      day: eventMode.end.day,
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999,
    },
    { zone: timeZone },
  )

  if (end < start) {
    end = end.plus({ years: 1 })
  }

  return { start, end }
}

function resolveRelevantWindow(
  eventMode: EventModeDefinition,
  now: DateTime,
): { start: DateTime; end: DateTime } {
  const timeZone = now.zoneName || 'UTC'
  const currentYearWindow = getWindowForYear(eventMode, now.year, timeZone)

  if (now < currentYearWindow.start) {
    const previousYearWindow = getWindowForYear(eventMode, now.year - 1, timeZone)
    return previousYearWindow.end >= now ? previousYearWindow : currentYearWindow
  }

  if (now <= currentYearWindow.end) {
    return currentYearWindow
  }

  return getWindowForYear(eventMode, now.year + 1, timeZone)
}

export function getEventDefinition(eventId: EventModeId): EventModeDefinition {
  return EVENT_BY_ID.get(eventId) ?? EVENT_MODE_DEFINITIONS[0]
}

export function filterPlayersForEvent(
  players: PlayerRecord[],
  eventId: EventModeId | null,
): PlayerRecord[] {
  if (!eventId) {
    return players
  }

  const eventMode = EVENT_BY_ID.get(eventId)

  if (!eventMode) {
    return players
  }

  const filteredPlayers = players.filter((player) => eventMode.filter(player))
  return filteredPlayers.length > 0 ? filteredPlayers : players
}

export function getActiveEventModes(
  players: PlayerRecord[],
  now: Date = new Date(),
  timeZone = 'UTC',
): ActiveEventMode[] {
  const localNow = DateTime.fromJSDate(now, { zone: timeZone })

  return EVENT_MODE_DEFINITIONS.map((eventMode) => {
    const { start, end } = resolveRelevantWindow(eventMode, localNow)
    const isActive = localNow >= start && localNow <= end
    const playerCount = players.filter((player) => eventMode.filter(player)).length

    return {
      ...eventMode,
      playerCount,
      isActive,
      startsAt: start.toISO() ?? start.toISODate() ?? '',
      endsAt: end.toISO() ?? end.toISODate() ?? '',
      countdownMs: Math.max((isActive ? end : start).toMillis() - localNow.toMillis(), 0),
    }
  })
    .filter((eventMode) => eventMode.isActive)
    .toSorted((left, right) => right.priority - left.priority || left.title.localeCompare(right.title))
}

export function getUpcomingEventModes(
  players: PlayerRecord[],
  now: Date = new Date(),
  timeZone = 'UTC',
  limit = 3,
): ActiveEventMode[] {
  const localNow = DateTime.fromJSDate(now, { zone: timeZone })

  return EVENT_MODE_DEFINITIONS.map((eventMode) => {
    const { start, end } = resolveRelevantWindow(eventMode, localNow)

    return {
      ...eventMode,
      playerCount: players.filter((player) => eventMode.filter(player)).length,
      isActive: false,
      startsAt: start.toISO() ?? start.toISODate() ?? '',
      endsAt: end.toISO() ?? end.toISODate() ?? '',
      countdownMs: Math.max(start.toMillis() - localNow.toMillis(), 0),
    }
  })
    .filter((eventMode) => DateTime.fromISO(eventMode.startsAt, { zone: timeZone }) > localNow)
    .toSorted((left, right) => left.countdownMs - right.countdownMs || right.priority - left.priority)
    .slice(0, limit)
}

export function doesWeekContainEventWindow(
  weekStartIso: string,
  weekEndIso: string,
  timeZone = 'UTC',
): boolean {
  const weekStart = DateTime.fromISO(weekStartIso, { zone: timeZone }).startOf('day')
  const weekEnd = DateTime.fromISO(weekEndIso, { zone: timeZone }).endOf('day')

  return EVENT_MODE_DEFINITIONS.some((eventMode) => {
    const { start, end } = getWindowForYear(eventMode, weekStart.year, timeZone)
    const previous = getWindowForYear(eventMode, weekStart.year - 1, timeZone)
    const next = getWindowForYear(eventMode, weekStart.year + 1, timeZone)

    return (
      (start <= weekEnd && end >= weekStart) ||
      (previous.start <= weekEnd && previous.end >= weekStart) ||
      (next.start <= weekEnd && next.end >= weekStart)
    )
  })
}

export function sanitizeEventId(
  eventId: EventModeId | null,
  activeEventIds: EventModeId[],
): EventModeId | null {
  if (!eventId) {
    return null
  }

  return activeEventIds.includes(eventId) ? eventId : null
}
