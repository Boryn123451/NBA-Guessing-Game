import { getCareerPathClues, isCareerClueRevealed } from '../lib/nba/careerPath'
import type { GameOutcome, PlayerRecord } from '../lib/nba/types'

interface CareerPathPanelProps {
  player: PlayerRecord
  guessCount: number
  status: GameOutcome
}

export function CareerPathPanel({
  guessCount,
  player,
  status,
}: CareerPathPanelProps) {
  const clues = getCareerPathClues(player)

  return (
    <section className="career-panel">
      <div className="panel-heading">
        <span className="eyebrow">Career path mode</span>
        <h3>Background dossier</h3>
      </div>
      <div className="career-panel__grid">
        {clues.map((clue) => {
          const isRevealed = isCareerClueRevealed(clue, guessCount, status)

          return (
            <article
              key={clue.id}
              className={`career-card ${isRevealed ? 'is-revealed' : 'is-locked'}`}
            >
              <span className="clue-grid__label">{clue.label}</span>
              <strong>{isRevealed ? clue.value : 'Locked'}</strong>
              <p>
                {isRevealed
                  ? 'Revealed'
                  : clue.revealAfterMisses === 0
                    ? 'Available from the opening tip'
                    : `Unlocks after miss ${clue.revealAfterMisses}`}
              </p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
