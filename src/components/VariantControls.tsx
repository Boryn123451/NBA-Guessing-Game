import type { DifficultyConfig } from '../lib/nba/difficulty'
import type { ClueMode, DifficultyId, PlayerThemeId } from '../lib/nba/types'

interface ThemeOption {
  id: PlayerThemeId
  label: string
  description: string
  count: number
}

interface VariantControlsProps {
  clueMode: ClueMode
  difficultyId: DifficultyId
  difficultyOptions: DifficultyConfig[]
  themeId: PlayerThemeId
  activePlayerCount: number
  themeSummary: string
  themeOptions: ThemeOption[]
  locked: boolean
  showCareerPathOption: boolean
  onClueModeChange: (clueMode: ClueMode) => void
  onDifficultyChange: (difficultyId: DifficultyId) => void
  onThemeChange: (themeId: PlayerThemeId) => void
}

export function VariantControls({
  activePlayerCount,
  clueMode,
  difficultyId,
  difficultyOptions,
  locked,
  onClueModeChange,
  onDifficultyChange,
  onThemeChange,
  showCareerPathOption,
  themeId,
  themeOptions,
  themeSummary,
}: VariantControlsProps) {
  const activeDifficulty = difficultyOptions.find((option) => option.id === difficultyId) ?? difficultyOptions[1]

  return (
    <section className="variant-controls">
      <div className="variant-controls__group">
        <span className="settings-panel__label">Difficulty</span>
        <div className="variant-controls__chips">
          {difficultyOptions.map((difficulty) => (
            <button
              key={difficulty.id}
              className={`theme-chip ${difficulty.id === difficultyId ? 'is-active' : ''}`}
              type="button"
              disabled={locked}
              onClick={() => onDifficultyChange(difficulty.id)}
            >
              <span>{difficulty.label}</span>
            </button>
          ))}
        </div>
        <div className="variant-controls__summary">
          <span className="variant-controls__summary-copy">{activeDifficulty.description}</span>
          {locked ? <strong>Difficulty locks after the first guess.</strong> : null}
        </div>
      </div>

      <div className="variant-controls__group">
        <span className="settings-panel__label">Clue Set</span>
        <div className="toggle-row">
          <button
            className={`toggle-chip ${clueMode === 'standard' ? 'is-active' : ''}`}
            type="button"
            disabled={locked}
            onClick={() => onClueModeChange('standard')}
          >
            Roster Clues
          </button>
          <button
            className={`toggle-chip ${clueMode === 'career' ? 'is-active' : ''}`}
            type="button"
            disabled={locked || !showCareerPathOption}
            onClick={() => onClueModeChange('career')}
          >
            Career Path
          </button>
        </div>
      </div>

      <div className="variant-controls__group">
        <span className="settings-panel__label">Theme</span>
        <div className="variant-controls__chips">
          {themeOptions.map((theme) => (
            <button
              key={theme.id}
              className={`theme-chip ${theme.id === themeId ? 'is-active' : ''}`}
              type="button"
              disabled={locked}
              onClick={() => onThemeChange(theme.id)}
            >
              <span>{theme.label}</span>
              <strong>{theme.count}</strong>
            </button>
          ))}
        </div>
      </div>

      <div className="variant-controls__summary">
        <span className="variant-controls__summary-copy">{themeSummary}</span>
        <strong>{activePlayerCount} eligible players</strong>
      </div>
    </section>
  )
}

