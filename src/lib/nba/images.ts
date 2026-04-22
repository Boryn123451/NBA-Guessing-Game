import imageFallbackManifest from '../../data/generated/player-image-fallbacks.json'
import type { PlayerImageFallbackManifest, PlayerRecord } from './types'

const LOCAL_SILHOUETTE = `${import.meta.env.BASE_URL}player-silhouette.svg`

const fallbackManifest = imageFallbackManifest as PlayerImageFallbackManifest

export type PlayerImageSourceKind = 'official' | 'fallback' | 'local'

export interface PlayerImageSource {
  kind: PlayerImageSourceKind
  src: string
}

export function getPlayerImageSources(player: PlayerRecord): PlayerImageSource[] {
  const sources: PlayerImageSource[] = []
  const fallbackSrc = fallbackManifest.fallbacks[`${player.id}`] ?? null

  if (player.headshotUrl) {
    sources.push({
      kind: 'official',
      src: player.headshotUrl,
    })
  }

  if (fallbackSrc) {
    sources.push({
      kind: 'fallback',
      src: fallbackSrc,
    })
  }

  sources.push({
    kind: 'local',
    src: LOCAL_SILHOUETTE,
  })

  return sources.filter(
    (source, index, array) => array.findIndex((entry) => entry.src === source.src) === index,
  )
}
