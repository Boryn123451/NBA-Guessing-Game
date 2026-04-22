import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { DIFFICULTY_DEFINITIONS } from '../lib/nba/difficulty'
import { formatDifficultyLabel, formatEventModeLabel } from '../lib/nba/format'
import type {
  DifficultyStats,
  EventModeId,
  GameMode,
  LocalProfile,
  ProgressionState,
  RetroThemeId,
} from '../lib/nba/types'
import { BADGE_DEFINITIONS } from '../lib/profile/badges'
import {
  getCombinedProfileStats,
  getCompletedQuestCount,
} from '../lib/profile/selectors'
import { getAverageGuesses, getWinRate } from '../lib/storage'
import { DailyHistoryCalendar } from './DailyHistoryCalendar'
import { ThemeStorePanel } from './ThemeStorePanel'

interface ProfilePanelProps {
  profile: LocalProfile
  progression: ProgressionState
  stats: Record<GameMode, DifficultyStats>
  exportPayload: string
  nextWeeklyResetCountdown: string
  isStorageAvailable: boolean
  isCompact?: boolean
  activeRetroThemeId: RetroThemeId
  onDisplayNameChange: (displayName: string) => void
  onImport: (rawValue: string) => { ok: true } | { ok: false; error: string }
  onRetroThemeActivate: (themeId: RetroThemeId) => void
  onRetroThemeUnlock: (themeId: RetroThemeId) => void
}

