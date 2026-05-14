import { describe, expect, it } from 'vitest'

import { buildPlayerRecord } from './testUtils'
import { getPlayerActiveDecadeIds, playerPlayedInDecade } from './decades'

describe('active era filters', () => {
  it('counts players in every decade touched by their active NBA seasons', () => {
    const tackoFall = buildPlayerRecord({
      displayName: 'Tacko Fall',
      career: {
        ...buildPlayerRecord().career,
        debutYear: 2019,
        finalSeasonYear: 2021,
        seasonsPlayed: 3,
      },
    })
    const tajGibson = buildPlayerRecord({
      displayName: 'Taj Gibson',
      career: {
        ...buildPlayerRecord().career,
        debutYear: 2009,
        finalSeasonYear: 2025,
        seasonsPlayed: 17,
      },
    })

    expect(getPlayerActiveDecadeIds(tackoFall)).toEqual(['2010s', '2020s'])
    expect(getPlayerActiveDecadeIds(tajGibson)).toEqual(['2000s', '2010s', '2020s'])
    expect(playerPlayedInDecade(tackoFall, '2010s')).toBe(true)
    expect(playerPlayedInDecade(tackoFall, '2020s')).toBe(true)
  })
})
