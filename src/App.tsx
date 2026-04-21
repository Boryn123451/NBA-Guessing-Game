import { useEffect, useState } from 'react'

import { BonusCluesPanel } from './components/BonusCluesPanel'
import { CareerPathPanel } from './components/CareerPathPanel'
import { CelebrationToasts } from './components/CelebrationToasts'
import { ClueGrid } from './components/ClueGrid'
import { EventModesPanel } from './components/EventModesPanel'
import { GuessInput } from './components/GuessInput'
import { GuessLedger } from './components/GuessLedger'
import { MysteryPortrait } from './components/MysteryPortrait'
import { ProfilePanel } from './components/ProfilePanel'
import { SeasonSnapshotPanel } from './components/SeasonSnapshotPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { VariantControls } from './components/VariantControls'
import { WeeklyQuestPanel } from './components/WeeklyQuestPanel'
import { useGameSession } from './hooks/useGameSession'
import { useResponsiveLayout } from './hooks/useResponsiveLayout'
import {
  formatAge,
  formatClueModeLabel,
  formatDifficultyLabel,
  formatEventModeLabel,
  formatHeight,
  formatModeLabel,
  formatRefreshDate,
  formatThemeLabel,
} from './lib/nba/format'

type MobileView = 'play' | 'quests' | 'profile'

