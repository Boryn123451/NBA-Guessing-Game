import { useMemo, useState } from 'react'

import { getPlayerImageSources } from '../lib/nba/images'
import type { PlayerRecord } from '../lib/nba/types'

export function useResolvedPlayerImage(player: PlayerRecord) {
  const sources = useMemo(() => getPlayerImageSources(player), [player])
  const [imageState, setImageState] = useState(() => ({
    playerId: player.id,
    sourceIndex: 0,
  }))
  const sourceIndex = imageState.playerId === player.id ? imageState.sourceIndex : 0

  return {
    activeSource: sources[Math.min(sourceIndex, sources.length - 1)],
    onError: () => {
      setImageState((previousState) => {
        const previousIndex =
          previousState.playerId === player.id ? previousState.sourceIndex : 0

        return {
          playerId: player.id,
          sourceIndex: Math.min(previousIndex + 1, sources.length - 1),
        }
      })
    },
  }
}
