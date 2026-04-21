import { DIFFICULTY_DEFINITIONS } from '../lib/nba/difficulty'
import { getAverageGuesses, getWinRate } from '../lib/storage'
import type { DifficultyStats, GameMode } from '../lib/nba/types'

interface StatsPanelProps {
  stats: Record<GameMode, DifficultyStats>
}

function renderStatsStrip(stats: DifficultyStats['overall']) {
  return (
    <div className="stats-strip">
      <div>
        <span className="stats-strip__label">Played</span>
        <strong>{stats.gamesPlayed}</strong>
      </div>
      <div>
        <span className="stats-strip__label">Wins</span>
        <strong>{stats.wins}</strong>
      </div>
      <div>
        <span className="stats-strip__label">Losses</span>
        <strong>{stats.losses}</strong>
      </div>
      <div>
        <span className="stats-strip__label">Win rate</span>
        <strong>{getWinRate(stats)}</strong>
      </div>
      <div>
        <span className="stats-strip__label">Streak</span>
        <strong>{stats.currentStreak}</strong>
      </div>
      <div>
        <span className="stats-strip__label">Best</span>
        <strong>{stats.maxStreak}</strong>
      </div>
      <div>
        <span className="stats-strip__label">Avg. guesses</span>
        <strong>{getAverageGuesses(stats)}</strong>
      </div>
    </div>
  )
}

export function StatsPanel({
  stats,
}: StatsPanelProps) {
  return (
    <section className="stats-panel">
      <div className="panel-heading">
        <span className="eyebrow">Local stats</span>
        <h3>Track your read</h3>
      </div>
      <p className="stats-panel__copy">
        Daily and Practice stay separate. Each mode now also breaks results down by difficulty.
      </p>
      <div className="stats-panel__rows">
        {(['daily', 'practice'] as const).map((mode) => (
          <div key={mode} className="stats-panel__mode">
            <div className="stats-panel__mode-title">{mode === 'daily' ? 'Daily' : 'Practice'}</div>
            {renderStatsStrip(stats[mode].overall)}
            <div className="stats-panel__difficulty-grid">
              {DIFFICULTY_DEFINITIONS.map((difficulty) => {
                const difficultyStats = stats[mode].byDifficulty[difficulty.id]

                return (
                  <article key={difficulty.id} className="stats-panel__difficulty-card">
                    <span className="stats-strip__label">{difficulty.label}</span>
                    <strong>{difficultyStats.gamesPlayed} played</strong>
                    <span>{getWinRate(difficultyStats)} win rate</span>
                    <span>{getAverageGuesses(difficultyStats)} avg. guesses</span>
                    <span>Streak {difficultyStats.currentStreak}</span>
                  </article>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

