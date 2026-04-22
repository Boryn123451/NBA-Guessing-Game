import { describe, expect, it } from 'vitest'

import { getPlayablePlayerPool } from './pools'
import { buildPlayerRecord } from './testUtils'
import type { GameVariant } from './types'

const variant: GameVariant = {
  playerPoolScope: 'current',
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

  it('keeps undrafted players inside Draft Mode pools', () => {
    const undrafted = buildPlayerRecord({
      id: 11,
      displayName: 'Undrafted Guard',
      draft: {
        year: null,
        round: null,
        pick: null,
        teamId: null,
        teamAbbreviation: null,
        teamName: null,
        isUndrafted: true,
      },
    })
    const drafted = buildPlayerRecord({
      id: 12,
      displayName: 'Drafted Wing',
    })

    expect(
      getPlayablePlayerPool(
        [undrafted, drafted],
        {
          ...variant,
          clueMode: 'draft',
        },
        'medium',
      ).map((player) => player.id),
    ).toEqual([11, 12])
  })

  it('curates history easy away from obscure short-career players', () => {
    const accessibleHistory = buildPlayerRecord({
      id: 21,
      displayName: 'Accessible Veteran',
      isCurrentPlayer: false,
      snapshot: {
        ...buildPlayerRecord().snapshot,
        pointsPerGame: 12.4,
        minutesPerGame: null,
      },
      career: {
        ...buildPlayerRecord().career,
        seasonsPlayed: 9,
        championships: 1,
        hasRichMetadata: true,
      },
    })
    const obscureHistory = buildPlayerRecord({
      id: 22,
      displayName: 'Obscure Fringe Forward',
      isCurrentPlayer: false,
      snapshot: {
        ...buildPlayerRecord().snapshot,
        pointsPerGame: 3.1,
        minutesPerGame: null,
      },
      career: {
        ...buildPlayerRecord().career,
        seasonsPlayed: 2,
        championships: 0,
        allStarAppearances: 0,
        hasRichMetadata: true,
      },
      draft: {
        ...buildPlayerRecord().draft,
        pick: 42,
      },
    })

    expect(
      getPlayablePlayerPool(
        [accessibleHistory, obscureHistory],
        {
          ...variant,
          playerPoolScope: 'history',
        },
        'easy',
      ).map((player) => player.id),
    ).toEqual([21])
  })
})
