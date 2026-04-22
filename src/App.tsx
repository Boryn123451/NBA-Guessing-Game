import { useEffect, useState } from 'react'

import { CelebrationToasts } from './components/CelebrationToasts'
import { CareerPathPanel } from './components/CareerPathPanel'
import { ClueGrid } from './components/ClueGrid'
import { DailyLockoutModal } from './components/DailyLockoutModal'
import { DraftClueGrid } from './components/DraftClueGrid'
import { EventModesPanel } from './components/EventModesPanel'
import { GuessInput } from './components/GuessInput'
import { GuessLedger } from './components/GuessLedger'
import { LateRoundCluesPanel } from './components/LateRoundCluesPanel'
import { MysteryPortrait } from './components/MysteryPortrait'
import { PostGameExplainer } from './components/PostGameExplainer'
import { ProfileHubPanel } from './components/ProfileHubPanel'
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
  formatPlayerPoolScopeLabel,
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
  const [dismissedDailyLockoutDate, setDismissedDailyLockoutDate] = useState<string | null>(null)
  const isComplete = game.activeSession.status !== 'in_progress'
  const didWin = game.activeSession.status === 'won'
  const modeLabel = formatModeLabel(game.activeMode)
  const clueModeLabel = formatClueModeLabel(game.activeClueMode)
  const difficultyLabel = formatDifficultyLabel(game.activeDifficultyId)
  const themeLabel = formatThemeLabel(game.activeThemeId)
  const playerPoolScopeLabel = formatPlayerPoolScopeLabel(game.activePlayerPoolScope)
  const eventLabel = formatEventModeLabel(game.eventId)
  const boardEyebrowLabel =
    game.activePlayerPoolScope === 'history'
      ? 'Guess an NBA player from history'
      : 'Guess a current NBA player'
  const boardPoolLabel =
    game.activeMode === 'daily'
      ? 'Daily full roster'
      : game.activePlayerPoolScope === 'history'
        ? playerPoolScopeLabel
      : game.eventId
        ? eventLabel
        : themeLabel
  const revealLine =
    game.activeClueMode === 'draft'
      ? `${game.activeTarget.draft.teamAbbreviation ?? 'N/A'} | ${game.activeTarget.draft.year ?? 'N/A'} | ${game.activeTarget.draft.isUndrafted ? 'Undrafted' : `Pick ${game.activeTarget.draft.pick ?? 'N/A'}`}`
      : `${game.activeTarget.teamName} | ${game.activeTarget.position} | ${formatHeight(
          game.activeTarget,
          game.settings.units,
        )} | Age ${formatAge(game.activeTarget, game.dailyDateKey, game.activeDifficultyId)} | ${game.activeTarget.country ?? 'Country unavailable'}`
  const boardGuidance =
    game.profileWarning ??
    (game.activeClueMode === 'career'
      ? 'Career Path Mode swaps the compare grid for deeper background clues.'
      : game.activeClueMode === 'draft'
        ? 'Draft Mode shifts the board toward draft identity, year, team, and pick range.'
        : game.activePlayerPoolScope === 'history'
          ? 'All-time scope stays practice-only. Read the strongest lane first and use the portrait as confirmation, not as a shortcut.'
        : game.activeDifficulty.ui.showRoundGuidance
          ? 'Read the strongest lane first, then use the portrait as confirmation instead of a shortcut.'
          : 'Minimal assistance. Read the board and work the deduction.')
  const compactBoardGuidance =
    game.profileWarning ??
    (game.activeClueMode === 'career'
      ? 'Career clues only. No roster grid.'
      : game.activeClueMode === 'draft'
        ? 'Draft clues replace the normal roster board.'
        : game.activePlayerPoolScope === 'history'
          ? 'All-time scope. Read the board first.'
        : game.activeDifficulty.ui.showRoundGuidance
          ? 'Read the board first. Portrait reveal is secondary.'
          : 'Minimal assistance. Work the board.')
  const headerCopy = isMobileLayout
    ? 'Phone view keeps the loop tight: guess, read, check the portrait, guess again.'
    : game.activePlayerPoolScope === 'history'
      ? 'Track the all-time trail, stay within the difficulty rules, and identify the NBA player before the board runs dry.'
      : 'Track the roster trail, stay within the difficulty rules, and identify the current NBA player before the board runs dry.'
  const headerMetaPills = isMobileLayout
    ? [
        game.activeMode === 'daily'
          ? `Next reset in ${game.resetCountdown}`
          : game.activePlayerPoolScope === 'history'
            ? 'Unlimited all-time practice boards'
            : 'Unlimited practice boards',
        `${difficultyLabel} | ${clueModeLabel}`,
      ]
    : game.activeMode === 'daily'
      ? [
          `Next reset in ${game.resetCountdown}`,
          `${difficultyLabel} | ${clueModeLabel}`,
          boardPoolLabel,
          game.activePostseasonRule.label,
        ]
      : [
          game.activePlayerPoolScope === 'history'
            ? 'Unlimited all-time practice boards'
            : 'Unlimited random current players',
          `${difficultyLabel} | ${clueModeLabel}`,
          boardPoolLabel,
          game.activePostseasonRule.label,
        ]
  const statusMetaPills = isMobileLayout
      ? [difficultyLabel, clueModeLabel, `${game.activePlayerCount} in pool`]
    : game.activeMode === 'daily'
      ? [difficultyLabel, clueModeLabel, boardPoolLabel, `${game.activePlayerCount} players in pool`]
      : game.activePlayerPoolScope === 'history'
        ? [
            difficultyLabel,
            clueModeLabel,
            boardPoolLabel,
            `${game.activePlayerCount} players in pool`,
          ]
      : [
          difficultyLabel,
          clueModeLabel,
          boardPoolLabel,
          game.activePostseasonRule.label,
          `${game.activePlayerCount} players in pool`,
        ]

  useEffect(() => {
    document.documentElement.dataset.theme = game.settings.theme
    document.documentElement.dataset.device = isMobileLayout ? 'mobile' : 'desktop'
    document.documentElement.dataset.pack = game.settings.retroThemeId
  }, [game.settings.retroThemeId, game.settings.theme, isMobileLayout])

  useEffect(() => {
    if (!shareStatus) {
      return
    }

    const timer = window.setTimeout(() => setShareStatus(''), 2200)
    return () => window.clearTimeout(timer)
  }, [shareStatus])

  const isDailyLockoutOpen =
    game.activeMode === 'daily' &&
    game.dailyLockedOut &&
    dismissedDailyLockoutDate !== game.dailyDateKey

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

  function switchToPracticeFromLockout(): void {
    setDismissedDailyLockoutDate(game.dailyDateKey)
    game.setMode('practice')
  }

  const profileContent = (
    <ProfileHubPanel
      key={`${game.profile.profileId}:${game.profile.displayName}`}
      activeRetroThemeId={game.settings.retroThemeId}
      exportPayload={game.exportPayload}
      isCompact={isMobileLayout}
      isStorageAvailable={game.isStorageAvailable}
      nextWeeklyResetCountdown={game.nextWeeklyResetCountdown}
      theme={game.settings.theme}
      units={game.settings.units}
      profile={game.profile}
      progression={game.progression}
      stats={game.stats}
      onDisplayNameChange={game.setDisplayName}
      onImport={game.importProfileData}
      onRetroThemeActivate={game.setRetroThemeId}
      onRetroThemeUnlock={game.unlockRetroTheme}
      onThemeChange={game.setTheme}
      onUnitsChange={game.setUnits}
    />
  )

  const statusPanel = (
    <section className={`status-panel ${isMobileLayout ? 'is-compact' : ''}`}>
      <div className="panel-heading">
        <span className="eyebrow">{modeLabel} board</span>
        <h3>
          {didWin
            ? `Solved in ${game.activeSession.guessIds.length}`
            : game.activeSession.status === 'lost'
              ? 'Out of guesses'
              : game.dailyLockedOut && game.activeMode === 'daily'
                ? 'Daily board completed'
                : `${game.remainingGuesses} guesses left`}
        </h3>
      </div>
      <p className="status-panel__body">
        {isComplete ? revealLine : isMobileLayout ? compactBoardGuidance : boardGuidance}
      </p>
      <div className="status-panel__tags">
        {statusMetaPills.map((pill) => (
          <span key={pill} className="meta-pill">
            {pill}
          </span>
        ))}
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
  )

  const boardBody =
    game.activeClueMode === 'standard' ? (
      <ClueGrid
        difficultyId={game.activeDifficultyId}
        referenceDate={game.dailyDateKey}
        rows={game.guessResults}
        showNumericArrows={game.activeDifficulty.showNumericArrows}
        units={game.settings.units}
      />
    ) : game.activeClueMode === 'draft' ? (
      <DraftClueGrid
        rows={game.draftGuessResults}
        showNumericArrows={game.activeDifficulty.showNumericArrows}
      />
    ) : (
      <>
        <CareerPathPanel
          guessCount={game.activeSession.guessIds.length}
          player={game.activeTarget}
          status={game.activeSession.status}
        />
        <GuessLedger guesses={game.guessedPlayers} targetPlayerId={game.activeTarget.id} />
      </>
    )

  const boardContent = (
    <>
      {!isMobileLayout ? (
        <section className="workspace__hero workspace__hero--support">
          <WeeklyQuestPanel
            board={game.progression.weeklyQuests}
            countdown={game.nextWeeklyResetCountdown}
            onClaim={game.claimQuest}
          />
          {game.activeMode === 'practice' ? (
            game.showEventModes ? (
            <EventModesPanel
              activeEvents={game.activeEventModes}
              locked={game.roundLocked}
              selectedEventId={game.eventId}
              upcomingEvents={game.upcomingEventModes}
              onSelect={game.setEventId}
            />
            ) : null
          ) : null}
        </section>
      ) : null}

      <section className="workspace__board">
        <div className={`board-heading ${isMobileLayout ? 'is-compact' : ''}`}>
          <div>
            <span className="eyebrow">{boardEyebrowLabel}</span>
            <h2>Follow the clue lane</h2>
          </div>
          <div className="board-heading__meta">
            <strong>
              Roster updated {formatRefreshDate(game.dataMeta.rosterFreshness.refreshedAt)}
            </strong>
            {!isMobileLayout ? <span>{game.dataMeta.eligibility.rules[1]}</span> : null}
          </div>
        </div>

        {isMobileLayout ? (
          <details className="mobile-disclosure">
            <summary>Board setup</summary>
            <VariantControls
              activePlayerCount={game.activePlayerCount}
              clueMode={game.activeClueMode}
              difficultyId={game.activeDifficultyId}
              difficultyOptions={game.difficultyOptions}
              activePoolSummary={game.activePlayerPoolScopeSummary}
              isCompact
              locked={game.roundLocked}
              mode={game.activeMode}
              playerPoolScope={game.activePlayerPoolScope}
              playerPoolScopeOptions={game.playerPoolScopeOptions}
              postseasonRule={game.activePostseasonRule}
              showCareerPathOption={game.showCareerPathOption}
              showDraftModeOption={game.showDraftModeOption}
              showPracticePostseasonToggle={game.showPracticePostseasonToggle}
              showThemeFilters={game.showThemeFilters}
              themeId={game.activeThemeId}
              themeOptions={game.themeOptions}
              onClueModeChange={game.setClueMode}
              onDifficultyChange={game.setDifficulty}
              onPlayerPoolScopeChange={game.setPlayerPoolScope}
              onPracticeIncludePostseasonChange={game.setPracticeIncludePostseason}
              onThemeChange={game.setThemeId}
            />
          </details>
        ) : (
          <VariantControls
            activePlayerCount={game.activePlayerCount}
            clueMode={game.activeClueMode}
            difficultyId={game.activeDifficultyId}
            difficultyOptions={game.difficultyOptions}
            activePoolSummary={game.activePlayerPoolScopeSummary}
            locked={game.roundLocked}
            mode={game.activeMode}
            playerPoolScope={game.activePlayerPoolScope}
            playerPoolScopeOptions={game.playerPoolScopeOptions}
            postseasonRule={game.activePostseasonRule}
            showCareerPathOption={game.showCareerPathOption}
            showDraftModeOption={game.showDraftModeOption}
            showPracticePostseasonToggle={game.showPracticePostseasonToggle}
            showThemeFilters={game.showThemeFilters}
            themeId={game.activeThemeId}
            themeOptions={game.themeOptions}
            onClueModeChange={game.setClueMode}
            onDifficultyChange={game.setDifficulty}
            onPlayerPoolScopeChange={game.setPlayerPoolScope}
            onPracticeIncludePostseasonChange={game.setPracticeIncludePostseason}
            onThemeChange={game.setThemeId}
          />
        )}

        {!isMobileLayout ? (
          <div className="desktop-loop">
            <MysteryPortrait
              difficulty={game.activeDifficulty}
              isCompact={false}
              player={game.activeTarget}
              silhouetteRevealed={game.activeSession.silhouetteRevealed}
              status={game.activeSession.status}
              wrongGuessCount={
                game.activeSession.status === 'won'
                  ? Math.max(game.activeSession.guessIds.length - 1, 0)
                  : game.activeSession.guessIds.length
              }
            />
            {statusPanel}
          </div>
        ) : null}

        <GuessInput
          key={`${game.activePlayerPoolScope}:${game.activeClueMode}:${game.activeThemeId}:${game.eventId ?? 'none'}:${game.activeDifficultyId}:${game.activePostseasonRule.includePostseason ? 'post' : 'reg'}`}
          blockedTeamId={game.blockedTeamId}
          closeGuessFeedback={game.closeGuessFeedback}
          difficulty={game.activeDifficulty}
          disabled={!game.canGuess}
          guessedIds={game.guessedIds}
          label={game.activePlayerPoolScope === 'history' ? 'Search all-time players' : 'Search eligible players'}
          players={game.players}
          onGuess={game.submitGuess}
        />

        {isMobileLayout ? (
          <div className="mobile-loop">
            <MysteryPortrait
              difficulty={game.activeDifficulty}
              isCompact
              player={game.activeTarget}
              silhouetteRevealed={game.activeSession.silhouetteRevealed}
              status={game.activeSession.status}
              wrongGuessCount={
                game.activeSession.status === 'won'
                  ? Math.max(game.activeSession.guessIds.length - 1, 0)
                  : game.activeSession.guessIds.length
              }
            />
            {statusPanel}
          </div>
        ) : null}

        {boardBody}

        {(game.showBonusClues || game.showSeasonSnapshot) && !isMobileLayout ? (
          <LateRoundCluesPanel
            canRevealBonusClue={game.canRevealBonusClue}
            guessCount={game.activeSession.guessIds.length}
            includePostseason={game.activePostseasonRule.includePostseason}
            player={game.activeTarget}
            revealedBonusClues={game.revealedBonusClues}
            showBonusClues={game.showBonusClues}
            showSeasonSnapshot={game.showSeasonSnapshot}
            status={game.activeSession.status}
            onRevealBonusClue={game.revealBonusClue}
          />
        ) : null}

        {(game.showBonusClues || game.showSeasonSnapshot) && isMobileLayout ? (
          <details className="mobile-disclosure">
            <summary>Late-round clues</summary>
            <LateRoundCluesPanel
              canRevealBonusClue={game.canRevealBonusClue}
              embedded
              guessCount={game.activeSession.guessIds.length}
              includePostseason={game.activePostseasonRule.includePostseason}
              player={game.activeTarget}
              revealedBonusClues={game.revealedBonusClues}
              showBonusClues={game.showBonusClues}
              showSeasonSnapshot={game.showSeasonSnapshot}
              status={game.activeSession.status}
              onRevealBonusClue={game.revealBonusClue}
            />
          </details>
        ) : null}

        {isComplete ? (
          <PostGameExplainer
            clueMode={game.activeClueMode}
            draftGuessResults={game.draftGuessResults}
            difficultyId={game.activeDifficultyId}
            guesses={game.guessResults}
            player={game.activeTarget}
            referenceDate={game.dailyDateKey}
            units={game.settings.units}
          />
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
            {headerCopy}
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
            {headerMetaPills.map((pill) => (
              <span key={pill} className="meta-pill">
                {pill}
              </span>
            ))}
          </div>
          <button
            className="action-button action-button--ghost app-header__profile-trigger"
            type="button"
            onClick={openProfileSurface}
          >
            {isMobileLayout ? 'Open hub' : 'Profile, Shop & Settings'}
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
            {game.activeMode === 'practice' && game.showEventModes ? (
              <EventModesPanel
                activeEvents={game.activeEventModes}
                isCompact
                locked={game.roundLocked}
                selectedEventId={game.eventId}
                upcomingEvents={game.upcomingEventModes}
                onSelect={game.setEventId}
              />
            ) : null}
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

      {isDailyLockoutOpen && game.activeMode === 'daily' && game.dailyLockedOut ? (
        <DailyLockoutModal
          countdown={game.resetCountdown}
          onClose={() => setDismissedDailyLockoutDate(game.dailyDateKey)}
          onSwitchToPractice={switchToPracticeFromLockout}
        />
      ) : null}

      <CelebrationToasts celebrations={game.celebrations} onDismiss={game.dismissCelebration} />
    </div>
  )
}
