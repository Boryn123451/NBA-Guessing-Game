import { useState } from 'react'
import type { CSSProperties } from 'react'

import type { DifficultyConfig } from '../lib/nba/difficulty'
import type { GameOutcome, PlayerRecord } from '../lib/nba/types'

const FALLBACK_SRC = '/player-silhouette.svg'

interface MysteryPortraitProps {
  player: PlayerRecord
  status: GameOutcome
  guessCount: number
  silhouetteRevealed: boolean
  difficulty: DifficultyConfig
}

function getRevealAmount(guessCount: number, status: GameOutcome, difficulty: DifficultyConfig): number {
  if (status !== 'in_progress') {
    return 1
  }

  if (difficulty.image.revealEveryMisses === null) {
    return 0
  }

  const revealSteps = Math.floor(guessCount / difficulty.image.revealEveryMisses)
  const maxRevealSteps = Math.max(
    Math.floor(difficulty.maxGuesses / difficulty.image.revealEveryMisses),
    1,
  )
  const progress = Math.min(revealSteps / maxRevealSteps, 1)

  return difficulty.image.baseReveal + (1 - difficulty.image.baseReveal) * Math.pow(progress, difficulty.image.curvePower)
}

export function MysteryPortrait({
  player,
  status,
  guessCount,
  silhouetteRevealed,
  difficulty,
}: MysteryPortraitProps) {
  const [failedPlayerId, setFailedPlayerId] = useState<number | null>(null)
  const src =
    failedPlayerId !== player.id && player.headshotUrl ? player.headshotUrl : FALLBACK_SRC
  const revealAmount = getRevealAmount(guessCount, status, difficulty)
  const silhouetteOnly = status === 'in_progress' && silhouetteRevealed
  const maxRevealSteps =
    difficulty.image.revealEveryMisses === null
      ? 0
      : Math.max(Math.floor(difficulty.maxGuesses / difficulty.image.revealEveryMisses), 1)
  const revealSteps =
    difficulty.image.revealEveryMisses === null
      ? 0
      : Math.floor(guessCount / difficulty.image.revealEveryMisses)
  const badgeLabel =
    status !== 'in_progress'
      ? 'File Open'
      : silhouetteOnly
        ? 'Silhouette'
        : difficulty.image.revealEveryMisses === null
          ? 'Locked File'
          : `Reveal ${Math.min(revealSteps, maxRevealSteps)}/${maxRevealSteps}`

  return (
    <section className="mystery-panel">
      <div
        className="mystery-panel__frame"
        style={
          {
            '--portrait-progress': silhouetteOnly ? 0.12 : revealAmount,
            '--portrait-blur': `${status === 'in_progress' ? (silhouetteOnly ? 0 : (1 - revealAmount) * difficulty.image.maxBlurPx) : 0}px`,
            '--portrait-brightness':
              status === 'in_progress'
                ? silhouetteOnly
                  ? 0.04
                  : 0.1 + revealAmount * 0.72
                : 1,
            '--portrait-grayscale':
              status === 'in_progress' ? (silhouetteOnly ? 1 : 1 - revealAmount * 0.55) : 0,
            '--portrait-scale': status === 'in_progress' ? 1.1 - revealAmount * 0.08 : 1,
            '--portrait-overlay':
              status === 'in_progress'
                ? silhouetteOnly
                  ? 0.82
                  : 0.94 - revealAmount * 0.38
                : 0.08,
          } as CSSProperties
        }
      >
        <img
          alt={status === 'in_progress' ? 'Hidden mystery player' : player.displayName}
          className="mystery-panel__image"
          src={src}
          onError={() => setFailedPlayerId(player.id)}
        />
        <div className="mystery-panel__grain" />
        <div className="mystery-panel__scanlines" />
        <div className="mystery-panel__overlay" />
        <div className="mystery-panel__badge">{badgeLabel}</div>
      </div>
      <div className="mystery-panel__copy">
        <span className="eyebrow">
          {status === 'in_progress' ? 'Encrypted scouting report' : 'Final reveal'}
        </span>
        <h2>{status === 'in_progress' ? 'Mystery player' : player.displayName}</h2>
        <p>
          {status === 'in_progress'
            ? 'Read the board first. This portrait only opens on the difficulty schedule.'
            : `${player.teamName} | ${player.position}`}
        </p>
      </div>
    </section>
  )
}

