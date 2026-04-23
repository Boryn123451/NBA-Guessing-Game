import { getPlayerEntryDraftYear } from '../lib/nba/decades'
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

function formatAverage(value: number | null): string {
  return value === null ? 'N/A' : value.toFixed(1)
}

function getAccoladeChips(player: PlayerRecord): string[] {
  const accoladeSet = new Set<string>()

  if (player.career.championships > 0) {
    accoladeSet.add(
      player.career.championships === 1
        ? 'NBA Champion'
        : `NBA Champion x${player.career.championships}`,
    )
  }

  for (const accolade of player.career.accolades) {
    accoladeSet.add(accolade)
  }

  return [...accoladeSet]
}

function getDraftProfile(player: PlayerRecord): {
  primary: string
  secondary: string
} {
  const entryDraftYear = getPlayerEntryDraftYear(player)

  if (player.draft.isUndrafted) {
    return {
      primary: entryDraftYear !== null ? `Undrafted | Entry class ${entryDraftYear}` : 'Undrafted',
      secondary:
        player.entryDraftYearSource === 'debut-fallback'
          ? `${player.career.preNbaPath ?? player.college ?? 'Pre-NBA path unavailable'} | Entry year falls back to NBA debut year.`
          : player.career.preNbaPath ?? player.college ?? 'Pre-NBA path unavailable',
    }
  }

  return {
    primary: `${player.draft.teamAbbreviation ?? 'N/A'} | ${entryDraftYear ?? 'N/A'} | Round ${player.draft.round ?? 'N/A'} | Pick ${player.draft.pick ?? 'N/A'}`,
    secondary: player.career.preNbaPath ?? player.college ?? 'Pre-NBA path unavailable',
  }
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
  void clueMode
  void draftGuessResults
  void guesses

  const previousTeams = player.career.previousTeamNames
  const accoladeChips = getAccoladeChips(player)
  const draftProfile = getDraftProfile(player)

  return (
    <section className="explainer-panel">
      <div className="panel-heading">
        <span className="eyebrow">Player profile</span>
        <h3>{player.displayName}</h3>
      </div>

      <div className="explainer-panel__hero">
        <div className="clue-grid__player">
          <PlayerAvatar player={player} size="md" />
          <div>
            <strong>{player.teamName}</strong>
            <span>
              {player.teamAbbreviation} | {player.position} | {formatHeight(player, units)} | Age{' '}
              {formatAge(player, referenceDate, difficultyId)}
            </span>
          </div>
        </div>
      </div>

      <div className="explainer-panel__grid">
        <article className="explainer-card">
          <span className="clue-grid__label">Draft profile</span>
          <strong>{draftProfile.primary}</strong>
          <p>{draftProfile.secondary}</p>
        </article>
        <article className="explainer-card">
          <span className="clue-grid__label">Previous NBA teams</span>
          {previousTeams.length > 0 ? (
            <div className="explainer-chip-list">
              {previousTeams.map((teamName) => (
                <span key={teamName} className="explainer-chip">
                  {teamName}
                </span>
              ))}
            </div>
          ) : (
            <strong>No previous NBA teams</strong>
          )}
        </article>
        <article className="explainer-card">
          <span className="clue-grid__label">Accolades</span>
          {accoladeChips.length > 0 ? (
            <div className="explainer-chip-list">
              {accoladeChips.map((accolade) => (
                <span key={accolade} className="explainer-chip">
                  {accolade}
                </span>
              ))}
            </div>
          ) : (
            <strong>No accolade data available</strong>
          )}
        </article>
        <article className="explainer-card">
          <span className="clue-grid__label">Averages</span>
          <div className="explainer-stat-grid">
            <div className="explainer-stat">
              <span className="explainer-stat__label">PTS</span>
              <strong>{formatAverage(player.snapshot.pointsPerGame)}</strong>
            </div>
            <div className="explainer-stat">
              <span className="explainer-stat__label">REB</span>
              <strong>{formatAverage(player.snapshot.reboundsPerGame)}</strong>
            </div>
            <div className="explainer-stat">
              <span className="explainer-stat__label">AST</span>
              <strong>{formatAverage(player.snapshot.assistsPerGame)}</strong>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
