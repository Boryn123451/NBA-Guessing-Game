import { useEffect, useState } from 'react'

import { BonusCluesPanel } from './components/BonusCluesPanel'
import { CareerPathPanel } from './components/CareerPathPanel'
import { ClueGrid } from './components/ClueGrid'
import { GuessInput } from './components/GuessInput'
import { GuessLedger } from './components/GuessLedger'
import { MysteryPortrait } from './components/MysteryPortrait'
import { SeasonSnapshotPanel } from './components/SeasonSnapshotPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { StatsPanel } from './components/StatsPanel'
import { VariantControls } from './components/VariantControls'
import { useGameSession } from './hooks/useGameSession'
import {
  formatAge,
  formatClueModeLabel,
  formatDifficultyLabel,
  formatHeight,
  formatModeLabel,
  formatRefreshDate,
  formatThemeLabel,
} from './lib/nba/format'

export default function App() {
  const game = useGameSession()
  const [shareStatus, setShareStatus] = useState('')
  const isComplete = game.activeSession.status !== 'in_progress'
  const didWin = game.activeSession.status === 'won'
  const modeLabel = formatModeLabel(game.activeMode)
  const clueModeLabel = formatClueModeLabel(game.activeClueMode)
  const difficultyLabel = formatDifficultyLabel(game.activeDifficultyId)
  const themeLabel = formatThemeLabel(game.activeThemeId)
  const revealLine = `${game.activeTarget.teamName} | ${game.activeTarget.position} | ${formatHeight(
    game.activeTarget,
    game.settings.units,
  )} | Age ${formatAge(game.activeTarget, game.dailyDateKey, game.activeDifficultyId)} | ${game.activeTarget.country ?? 'Country unavailable'}`
  const boardGuidance = game.profileWarning
    ? game.profileWarning
    : game.activeClueMode === 'career'
      ? 'Career Path Mode trades the compare grid for a background dossier. Misses unlock deeper biography and history clues.'
      : game.activeDifficulty.ui.showRoundGuidance
        ? 'Read the roster lane, cross-check the traits, and use the portrait reveal only as a last confirmation.'
        : 'Minimal assistance. Read the board and work the deduction.'

  useEffect(() => {
    document.documentElement.dataset.theme = game.settings.theme
  }, [game.settings.theme])

  useEffect(() => {
    if (!shareStatus) {
      return
    }

    const timer = window.setTimeout(() => setShareStatus(''), 2200)
    return () => window.clearTimeout(timer)
  }, [shareStatus])

  async function handleShare(): Promise<void> {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Full Court Cipher',
          text: game.shareText,
        })
        setShareStatus('Shared.')
        return
      }

      await navigator.clipboard.writeText(game.shareText)
      setShareStatus('Copied.')
    } catch {
      setShareStatus('Share cancelled.')
    }
  }

  return (
    <div className="app-shell">
      <div className="app-shell__backdrop" />
      <header className="app-header">
        <div className="app-header__brand">
          <span className="eyebrow">NBA deduction game</span>
          <h1>Full Court Cipher</h1>
          <p>
            Track the roster trail, stay within the difficulty rules, and identify the current NBA
            player before the board runs dry.
          </p>
        </div>
        <div className="app-header__controls">
          <div className="mode-switch" role="tablist" aria-label="Game modes">
            <button
              className={game.activeMode === 'daily' ? 'is-active' : ''}
              type="button"
              onClick={() => game.setMode('daily')}
            >
              Daily
            </button>
            <button
              className={game.activeMode === 'practice' ? 'is-active' : ''}
              type="button"
              onClick={() => game.setMode('practice')}
            >
              Practice
            </button>
          </div>
          <div className="app-header__meta">
            <span className="meta-pill">
              {game.activeMode === 'daily'
                ? `Next reset in ${game.resetCountdown}`
                : 'Unlimited random current players'}
            </span>
            <span className="meta-pill">
              {difficultyLabel} | {clueModeLabel} | {themeLabel}
            </span>
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="workspace__hero">
          <MysteryPortrait
            difficulty={game.activeDifficulty}
            guessCount={game.activeSession.guessIds.length}
            player={game.activeTarget}
            silhouetteRevealed={game.activeSession.silhouetteRevealed}
            status={game.activeSession.status}
          />

          <section className="status-panel">
            <div className="panel-heading">
              <span className="eyebrow">{modeLabel} board</span>
              <h3>
                {didWin
                  ? `Solved in ${game.activeSession.guessIds.length}`
                  : game.activeSession.status === 'lost'
                    ? 'Out of guesses'
                    : `${game.remainingGuesses} guesses left`}
              </h3>
            </div>
            <p className="status-panel__body">{isComplete ? revealLine : boardGuidance}</p>
            <div className="status-panel__tags">
              <span className="meta-pill">{difficultyLabel}</span>
              <span className="meta-pill">{themeLabel}</span>
              <span className="meta-pill">{game.activePlayerCount} players live in this pool</span>
            </div>
            <div className="status-panel__actions">
              {isComplete ? (
                <button className="action-button" type="button" onClick={() => void handleShare()}>
                  Share result
                </button>
              ) : null}
              {game.canRevealSilhouette ? (
                <button
                  className="action-button action-button--ghost"
                  type="button"
                  onClick={game.revealSilhouette}
                >
                  Use silhouette hint
                </button>
              ) : null}
              <button
                className="action-button action-button--ghost"
                type="button"
                onClick={game.startPracticeGame}
              >
                New practice puzzle
              </button>
            </div>
            {shareStatus ? <div className="status-panel__toast">{shareStatus}</div> : null}
          </section>
        </section>

        <section className="workspace__board">
          <div className="board-heading">
            <div>
              <span className="eyebrow">Guess a current player</span>
              <h2>Follow the clue lane</h2>
            </div>
            <div className="board-heading__meta">
              <strong>Roster updated {formatRefreshDate(game.dataMeta.rosterFreshness.refreshedAt)}</strong>
              <span>{game.dataMeta.eligibility.rules[1]}</span>
            </div>
          </div>

          <VariantControls
            activePlayerCount={game.activePlayerCount}
            clueMode={game.activeClueMode}
            difficultyId={game.activeDifficultyId}
            difficultyOptions={game.difficultyOptions}
            locked={game.roundLocked}
            showCareerPathOption={game.showCareerPathOption}
            themeId={game.activeThemeId}
            themeOptions={game.themeOptions}
            themeSummary={game.activeThemeSummary}
            onClueModeChange={game.setClueMode}
            onDifficultyChange={game.setDifficulty}
            onThemeChange={game.setThemeId}
          />

          <GuessInput
            key={`${game.activeClueMode}:${game.activeThemeId}:${game.activeDifficultyId}`}
            blockedTeamId={game.blockedTeamId}
            closeGuessFeedback={game.closeGuessFeedback}
            difficulty={game.activeDifficulty}
            disabled={!game.canGuess}
            guessedIds={game.guessedIds}
            players={game.players}
            onGuess={game.submitGuess}
          />

          {game.activeClueMode === 'standard' ? (
            <>
              <ClueGrid
                difficultyId={game.activeDifficultyId}
                referenceDate={game.dailyDateKey}
                rows={game.guessResults}
                showNumericArrows={game.activeDifficulty.showNumericArrows}
                units={game.settings.units}
              />
              {game.showBonusClues ? (
                <BonusCluesPanel
                  canReveal={game.canRevealBonusClue}
                  clues={game.revealedBonusClues}
                  onReveal={game.revealBonusClue}
                />
              ) : null}
            </>
          ) : (
            <>
              <CareerPathPanel
                guessCount={game.activeSession.guessIds.length}
                player={game.activeTarget}
                status={game.activeSession.status}
              />
              <GuessLedger guesses={game.guessedPlayers} targetPlayerId={game.activeTarget.id} />
            </>
          )}

          {game.showSeasonSnapshot ? (
            <SeasonSnapshotPanel
              guessCount={game.activeSession.guessIds.length}
              player={game.activeTarget}
              status={game.activeSession.status}
            />
          ) : null}

          <div className="workspace__footer">
            <SettingsPanel
              theme={game.settings.theme}
              units={game.settings.units}
              onThemeChange={game.setTheme}
              onUnitsChange={game.setUnits}
            />
            <StatsPanel stats={game.stats} />
          </div>
        </section>
      </main>
    </div>
  )
}

