import { describe, expect, it } from 'vitest'

import { getLeagueDateKey, pickDailyPlayer } from './daily'
import { buildPlayerRecord } from './testUtils'
import type { GameVariant } from './types'

const defaultVariant: GameVariant = {
  clueMode: 'standard',
  themeId: 'classic',
  eventId: null,
}

function buildPlayer(id: number) {
  return buildPlayerRecord({
    id,
    slug: `player-${id}`,
    displayName: `Player ${id}`,
    firstName: 'Player',
    lastName: `${id}`,
    jerseyNumber: id,
    searchText: `player ${id}`,
  })
}

describe('daily helpers', () => {
  it('uses the provided timezone for the daily key', () => {
    const key = getLeagueDateKey(new Date('2026-04-21T03:30:00Z'), 'America/New_York')

    expect(key).toBe('2026-04-20')
  })

  it('picks the same player for the same date regardless of input order', () => {
    const ordered = [buildPlayer(1), buildPlayer(2), buildPlayer(3), buildPlayer(4)]
    const reversed = [...ordered].reverse()

    expect(pickDailyPlayer(ordered, '2026-04-21', defaultVariant).id).toBe(
      pickDailyPlayer(reversed, '2026-04-21', defaultVariant).id,
    )
  })
})
