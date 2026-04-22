import { describe, expect, it } from 'vitest'

import { getPlayerImageSources } from './images'
import { buildPlayerRecord } from './testUtils'

describe('player image sources', () => {
  it('falls back from official image to static 2KRatings mapping and then to local silhouette', () => {
    const sources = getPlayerImageSources(
      buildPlayerRecord({
        id: 2544,
        displayName: 'LeBron James',
        headshotUrl: 'https://cdn.nba.com/headshots/nba/latest/1040x760/2544.png',
      }),
    )

    expect(sources[0]).toMatchObject({
      kind: 'official',
      src: 'https://cdn.nba.com/headshots/nba/latest/1040x760/2544.png',
    })
    expect(sources[1]).toMatchObject({
      kind: 'fallback',
      src: 'https://www.2kratings.com/wp-content/uploads/LeBron-James-2K-Rating.png',
    })
    expect(sources.at(-1)).toMatchObject({
      kind: 'local',
    })
  })
})
