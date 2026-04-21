import { describe, expect, it } from 'vitest'

import { getThemeOptions, getVariantPlayerPool } from './themes'
import { buildPlayerRecord } from './testUtils'

describe('theme filtering', () => {
  const players = [
    buildPlayerRecord({
      id: 1,
      flags: { isRookie: true, isInternational: false, isAllStar: false, isUnder25: true },
    }),
    buildPlayerRecord({
      id: 2,
      country: 'France',
      flags: { isRookie: false, isInternational: true, isAllStar: true, isUnder25: false },
      career: {
        debutYear: 2018,
        preNbaPath: 'Metropolitans 92',
        careerTeamIds: [1610612759, 1610612747],
        careerTeamAbbreviations: ['SAS', 'LAL'],
        careerTeamNames: ['San Antonio Spurs', 'Los Angeles Lakers'],
        previousTeamIds: [1610612759],
        previousTeamAbbreviations: ['SAS'],
        previousTeamNames: ['San Antonio Spurs'],
        allStarAppearances: 2,
      },
    }),
  ]

  it('filters the all-star pool from player flags', () => {
    const result = getVariantPlayerPool(players, {
      clueMode: 'standard',
      themeId: 'all-stars',
    })

    expect(result.map((player) => player.id)).toEqual([2])
  })

  it('reports counts for the simplified theme set without team history', () => {
    const options = getThemeOptions(players)

    expect(options.map((option) => option.id)).toEqual([
      'classic',
      'rookies',
      'international',
      'all-stars',
      'under-25',
    ])
    expect(options.find((option) => option.id === 'under-25')?.count).toBe(1)
  })
})

