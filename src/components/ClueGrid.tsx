import { CLUE_KEYS } from '../lib/nba/comparison'
import {
  CLUE_LABELS,
  formatAge,
  formatHeight,
  formatJerseyNumber,
  formatNumericDirectionSymbol,
} from '../lib/nba/format'
import type { DifficultyId, GuessResult, UnitSystem } from '../lib/nba/types'
import { PlayerAvatar } from './PlayerAvatar'

interface ClueGridProps {
  rows: GuessResult[]
  units: UnitSystem
  referenceDate: string
  difficultyId: DifficultyId
  showNumericArrows: boolean
}

function getCellValue(
  result: GuessResult,
  key: (typeof CLUE_KEYS)[number],
  units: UnitSystem,
  referenceDate: string,
  difficultyId: DifficultyId,
) {
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
    case 'team':
      return player.teamAbbreviation
    case 'conference':
      return player.conference
    case 'division':
      return player.division
    case 'position':
      return player.position
    case 'height':
      return formatHeight(player, units)
    case 'age':
      return formatAge(player, referenceDate, difficultyId)
    case 'jerseyNumber':
      return formatJerseyNumber(player.jerseyNumber)
  }
}

export function ClueGrid({
  difficultyId,
  referenceDate,
  rows,
  showNumericArrows,
  units,
}: ClueGridProps) {
  return (
    <section className="clue-grid">
      <div className="clue-grid__scroller">
        <div className="clue-grid__header">
          {CLUE_KEYS.map((key) => (
            <div
              key={key}
              className={`clue-grid__cell clue-grid__cell--head clue-grid__cell--${key}`}
            >
              {CLUE_LABELS[key]}
            </div>
          ))}
        </div>
        {rows.length > 0 ? (
          rows.map((result) => (
            <div key={result.guess.id} className="clue-grid__row">
              {CLUE_KEYS.map((key) => {
                const clue = result.clues[key]
                const isNumeric = key === 'height' || key === 'age' || key === 'jerseyNumber'

                return (
                  <div
                    key={`${result.guess.id}-${key}`}
                    className={`clue-grid__cell clue-grid__cell--${key} is-${clue.status}`}
                  >
                    <span className="clue-grid__label">{CLUE_LABELS[key]}</span>
                    <span className="clue-grid__value">
                      {getCellValue(result, key, units, referenceDate, difficultyId)}
                    </span>
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
            Your scouting table is blank. Make a guess to light up the board.
          </div>
        )}
      </div>
    </section>
  )
}
