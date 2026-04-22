import type { BonusClue } from '../lib/nba/bonusClues'
import type { GameOutcome, PlayerRecord } from '../lib/nba/types'
import { BonusCluesPanel } from './BonusCluesPanel'
import { SeasonSnapshotPanel } from './SeasonSnapshotPanel'

interface LateRoundCluesPanelProps {
  canRevealBonusClue: boolean
  includePostseason: boolean
  player: PlayerRecord
  revealedBonusClues: BonusClue[]
  showBonusClues: boolean
  showSeasonSnapshot: boolean
  guessCount: number
  status: GameOutcome
  onRevealBonusClue: () => void
  embedded?: boolean
}

export function LateRoundCluesPanel({
  canRevealBonusClue,
  includePostseason,
  guessCount,
  onRevealBonusClue,
  player,
  revealedBonusClues,
  showBonusClues,
  showSeasonSnapshot,
  status,
  embedded = false,
}: LateRoundCluesPanelProps) {
  if (!showBonusClues && !showSeasonSnapshot) {
    return null
  }

  return (
    <section className="late-round-panel">
      {!embedded ? (
        <div className="panel-heading">
          <span className="eyebrow">Late-round clues</span>
          <h3>Extra reads</h3>
        </div>
      ) : null}
      <div className="late-round-panel__stack">
        {showBonusClues ? (
          <BonusCluesPanel
            canReveal={canRevealBonusClue}
            clues={revealedBonusClues}
            embedded
            onReveal={onRevealBonusClue}
          />
        ) : null}
        {showSeasonSnapshot ? (
          <SeasonSnapshotPanel
            embedded
            guessCount={guessCount}
            includePostseason={includePostseason}
            player={player}
            status={status}
          />
        ) : null}
      </div>
    </section>
  )
}
