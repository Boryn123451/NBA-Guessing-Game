import { describe, expect, it } from 'vitest'

import { getPlayablePlayerPool } from './pools'
import { buildPlayerRecord } from './testUtils'
import type { GameVariant } from './types'

const variant: GameVariant = {
  clueMode: 'standard',
  themeId: 'classic',
  eventId: null,
  includePostseason: false,
}

describe('player pools', () => {
  it('keeps only low-usage low-minute players in Elite Ball Knowledge', () => {
    const eligible = buildPlayerRecord({
      id: 1,
      displayName: 'Bench Guard',
      snapshot: {
        ...buildPlayerRecord().snapshot,
        pointsPerGame: 8.7,
        minutesPerGame: 14.8,
      },
    })
    const tooManyMinutes = buildPlayerRecord({
      id: 2,
      displayName: 'Heavy Rotation Wing',
      snapshot: {
        ...buildPlayerRecord().snapshot,
        pointsPerGame: 8.3,
        minutesPerGame: 19.4,
      },
    })
    const tooManyPoints = buildPlayerRecord({
      id: 3,
      displayName: 'Microwave Scorer',
      snapshot: {
        ...buildPlayerRecord().snapshot,
        pointsPerGame: 12.1,
        minutesPerGame: 14.2,
      },
    })

    expect(
      getPlayablePlayerPool([eligible, tooManyMinutes, tooManyPoints], variant, 'elite-ball-knowledge').map(
        (player) => player.id,
      ),
    ).toEqual([1])
  })
})