export function ProfilePanel({
  activeRetroThemeId,
  exportPayload,
  isCompact = false,
  isStorageAvailable,
  nextWeeklyResetCountdown,
  onDisplayNameChange,
  onImport,
  onRetroThemeActivate,
  onRetroThemeUnlock,
  profile,
  progression,
  stats,
}: ProfilePanelProps) {
  const [draftName, setDraftName] = useState(profile.displayName)
  const [importValue, setImportValue] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const combinedStats = useMemo(() => getCombinedProfileStats(stats), [stats])
  const unlockedBadgeCount = Object.keys(progression.badges).length
  const completedQuestCount = getCompletedQuestCount(progression)

  useEffect(() => {
    if (!statusMessage) {
      return
    }

    const timer = window.setTimeout(() => setStatusMessage(''), 2200)
    return () => window.clearTimeout(timer)
  }, [statusMessage])

  async function handleCopyExport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(exportPayload)
      setStatusMessage('Profile JSON copied.')
    } catch {
      setStatusMessage('Copy failed on this device.')
    }
  }

  function handleImport(): void {
    const result = onImport(importValue)

    if (!result.ok) {
      setStatusMessage(result.error)
      return
    }

    setImportValue('')
    setStatusMessage('Profile data imported.')
  }

  return (
    <section className={`profile-panel ${isCompact ? 'is-compact' : ''}`}>
      <div className="panel-heading">
        <span className="eyebrow">Local profile</span>
        <h3>{profile.displayName}</h3>
      </div>

      <div className="profile-panel__identity">
        <label className="profile-panel__field">
          <span className="settings-panel__label">Display name</span>
          <input
            className="guess-box__input"
            maxLength={28}
            value={draftName}
            onBlur={() => onDisplayNameChange(draftName)}
            onChange={(event) => setDraftName(event.target.value)}
          />
        </label>
        <div className="profile-panel__meta">
          <span>
            Created{' '}
            {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
              new Date(profile.createdAt),
            )}
          </span>
          <strong>{profile.points} points</strong>
        </div>
      </div>

      {!isStorageAvailable ? (
        <div className="profile-panel__warning">
          Local storage is blocked in this browser. Progress can display, but persistence is not
          reliable.
        </div>
      ) : null}

      <div className="profile-panel__stats-grid">
        <article className="profile-stat-card">
          <span className="stats-strip__label">Played</span>
          <strong>{combinedStats.overall.gamesPlayed}</strong>
        </article>
        <article className="profile-stat-card">
          <span className="stats-strip__label">Win rate</span>
          <strong>{getWinRate(combinedStats.overall)}</strong>
        </article>
        <article className="profile-stat-card">
          <span className="stats-strip__label">Current streak</span>
          <strong>{progression.streaks.currentOverall}</strong>
        </article>
        <article className="profile-stat-card">
          <span className="stats-strip__label">Best streak</span>
          <strong>{progression.records.longestWinStreak}</strong>
        </article>
        <article className="profile-stat-card">
          <span className="stats-strip__label">Avg. guesses</span>
          <strong>{getAverageGuesses(combinedStats.overall)}</strong>
        </article>
        <article className="profile-stat-card">
          <span className="stats-strip__label">Quest progress</span>
          <strong>
            {completedQuestCount}/{progression.weeklyQuests.quests.length}
          </strong>
          <span>Resets in {nextWeeklyResetCountdown}</span>
        </article>
      </div>

      <div className="profile-panel__split">
        <section>
          <div className="profile-panel__section-heading">
            <span className="settings-panel__label">Badges</span>
            <strong>{unlockedBadgeCount}/{BADGE_DEFINITIONS.length} unlocked</strong>
          </div>
          <div className="profile-panel__badges">
            {BADGE_DEFINITIONS.map((badge) => {
              const unlock = progression.badges[badge.id]

              return (
                <article key={badge.id} className={`badge-card ${unlock ? 'is-unlocked' : ''}`}>
                  <strong>{badge.label}</strong>
                  <p>{badge.description}</p>
                  <span>{unlock ? 'Unlocked' : 'Locked'}</span>
                </article>
              )
            })}
          </div>
        </section>

        <section>
          <div className="profile-panel__section-heading">
            <span className="settings-panel__label">My records</span>
          </div>
          <div className="profile-panel__records">
            <article className="record-card">
              <span className="stats-strip__label">Best daily streak</span>
              <strong>{progression.records.bestDailyStreak}</strong>
            </article>
            <article className="record-card">
              <span className="stats-strip__label">Longest win streak</span>
              <strong>{progression.records.longestWinStreak}</strong>
            </article>
            {DIFFICULTY_DEFINITIONS.map((difficulty) => (
              <article key={difficulty.id} className="record-card">
                <span className="stats-strip__label">{formatDifficultyLabel(difficulty.id)}</span>
                <strong>{progression.records.bestSolveByDifficulty[difficulty.id] ?? '-'}</strong>
                <span>Fewest guesses</span>
              </article>
            ))}
            {Object.entries(progression.records.bestEventSolveByEvent).map(([eventId, guessCount]) => (
              <article key={eventId} className="record-card">
                <span className="stats-strip__label">
                  {formatEventModeLabel(eventId as EventModeId)}
                </span>
                <strong>{guessCount}</strong>
                <span>Best event solve</span>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="profile-panel__difficulty">
        <div className="profile-panel__section-heading">
          <span className="settings-panel__label">Per difficulty</span>
        </div>
        <div className="stats-panel__difficulty-grid">
          {DIFFICULTY_DEFINITIONS.map((difficulty) => {
            const difficultyStats = combinedStats.byDifficulty[difficulty.id]

            return (
              <article key={difficulty.id} className="stats-panel__difficulty-card">
                <span className="stats-strip__label">{difficulty.label}</span>
                <strong>{difficultyStats.gamesPlayed} played</strong>
                <span>{getWinRate(difficultyStats)} win rate</span>
                <span>{getAverageGuesses(difficultyStats)} avg. guesses</span>
                <span>Wins {difficultyStats.wins}</span>
              </article>
            )
          })}
        </div>
      </section>

      <section className="profile-panel__mode-breakdown">
        <div className="profile-panel__section-heading">
          <span className="settings-panel__label">Mode split</span>
        </div>
        <div className="profile-panel__records">
          <article className="record-card">
            <span className="stats-strip__label">Daily completed</span>
            <strong>{combinedStats.daily.gamesPlayed}</strong>
          </article>
          <article className="record-card">
            <span className="stats-strip__label">Practice completed</span>
            <strong>{combinedStats.practice.gamesPlayed}</strong>
          </article>
          <article className="record-card">
            <span className="stats-strip__label">Daily wins</span>
            <strong>{combinedStats.daily.wins}</strong>
          </article>
          <article className="record-card">
            <span className="stats-strip__label">Practice wins</span>
            <strong>{combinedStats.practice.wins}</strong>
          </article>
        </div>
      </section>

      <ThemeStorePanel
        activeThemeId={activeRetroThemeId}
        profile={profile}
        onActivate={onRetroThemeActivate}
        onUnlock={onRetroThemeUnlock}
      />

      <DailyHistoryCalendar entries={progression.dailyHistory} />

      <details className="profile-panel__backup">
        <summary>Backup local profile data</summary>
        <div className="profile-panel__backup-body">
          <button className="action-button" type="button" onClick={() => void handleCopyExport()}>
            Copy export JSON
          </button>
          <textarea
            className="profile-panel__textarea"
            placeholder="Paste exported profile JSON here"
            value={importValue}
            onChange={(event) => setImportValue(event.target.value)}
          />
          <button className="action-button action-button--ghost" type="button" onClick={handleImport}>
            Import JSON
          </button>
        </div>
      </details>

      {statusMessage ? <div className="status-panel__toast">{statusMessage}</div> : null}
    </section>
  )
}
