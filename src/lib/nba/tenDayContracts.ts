import { DateTime } from 'luxon'

import type {
  ExcludedTenDayPlayer,
  PlayerMovementRow,
  ScheduledGame,
} from './types'

const TEN_DAY_PATTERN = /10-Day Contract/i

function parseMovementDate(isoDate: string): DateTime {
  return DateTime.fromISO(isoDate, { zone: 'utc' }).startOf('day')
}

function parseGroupSortValue(groupSort: string): number {
  const match = /(\d+)$/.exec(groupSort)
  return match ? Number(match[1]) : 0
}

function compareMovementRowsDesc(left: PlayerMovementRow, right: PlayerMovementRow): number {
  const leftTime = parseMovementDate(left.TRANSACTION_DATE).toMillis()
  const rightTime = parseMovementDate(right.TRANSACTION_DATE).toMillis()

  if (leftTime !== rightTime) {
    return rightTime - leftTime
  }

  return parseGroupSortValue(right.GroupSort) - parseGroupSortValue(left.GroupSort)
}

function getRegularSeasonGameDatesForTeam(
  games: ScheduledGame[],
): Map<number, DateTime[]> {
  const map = new Map<number, DateTime[]>()

  for (const game of games) {
    if (!game.gameId.startsWith('002')) {
      continue
    }

    const gameDate = DateTime.fromISO(
      game.gameDateTimeUTC || game.gameDateUTC,
      { zone: 'utc' },
    ).startOf('day')

    for (const teamId of [game.homeTeam.teamId, game.awayTeam.teamId]) {
      const current = map.get(teamId) ?? []
      current.push(gameDate)
      map.set(teamId, current)
    }
  }

  for (const [teamId, dates] of map) {
    map.set(teamId, dates.toSorted((left, right) => left.toMillis() - right.toMillis()))
  }

  return map
}

function getContractEndDate(
  row: PlayerMovementRow,
  scheduleByTeamId: Map<number, DateTime[]>,
): DateTime {
  const contractStart = parseMovementDate(row.TRANSACTION_DATE)
  const teamSchedule = scheduleByTeamId.get(row.TEAM_ID) ?? []
  const naturalEnd = contractStart.plus({ days: 9 }).endOf('day')
  const thirdGame = teamSchedule.filter((gameDate) => gameDate >= contractStart)[2]
  const regularSeasonEnd = teamSchedule.at(-1)?.endOf('day')

  let contractEnd = naturalEnd

  if (thirdGame) {
    contractEnd =
      thirdGame.endOf('day').toMillis() > contractEnd.toMillis()
        ? thirdGame.endOf('day')
        : contractEnd
  }

  if (regularSeasonEnd && contractEnd.toMillis() > regularSeasonEnd.toMillis()) {
    contractEnd = regularSeasonEnd
  }

  return contractEnd
}

export function deriveActiveTenDayContracts(
  rows: PlayerMovementRow[],
  games: ScheduledGame[],
  asOfDate: string,
): ExcludedTenDayPlayer[] {
  const asOf = DateTime.fromISO(asOfDate, { zone: 'utc' }).endOf('day')
  const scheduleByTeamId = getRegularSeasonGameDatesForTeam(games)
  const rowsUpToDate = rows.filter(
    (row) => parseMovementDate(row.TRANSACTION_DATE).toMillis() <= asOf.toMillis(),
  )
  const latestByPlayer = new Map<number, PlayerMovementRow>()

  for (const row of rowsUpToDate.toSorted(compareMovementRowsDesc)) {
    if (!latestByPlayer.has(row.PLAYER_ID)) {
      latestByPlayer.set(row.PLAYER_ID, row)
    }
  }

  const activeContracts: ExcludedTenDayPlayer[] = []

  for (const row of rowsUpToDate) {
    if (!TEN_DAY_PATTERN.test(row.TRANSACTION_DESCRIPTION)) {
      continue
    }

    if (latestByPlayer.get(row.PLAYER_ID) !== row) {
      continue
    }

    const contractEnd = getContractEndDate(row, scheduleByTeamId)

    if (contractEnd.toMillis() < asOf.toMillis()) {
      continue
    }

    const match = /signed (?:guard|forward|center) (.+?) to a/i.exec(row.TRANSACTION_DESCRIPTION)
    const displayName = match?.[1]?.trim() || row.PLAYER_SLUG.replace(/-/g, ' ')

    activeContracts.push({
      id: row.PLAYER_ID,
      displayName,
      teamId: row.TEAM_ID,
      teamName: row.TEAM_SLUG,
      contractStartDate: parseMovementDate(row.TRANSACTION_DATE).toISODate() ?? asOfDate,
      contractEndDate: contractEnd.toISODate() ?? asOfDate,
    })
  }

  return activeContracts.toSorted((left, right) => left.displayName.localeCompare(right.displayName))
}
