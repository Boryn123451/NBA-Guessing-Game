import {
  getSeasonSnapshotCluesWithPostseason,
  isSeasonSnapshotClueRevealed,
} from '../lib/nba/seasonSnapshot'
import type { GameOutcome, PlayerRecord } from '../lib/nba/types'

interface SeasonSnapshotPanelProps {
  player: PlayerRecord
  guessCount: number
  status: GameOutcome
  includePostseason: boolean
  embedded?: boolean
}

export function SeasonSnapshotPanel({
  guessCount,
  includePostseason,
  player,
  status,
  embedded = false,
}: SeasonSnapshotPanelProps) {
  const clues = getSeasonSnapshotCluesWithPostseason(player, includePostseason)

  return (
    <section className="snapshot-panel">
      {!embedded ? (
        <div className="panel-heading">
          <span className="eyebrow">Season snapshot</span>
          <h3>Late-round clues</h3>
        </div>
      ) : null}
      <div className="snapshot-panel__grid">
        {clues.map((clue) => {
          const isRevealed = isSeasonSnapshotClueRevealed(clue, guessCount, status)

          return (
            <article
              key={clue.id}
              className={`snapshot-card ${isRevealed ? 'is-revealed' : 'is-locked'}`}
            >
              <span className="clue-grid__label">{clue.label}</span>
              <strong>{isRevealed ? clue.value : 'Locked'}</strong>
              <p>{isRevealed ? 'Revealed' : `Unlocks after miss ${clue.revealAfterMisses}`}</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
