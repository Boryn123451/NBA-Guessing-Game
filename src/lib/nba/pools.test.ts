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
  entryDecadeId: null,
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
      birthDate: '1958-05-14',
      snapshot: {
        ...buildPlayerRecord().snapshot,
        pointsPerGame: 21.4,
        minutesPerGame: null,
      },
      career: {
        ...buildPlayerRecord().career,
        seasonsPlayed: 14,
        allStarAppearances: 8,
        allNbaSelections: 5,
        championships: 3,
        isHallOfFame: true,
        accolades: ['Hall of Fame', 'All-Star x8'],
        hasRichMetadata: true,
      },
    })
    const obscureHistory = buildPlayerRecord({
      id: 22,
      displayName: 'Obscure Fringe Forward',
      isCurrentPlayer: false,
      birthDate: '1975-08-03',
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
        allNbaSelections: 0,
        accolades: [],
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

  it('keeps incomplete historical records out of impossible history pools', () => {
    const incompleteHistory = buildPlayerRecord({
      id: 31,
      displayName: 'Incomplete History',
      isCurrentPlayer: false,
      birthDate: null,
      position: 'N/A',
      heightInInches: null,
      heightCm: null,
      headshotUrl: null,
      draft: {
        ...buildPlayerRecord().draft,
        year: null,
        isUndrafted: false,
      },
      career: {
        ...buildPlayerRecord().career,
        debutYear: null,
        seasonsPlayed: 1,
        accolades: [],
      },
    })
    const completeHistory = buildPlayerRecord({
      id: 32,
      displayName: 'Complete History',
      isCurrentPlayer: false,
      birthDate: '1984-02-10',
      snapshot: {
        ...buildPlayerRecord().snapshot,
        pointsPerGame: 10.2,
      },
      career: {
        ...buildPlayerRecord().career,
        seasonsPlayed: 8,
        championships: 1,
        accolades: ['NBA Champion'],
      },
    })

    expect(
      getPlayablePlayerPool(
        [incompleteHistory, completeHistory],
        {
          ...variant,
          playerPoolScope: 'history',
        },
        'impossible',
      ).map((player) => player.id),
    ).toEqual([32])
  })

  it('keeps answer and guess pools inside the selected entry decade', () => {
    const nineties = buildPlayerRecord({
      id: 41,
      displayName: 'Nineties Star',
      isCurrentPlayer: false,
      entryDraftYear: 1996,
      entryDraftYearSource: 'draft',
      draft: {
        ...buildPlayerRecord().draft,
        year: 1996,
      },
    })
    const twoThousands = buildPlayerRecord({
      id: 42,
      displayName: 'Two Thousands Star',
      isCurrentPlayer: false,
      entryDraftYear: 2003,
      entryDraftYearSource: 'draft',
      draft: {
        ...buildPlayerRecord().draft,
        year: 2003,
      },
    })

    expect(
      getPlayablePlayerPool(
        [nineties, twoThousands],
        {
          ...variant,
          playerPoolScope: 'history',
          entryDecadeId: '1990s',
        },
        'impossible',
      ).map((player) => player.id),
    ).toEqual([41])
  })
})
