import { describe, expect, it } from 'vitest'

import { deriveActiveTenDayContracts } from './tenDayContracts'
import type { PlayerMovementRow, ScheduledGame } from './types'

const teamOneGames: ScheduledGame[] = [
  {
    gameId: '0022500001',
    gameDateUTC: '2026-04-02T00:00:00Z',
    homeTeam: { teamId: 1 },
    awayTeam: { teamId: 2 },
  },
  {
    gameId: '0022500002',
    gameDateUTC: '2026-04-07T00:00:00Z',
    homeTeam: { teamId: 2 },
    awayTeam: { teamId: 1 },
  },
  {
    gameId: '0022500003',
    gameDateUTC: '2026-04-13T00:00:00Z',
    homeTeam: { teamId: 1 },
    awayTeam: { teamId: 3 },
  },
  {
    gameId: '0022500004',
    gameDateUTC: '2026-04-14T00:00:00Z',
    homeTeam: { teamId: 1 },
    awayTeam: { teamId: 4 },
  },
]

describe('deriveActiveTenDayContracts', () => {
  it('keeps only active 10-day contracts after extensions and superseding moves', () => {
    const rows: PlayerMovementRow[] = [
      {
        Transaction_Type: 'Signing',
        TRANSACTION_DATE: '2026-04-01T00:00:00',
        TRANSACTION_DESCRIPTION: 'Alpha signed guard Active Wing to a 10-Day Contract.',
        TEAM_ID: 1,
        TEAM_SLUG: 'alpha',
        PLAYER_ID: 10,
        PLAYER_SLUG: 'active-wing',
        Additional_Sort: 0,
        GroupSort: 'Signing 1002',
      },
      {
        Transaction_Type: 'Signing',
        TRANSACTION_DATE: '2026-04-01T00:00:00',
        TRANSACTION_DESCRIPTION: 'Alpha signed center Converted Big to a 10-Day Contract.',
        TEAM_ID: 1,
        TEAM_SLUG: 'alpha',
        PLAYER_ID: 11,
        PLAYER_SLUG: 'converted-big',
        Additional_Sort: 0,
        GroupSort: 'Signing 1001',
      },
      {
        Transaction_Type: 'Signing',
        TRANSACTION_DATE: '2026-04-05T00:00:00',
        TRANSACTION_DESCRIPTION: 'Alpha re-signed center Converted Big to a Rest-of-Season Contract.',
        TEAM_ID: 1,
        TEAM_SLUG: 'alpha',
        PLAYER_ID: 11,
        PLAYER_SLUG: 'converted-big',
        Additional_Sort: 0,
        GroupSort: 'Signing 1003',
      },
      {
        Transaction_Type: 'Signing',
        TRANSACTION_DATE: '2026-04-12T00:00:00',
        TRANSACTION_DESCRIPTION: 'Alpha signed forward Expired Forward to a 10-Day Contract.',
        TEAM_ID: 1,
        TEAM_SLUG: 'alpha',
        PLAYER_ID: 12,
        PLAYER_SLUG: 'expired-forward',
        Additional_Sort: 0,
        GroupSort: 'Signing 1004',
      },
    ]

    const active = deriveActiveTenDayContracts(rows, teamOneGames, '2026-04-12')

    expect(active.map((player) => player.id)).toEqual([10, 12])
    expect(active[0].contractEndDate).toBe('2026-04-13')
  })

  it('drops contracts after the regular season cap', () => {
    const rows: PlayerMovementRow[] = [
      {
        Transaction_Type: 'Signing',
        TRANSACTION_DATE: '2026-04-12T00:00:00',
        TRANSACTION_DESCRIPTION: 'Alpha signed forward Expired Forward to a 10-Day Contract.',
        TEAM_ID: 1,
        TEAM_SLUG: 'alpha',
        PLAYER_ID: 12,
        PLAYER_SLUG: 'expired-forward',
        Additional_Sort: 0,
        GroupSort: 'Signing 1004',
      },
    ]

    const active = deriveActiveTenDayContracts(rows, teamOneGames, '2026-04-15')

    expect(active).toHaveLength(0)
  })
})
