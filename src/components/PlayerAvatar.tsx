import { useState } from 'react'

import type { PlayerRecord } from '../lib/nba/types'

const FALLBACK_SRC = `${import.meta.env.BASE_URL}player-silhouette.svg`

interface PlayerAvatarProps {
  player: PlayerRecord
  size?: 'sm' | 'md'
}

export function PlayerAvatar({
  player,
  size = 'sm',
}: PlayerAvatarProps) {
  const [failedPlayerId, setFailedPlayerId] = useState<number | null>(null)
  const src =
    failedPlayerId !== player.id && player.headshotUrl ? player.headshotUrl : FALLBACK_SRC

  return (
    <span className={`player-avatar player-avatar--${size}`}>
      <img
        alt=""
        loading="lazy"
        src={src}
        onError={() => setFailedPlayerId(player.id)}
      />
    </span>
  )
}
