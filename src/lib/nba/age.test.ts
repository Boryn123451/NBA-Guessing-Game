import { describe, expect, it } from 'vitest'

import { getPlayerAge } from './comparison'
import { buildPlayerRecord } from './testUtils'

describe('age normalization', () => {
  it('derives age from birth date for inactive players', () => {
    const retiredPlayer = buildPlayerRecord({
      birthDate: '1973-03-29',
      currentAge: null,
      isCurrentPlayer: false,
    })

    expect(getPlayerAge(retiredPlayer, '2026-04-22')).toBe(53)
  })

  it('falls back to stored age when birth date is unavailable', () => {
    const player = buildPlayerRecord({
      birthDate: null,
      currentAge: 27,
    })

    expect(getPlayerAge(player, '2026-04-22')).toBe(27)
  })
})
