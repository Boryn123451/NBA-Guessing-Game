import { describe, expect, it } from 'vitest'

import { getPlayerImageSources } from './images'
import { buildPlayerRecord } from './testUtils'

describe('player image sources', () => {
  it('prefers static 2KRatings mapping for current players and keeps official image as fallback', () => {
    const sources = getPlayerImageSources(
      buildPlayerRecord({
        id: 2544,
        displayName: 'LeBron James',
        isCurrentPlayer: true,
        headshotUrl: 'https://cdn.nba.com/headshots/nba/latest/1040x760/2544.png',
      }),
    )

    expect(sources[0]).toMatchObject({
      kind: 'fallback',
      src: 'https://www.2kratings.com/wp-content/uploads/LeBron-James-2K-Rating.png',
    })
    expect(sources[1]).toMatchObject({
      kind: 'official',
      src: 'https://cdn.nba.com/headshots/nba/latest/1040x760/2544.png',
    })
    expect(sources.at(-1)).toMatchObject({
      kind: 'local',
    })
  })
})
