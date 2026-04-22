import type { CSSProperties } from 'react'

import { useResolvedPlayerImage } from '../hooks/useResolvedPlayerImage'
import type { DifficultyConfig } from '../lib/nba/difficulty'
import { getRevealStage } from '../lib/nba/reveal'
import type { GameOutcome, PlayerRecord } from '../lib/nba/types'

interface MysteryPortraitProps {
  player: PlayerRecord
  status: GameOutcome
  wrongGuessCount: number
  silhouetteRevealed: boolean
  difficulty: DifficultyConfig
  isCompact?: boolean
}

export function MysteryPortrait({
  player,
  status,
  wrongGuessCount,
  silhouetteRevealed,
  difficulty,
  isCompact = false,
}: MysteryPortraitProps) {
  const { activeSource, onError } = useResolvedPlayerImage(player)
  const revealStage = getRevealStage(difficulty, wrongGuessCount, status, silhouetteRevealed)

  return (
    <section className={`mystery-panel ${isCompact ? 'is-compact' : ''}`}>
      <div
        className="mystery-panel__frame"
        style={
          {
            '--portrait-blur': `${revealStage.blurPx}px`,
            '--portrait-brightness': revealStage.brightness,
            '--portrait-grayscale': revealStage.grayscale,
            '--portrait-scale': revealStage.scale,
            '--portrait-overlay': revealStage.overlay,
            '--portrait-clip-inset': revealStage.clipInset,
            '--portrait-translate-y': revealStage.translateY,
          } as CSSProperties
        }
      >
        <img
          alt={status === 'in_progress' ? 'Hidden mystery player' : player.displayName}
          className="mystery-panel__image"
          src={activeSource.src}
          onError={onError}
        />
        <div className="mystery-panel__grain" />
        <div className="mystery-panel__scanlines" />
        <div className="mystery-panel__overlay" />
        <div className="mystery-panel__badge">{revealStage.badgeLabel}</div>
      </div>
      <div className="mystery-panel__copy">
        <span className="eyebrow">
          {status === 'in_progress' ? 'Encrypted scouting report' : 'Final reveal'}
        </span>
        <h2>{status === 'in_progress' ? 'Mystery player' : player.displayName}</h2>
        <p>
          {status === 'in_progress'
            ? activeSource.kind === 'fallback'
              ? 'Official headshot missing. Static fallback portrait is loaded behind the reveal.'
              : 'Read the board first. This portrait only opens on the difficulty schedule.'
            : `${player.teamName} | ${player.position}`}
        </p>
      </div>
    </section>
  )
}
