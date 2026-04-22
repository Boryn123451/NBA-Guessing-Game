import { DRAFT_CLUE_KEYS, DRAFT_CLUE_LABELS, getDraftPickBucketLabel } from '../lib/nba/draftMode'
import type { DraftGuessResult } from '../lib/nba/draftMode'
import { formatJerseyNumber, formatNumericDirectionSymbol } from '../lib/nba/format'
import { PlayerAvatar } from './PlayerAvatar'

interface DraftClueGridProps {
  rows: DraftGuessResult[]
  showNumericArrows: boolean
}

function getCellValue(result: DraftGuessResult, key: (typeof DRAFT_CLUE_KEYS)[number]) {
  const player = result.guess

  switch (key) {
    case 'player':
      return (
        <div className="clue-grid__player">
          <PlayerAvatar player={player} />
          <div>
            <div className="clue-grid__player-name">{player.displayName}</div>
            <div className="clue-grid__player-meta">{player.teamAbbreviation}</div>
          </div>
        </div>
      )
    case 'draftTeam':
      return player.draft.teamAbbreviation ?? 'N/A'
    case 'draftYear':
      return player.draft.year ?? 'N/A'
    case 'draftRound':
      return player.draft.isUndrafted ? 'UDFA' : formatJerseyNumber(player.draft.round)
    case 'draftPickBucket':
      return getDraftPickBucketLabel(player)
    case 'lottery':
      return player.draft.pick !== null && player.draft.pick <= 14 ? 'Yes' : 'No'
    case 'undrafted':
      return player.draft.isUndrafted ? 'Yes' : 'No'
  }
}

export function DraftClueGrid({
  rows,
  showNumericArrows,
}: DraftClueGridProps) {
  return (
    <section className="clue-grid">
      <div className="clue-grid__scroller">
        <div className="clue-grid__header">
          {DRAFT_CLUE_KEYS.map((key) => (
            <div
              key={key}
              className={`clue-grid__cell clue-grid__cell--head clue-grid__cell--${key}`}
            >
              {DRAFT_CLUE_LABELS[key]}
            </div>
          ))}
        </div>
        {rows.length > 0 ? (
          rows.map((result) => (
            <div key={result.guess.id} className="clue-grid__row">
              {DRAFT_CLUE_KEYS.map((key) => {
                const clue = result.clues[key]
                const isNumeric = key === 'draftYear'

                return (
                  <div
                    key={`${result.guess.id}-${key}`}
                    className={`clue-grid__cell clue-grid__cell--${key} is-${clue.status}`}
                  >
                    <span className="clue-grid__label">{DRAFT_CLUE_LABELS[key]}</span>
                    <span className="clue-grid__value">{getCellValue(result, key)}</span>
                    {showNumericArrows && isNumeric && clue.direction ? (
                      <span
                        className="clue-grid__direction"
                        aria-label={clue.direction === 'up' ? 'Target is higher' : 'Target is lower'}
                        role="img"
                      >
                        {formatNumericDirectionSymbol(clue.direction)}
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))
        ) : (
          <div className="clue-grid__empty">
            Draft board is empty. Make a guess to start the draft trail.
          </div>
        )}
      </div>
    </section>
  )
}
