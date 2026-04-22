import { useResolvedPlayerImage } from '../hooks/useResolvedPlayerImage'
import type { PlayerRecord } from '../lib/nba/types'

interface PlayerAvatarProps {
  player: PlayerRecord
  size?: 'sm' | 'md'
}

export function PlayerAvatar({
  player,
  size = 'sm',
}: PlayerAvatarProps) {
  const { activeSource, onError } = useResolvedPlayerImage(player)

  return (
    <span className={`player-avatar player-avatar--${size}`}>
      <img
        alt=""
        loading="lazy"
        src={activeSource.src}
        onError={onError}
      />
    </span>
  )
}
