import { formatAge, formatHeight } from '../lib/nba/format'
import type { DraftGuessResult } from '../lib/nba/draftMode'
import type { ClueMode, DifficultyId, GuessResult, PlayerRecord, UnitSystem } from '../lib/nba/types'
import { PlayerAvatar } from './PlayerAvatar'

interface PostGameExplainerProps {
  clueMode: ClueMode
  draftGuessResults: DraftGuessResult[]
  difficultyId: DifficultyId
  guesses: GuessResult[]
  player: PlayerRecord
  referenceDate: string
  units: UnitSystem
}

function rankStandardGuesses(guesses: GuessResult[]) {
  return guesses
    .filter((guess) => !guess.isCorrect)
    .map((guess) => ({
      guess,
      score: Object.values(guess.clues).reduce((total, clue) => {
        if (clue.status === 'exact') {
          return total + 2
        }

        if (clue.status === 'close') {
          return total + 1
        }

        return total
      }, 0),
    }))
    .toSorted((left, right) => right.score - left.score)
    .slice(0, 3)
}

function rankDraftGuesses(guesses: DraftGuessResult[]) {
  return guesses
    .filter((guess) => !guess.isCorrect)
    .map((guess) => ({
      guess,
      score: Object.values(guess.clues).reduce((total, clue) => {
        if (clue.status === 'exact') {
          return total + 2
        }

        if (clue.status === 'close') {
          return total + 1
        }

        return total
      }, 0),
    }))
    .toSorted((left, right) => right.score - left.score)
    .slice(0, 3)
}

export function PostGameExplainer({
  clueMode,
  draftGuessResults,
  difficultyId,
  guesses,
  player,
  referenceDate,
  units,
}: PostGameExplainerProps) {
  const closeStandardGuesses = rankStandardGuesses(guesses)
  const closeDraftGuesses = rankDraftGuesses(draftGuessResults)
  const accoladeDetails = [
    player.career.championships > 0 ? `NBA Champion x${player.career.championships}` : null,
    ...player.career.accolades.filter(
      (accolade) => !accolade.toLowerCase().startsWith('nba champion'),
    ),
  ]
    .filter(Boolean)
    .slice(0, 4)
    .join(' | ')

  return (
    <section className="explainer-panel">
      <div className="panel-heading">
        <span className="eyebrow">Post-game explainer</span>
        <h3>Why this answer fit</h3>
      </div>

      <div className="explainer-panel__hero">
        <div className="clue-grid__player">
          <PlayerAvatar player={player} size="md" />
          <div>
            <strong>{player.displayName}</strong>
            <span>
              {player.teamAbbreviation} | {player.position} | {formatHeight(player, units)} | Age{' '}
              {formatAge(player, referenceDate, difficultyId)}
            </span>
          </div>
        </div>
        <p>
          {clueMode === 'draft'
            ? `${player.displayName} fit Draft Mode through ${player.draft.teamAbbreviation ?? 'N/A'} in ${player.draft.year ?? 'N/A'}, ${player.draft.isUndrafted ? 'undrafted status' : `round ${player.draft.round ?? 'N/A'} and pick ${player.draft.pick ?? 'N/A'}`}.`
            : `${player.displayName} fit the board through ${player.teamName}, ${player.conference}, ${player.division}, ${player.position}, and the numeric profile that stayed consistent across the round.`}
        </p>
      </div>

      <div className="explainer-panel__grid">
        <article className="explainer-card">
          <span className="clue-grid__label">Draft profile</span>
          <strong>
            {player.draft.isUndrafted
              ? 'Undrafted'
              : `${player.draft.teamAbbreviation ?? 'N/A'} | ${player.draft.year ?? 'N/A'} | Round ${player.draft.round ?? 'N/A'} | Pick ${player.draft.pick ?? 'N/A'}`}
          </strong>
          <p>{player.career.preNbaPath ?? player.college ?? 'Pre-NBA path unavailable'}</p>
        </article>
        <article className="explainer-card">
          <span className="clue-grid__label">Career path</span>
          <strong>
            {player.career.previousTeamAbbreviations.length > 0
              ? player.career.previousTeamAbbreviations.join(' | ')
              : 'No prior NBA teams'}
          </strong>
          <p>Debut year {player.career.debutYear ?? 'N/A'} | Country {player.country ?? 'N/A'}</p>
        </article>
        <article className="explainer-card">
          <span className="clue-grid__label">Career accolades</span>
          <strong>{player.career.primaryAccolade ?? 'No major accolade label available'}</strong>
          <p>
            {accoladeDetails || 'No extra accolade data available'}
          </p>
        </article>
      </div>

      <div className="explainer-panel__closers">
        <span className="clue-grid__label">Closest guesses</span>
        {clueMode === 'draft'
          ? closeDraftGuesses.map(({ guess }) => (
              <div key={guess.guess.id} className="explainer-close-row">
                <strong>{guess.guess.displayName}</strong>
                <span>Matched part of the draft profile but missed the full board.</span>
              </div>
            ))
          : closeStandardGuesses.map(({ guess }) => (
              <div key={guess.guess.id} className="explainer-close-row">
                <strong>{guess.guess.displayName}</strong>
                <span>Shared several roster clues before missing on the full profile.</span>
              </div>
            ))}
      </div>
    </section>
  )
}
