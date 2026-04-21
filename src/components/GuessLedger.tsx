import type { PlayerRecord } from '../lib/nba/types'
import { PlayerAvatar } from './PlayerAvatar'

interface GuessLedgerProps {
  guesses: PlayerRecord[]
  targetPlayerId: number
}

export function GuessLedger({
  guesses,
  targetPlayerId,
}: GuessLedgerProps) {
  return (
    <section className="guess-ledger">
      <div className="panel-heading">
        <span className="eyebrow">Attempt log</span>
        <h3>Guess history</h3>
      </div>
      {guesses.length > 0 ? (
        <div className="guess-ledger__rows">
          {guesses.map((player, index) => (
            <div key={`${player.id}-${index}`} className="guess-ledger__row">
              <span className="guess-ledger__index">{String(index + 1).padStart(2, '0')}</span>
              <div className="guess-ledger__player">
                <PlayerAvatar player={player} />
                <div>
                  <strong>{player.displayName}</strong>
                  <span>
                    {player.teamAbbreviation} | {player.position}
                  </span>
                </div>
              </div>
              <span
                className={`guess-ledger__badge ${
                  player.id === targetPlayerId ? 'is-correct' : 'is-miss'
                }`}
              >
                {player.id === targetPlayerId ? 'Exact' : 'Miss'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="clue-grid__empty">
          No guesses logged yet. In Career Path Mode, the dossier reveals more background after misses.
        </div>
      )}
    </section>
  )
}
