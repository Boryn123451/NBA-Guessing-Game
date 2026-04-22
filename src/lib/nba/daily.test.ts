import { describe, expect, it } from 'vitest'

import { formatCountdown, getLeagueDateKey, pickDailyPlayer } from './daily'
import { buildPlayerRecord } from './testUtils'
import type { GameVariant } from './types'

const defaultVariant: GameVariant = {
  clueMode: 'standard',
  themeId: 'classic',
  eventId: null,
  includePostseason: false,
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

  it('formats countdowns with days, hours, minutes, and seconds', () => {
    expect(formatCountdown(3723000)).toBe('0d 01h 02m 03s')
    expect(formatCountdown(183723000)).toBe('2d 03h 02m 03s')
  })

  it('picks the same player for the same date regardless of input order', () => {
    const ordered = [buildPlayer(1), buildPlayer(2), buildPlayer(3), buildPlayer(4)]
    const reversed = [...ordered].reverse()

    expect(pickDailyPlayer(ordered, '2026-04-21', defaultVariant).id).toBe(
      pickDailyPlayer(reversed, '2026-04-21', defaultVariant).id,
    )
  })

  it('picks the same player for the same date across clue variants', () => {
    const players = [buildPlayer(1), buildPlayer(2), buildPlayer(3), buildPlayer(4)]
    const careerVariant: GameVariant = {
      clueMode: 'career',
      themeId: 'under-25',
      eventId: 'playoff-mode',
      includePostseason: true,
    }

    expect(pickDailyPlayer(players, '2026-04-21', defaultVariant).id).toBe(
      pickDailyPlayer(players, '2026-04-21', careerVariant).id,
    )
  })
})