export default function App() {
  const game = useGameSession()
  const { isMobileLayout } = useResponsiveLayout()
  const [shareStatus, setShareStatus] = useState('')
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [mobileView, setMobileView] = useState<MobileView>('play')
  const isComplete = game.activeSession.status !== 'in_progress'
  const didWin = game.activeSession.status === 'won'
  const modeLabel = formatModeLabel(game.activeMode)
  const clueModeLabel = formatClueModeLabel(game.activeClueMode)
  const difficultyLabel = formatDifficultyLabel(game.activeDifficultyId)
  const themeLabel = formatThemeLabel(game.activeThemeId)
  const eventLabel = formatEventModeLabel(game.eventId)
  const revealLine = `${game.activeTarget.teamName} | ${game.activeTarget.position} | ${formatHeight(
    game.activeTarget,
    game.settings.units,
  )} | Age ${formatAge(game.activeTarget, game.dailyDateKey, game.activeDifficultyId)} | ${game.activeTarget.country ?? 'Country unavailable'}`
  const boardGuidance = game.profileWarning
    ? game.profileWarning
    : game.activeClueMode === 'career'
      ? 'Career Path Mode swaps the compare grid for deeper background clues.'
      : game.activeDifficulty.ui.showRoundGuidance
        ? isMobileLayout
          ? 'Read the board first. Mobile trims the extra panels so the guess lane stays readable.'
          : 'Read the roster lane, cross-check the traits, and use the portrait reveal only as a last confirmation.'
        : 'Minimal assistance. Read the board and work the deduction.'
  const shouldShowLateRoundSection =
    (game.showBonusClues && game.activeClueMode === 'standard') || game.showSeasonSnapshot

  useEffect(() => {
    document.documentElement.dataset.theme = game.settings.theme
    document.documentElement.dataset.device = isMobileLayout ? 'mobile' : 'desktop'
  }, [game.settings.theme, isMobileLayout])

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

  function openProfileSurface(): void {
    if (isMobileLayout) {
      setMobileView('profile')
      return
    }

    setIsProfileOpen(true)
  }

  const profileContent = (
    <ProfilePanel
      key={`${game.profile.profileId}:${game.profile.displayName}`}
      exportPayload={game.exportPayload}
      isCompact={isMobileLayout}
      isStorageAvailable={game.isStorageAvailable}
      nextWeeklyResetCountdown={game.nextWeeklyResetCountdown}
      profile={game.profile}
      progression={game.progression}
      stats={game.stats}
      onDisplayNameChange={game.setDisplayName}
      onImport={game.importProfileData}
    />
  )

  const boardContent = (
    <>
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
            <span className="meta-pill">{clueModeLabel}</span>
            <span className="meta-pill">{themeLabel}</span>
            {game.eventId ? <span className="meta-pill">{eventLabel}</span> : null}
            <span className="meta-pill">{game.activePlayerCount} players in pool</span>
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

        {!isMobileLayout ? (
          <WeeklyQuestPanel
            board={game.progression.weeklyQuests}
            countdown={game.nextWeeklyResetCountdown}
            onClaim={game.claimQuest}
          />
        ) : null}
      </section>

      <section className="workspace__board">
        {!isMobileLayout ? (
          <EventModesPanel
            activeEvents={game.activeEventModes}
            locked={game.roundLocked}
            selectedEventId={game.eventId}
            upcomingEvents={game.upcomingEventModes}
            onSelect={game.setEventId}
          />
        ) : null}

        <div className={`board-heading ${isMobileLayout ? 'is-compact' : ''}`}>
          <div>
            <span className="eyebrow">Guess a current player</span>
            <h2>Follow the clue lane</h2>
          </div>
          <div className="board-heading__meta">
            <strong>Roster updated {formatRefreshDate(game.dataMeta.rosterFreshness.refreshedAt)}</strong>
            <span>{isMobileLayout ? `${game.activePlayerCount} eligible players` : game.dataMeta.eligibility.rules[1]}</span>
          </div>
        </div>

        {isMobileLayout ? (
          <details className="mobile-disclosure">
            <summary>Game setup</summary>
            <VariantControls
              activePlayerCount={game.activePlayerCount}
              clueMode={game.activeClueMode}
              difficultyId={game.activeDifficultyId}
              difficultyOptions={game.difficultyOptions}
              isCompact
              locked={game.roundLocked}
              showCareerPathOption={game.showCareerPathOption}
              themeId={game.activeThemeId}
              themeOptions={game.themeOptions}
              themeSummary={game.activeThemeSummary}
              onClueModeChange={game.setClueMode}
              onDifficultyChange={game.setDifficulty}
              onThemeChange={game.setThemeId}
            />
            <SettingsPanel
              theme={game.settings.theme}
              units={game.settings.units}
              onThemeChange={game.setTheme}
              onUnitsChange={game.setUnits}
            />
          </details>
        ) : (
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
        )}

        <GuessInput
          key={`${game.activeClueMode}:${game.activeThemeId}:${game.eventId ?? 'none'}:${game.activeDifficultyId}`}
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
            {game.showBonusClues && !isMobileLayout ? (
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

        {game.showSeasonSnapshot && !isMobileLayout ? (
          <SeasonSnapshotPanel
            guessCount={game.activeSession.guessIds.length}
            player={game.activeTarget}
            status={game.activeSession.status}
          />
        ) : null}

        {isMobileLayout && shouldShowLateRoundSection ? (
          <details className="mobile-disclosure">
            <summary>Late-round clues</summary>
            {game.activeClueMode === 'standard' && game.showBonusClues ? (
              <BonusCluesPanel
                canReveal={game.canRevealBonusClue}
                clues={game.revealedBonusClues}
                onReveal={game.revealBonusClue}
              />
            ) : null}
            {game.showSeasonSnapshot ? (
              <SeasonSnapshotPanel
                guessCount={game.activeSession.guessIds.length}
                player={game.activeTarget}
                status={game.activeSession.status}
              />
            ) : null}
          </details>
        ) : null}

        {!isMobileLayout ? (
          <div className="workspace__footer">
            <SettingsPanel
              theme={game.settings.theme}
              units={game.settings.units}
              onThemeChange={game.setTheme}
              onUnitsChange={game.setUnits}
            />
          </div>
        ) : null}
      </section>
    </>
  )

  return (
    <div className={`app-shell ${isMobileLayout ? 'app-shell--mobile' : ''}`}>
      <div className="app-shell__backdrop" />

      <header className={`app-header ${isMobileLayout ? 'is-mobile' : ''}`}>
        <div className="app-header__brand">
          <span className="eyebrow">NBA deduction game</span>
          <h1>Full Court Cipher</h1>
          <p>
            {isMobileLayout
              ? 'Bigger type, fewer surfaces, same rules. The phone view trims the noise instead of squeezing everything.'
              : 'Track the roster trail, stay within the difficulty rules, and identify the current NBA player before the board runs dry.'}
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
              {difficultyLabel} | {clueModeLabel}
            </span>
            <span className="meta-pill">
              {themeLabel}
              {game.eventId ? ` | ${eventLabel}` : ''}
            </span>
          </div>
          <button
            className="action-button action-button--ghost app-header__profile-trigger"
            type="button"
            onClick={openProfileSurface}
          >
            {isMobileLayout ? 'Open profile' : 'Profile & Records'}
          </button>
        </div>
      </header>

      {isMobileLayout ? (
        <div className="mobile-view-switch" role="tablist" aria-label="Mobile sections">
          <button
            className={mobileView === 'play' ? 'is-active' : ''}
            type="button"
            onClick={() => setMobileView('play')}
          >
            Play
          </button>
          <button
            className={mobileView === 'quests' ? 'is-active' : ''}
            type="button"
            onClick={() => setMobileView('quests')}
          >
            Quests
          </button>
          <button
            className={mobileView === 'profile' ? 'is-active' : ''}
            type="button"
            onClick={() => setMobileView('profile')}
          >
            Profile
          </button>
        </div>
      ) : null}

      <main className={`workspace ${isMobileLayout ? 'is-mobile' : ''}`}>
        {!isMobileLayout || mobileView === 'play' ? boardContent : null}

        {isMobileLayout && mobileView === 'quests' ? (
          <div className="mobile-stack">
            <EventModesPanel
              activeEvents={game.activeEventModes}
              isCompact
              locked={game.roundLocked}
              selectedEventId={game.eventId}
              upcomingEvents={game.upcomingEventModes}
              onSelect={game.setEventId}
            />
            <WeeklyQuestPanel
              board={game.progression.weeklyQuests}
              countdown={game.nextWeeklyResetCountdown}
              isCompact
              onClaim={game.claimQuest}
            />
          </div>
        ) : null}

        {isMobileLayout && mobileView === 'profile' ? (
          <div className="mobile-stack">{profileContent}</div>
        ) : null}
      </main>

      {!isMobileLayout && isProfileOpen ? (
        <div className="modal-overlay" role="presentation" onClick={() => setIsProfileOpen(false)}>
          <div
            aria-modal="true"
            className="modal-sheet"
            role="dialog"
            aria-label="Local profile"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" onClick={() => setIsProfileOpen(false)}>
              Close
            </button>
            {profileContent}
          </div>
        </div>
      ) : null}

      <CelebrationToasts celebrations={game.celebrations} onDismiss={game.dismissCelebration} />
    </div>
  )
}
