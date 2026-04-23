import type { DifficultyConfig } from '../lib/nba/difficulty'
import type { PostseasonRule } from '../lib/nba/postseason'
import type {
  ClueMode,
  DifficultyId,
  EntryDecadeId,
  GameMode,
  PlayerPoolScopeId,
  PlayerThemeId,
} from '../lib/nba/types'

interface ThemeOption {
  id: PlayerThemeId
  label: string
  description: string
  count: number
}

interface PlayerPoolScopeOption {
  id: PlayerPoolScopeId
  label: string
  description: string
  count: number | null
  disabled: boolean
}

interface EntryDecadeOption {
  id: EntryDecadeId | null
  label: string
  count: number
  disabled: boolean
}

interface VariantControlsProps {
  mode: GameMode
  clueMode: ClueMode
  difficultyId: DifficultyId
  difficultyOptions: DifficultyConfig[]
  playerPoolScope: PlayerPoolScopeId
  playerPoolScopeOptions: PlayerPoolScopeOption[]
  entryDecadeId: EntryDecadeId | null
  entryDecadeOptions: EntryDecadeOption[]
  themeId: PlayerThemeId
  activePlayerCount: number
  activePoolSummary: string
  themeOptions: ThemeOption[]
  locked: boolean
  isCompact?: boolean
  showCareerPathOption: boolean
  showDraftModeOption: boolean
  showEntryDecadeFilter: boolean
  showPracticePostseasonToggle: boolean
  showThemeFilters: boolean
  postseasonRule: PostseasonRule
  onClueModeChange: (clueMode: ClueMode) => void
  onDifficultyChange: (difficultyId: DifficultyId) => void
  onEntryDecadeChange: (decadeId: EntryDecadeId | null) => void
  onPlayerPoolScopeChange: (scopeId: PlayerPoolScopeId) => void
  onPracticeIncludePostseasonChange: (enabled: boolean) => void
  onThemeChange: (themeId: PlayerThemeId) => void
}

export function VariantControls({
  activePlayerCount,
  activePoolSummary,
  clueMode,
  difficultyId,
  difficultyOptions,
  entryDecadeId,
  entryDecadeOptions,
  isCompact = false,
  locked,
  mode,
  onClueModeChange,
  onDifficultyChange,
  onEntryDecadeChange,
  onPlayerPoolScopeChange,
  onPracticeIncludePostseasonChange,
  onThemeChange,
  playerPoolScope,
  playerPoolScopeOptions,
  postseasonRule,
  showCareerPathOption,
  showDraftModeOption,
  showEntryDecadeFilter,
  showPracticePostseasonToggle,
  showThemeFilters,
  themeId,
  themeOptions,
}: VariantControlsProps) {
  const activeDifficulty =
    difficultyOptions.find((option) => option.id === difficultyId) ?? difficultyOptions[1]
  const activeScopeDescription =
    playerPoolScopeOptions.find((scope) => scope.id === playerPoolScope)?.description ?? ''

  return (
    <section className={`variant-controls ${isCompact ? 'is-compact' : ''}`}>
      <div className="panel-heading">
        <span className="eyebrow">Gameplay settings</span>
        <h3>Board setup</h3>
      </div>
      <p className="variant-controls__intro">
        {mode === 'daily'
          ? 'Daily keeps the shared answer pool fixed. You can still adjust the challenge and clue set before the first guess.'
          : 'Set the pool, clue set, and challenge before your first guess. Practice keeps every gameplay rule available.'}
      </p>
      <div className="variant-controls__meta">
        <span className="meta-pill">{activeDifficulty.label}</span>
        <span className="meta-pill">{mode === 'daily' ? 'Daily rules locked to current roster' : playerPoolScopeOptions.find((scope) => scope.id === playerPoolScope)?.label}</span>
        <span className="meta-pill">{activePlayerCount} eligible players</span>
      </div>

      <div className="variant-controls__group">
        <span className="settings-panel__label">Difficulty</span>
        {isCompact ? (
          <select
            className="variant-controls__select"
            disabled={locked}
            value={difficultyId}
            onChange={(event) => onDifficultyChange(event.target.value as DifficultyId)}
          >
            {difficultyOptions.map((difficulty) => (
              <option key={difficulty.id} value={difficulty.id}>
                {difficulty.label}
              </option>
            ))}
          </select>
        ) : (
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
        )}
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
          <button
            className={`toggle-chip ${clueMode === 'draft' ? 'is-active' : ''}`}
            type="button"
            disabled={locked || !showDraftModeOption}
            onClick={() => onClueModeChange('draft')}
          >
            Draft Mode
          </button>
        </div>
      </div>

      {mode === 'practice' ? (
        <div className="variant-controls__group">
          <span className="settings-panel__label">Player Pool</span>
          {isCompact ? (
            <select
              className="variant-controls__select"
              disabled={locked}
              value={playerPoolScope}
              onChange={(event) => onPlayerPoolScopeChange(event.target.value as PlayerPoolScopeId)}
            >
              {playerPoolScopeOptions.map((scope) => (
                <option key={scope.id} value={scope.id} disabled={scope.disabled}>
                  {scope.count !== null ? `${scope.label} (${scope.count})` : scope.label}
                </option>
              ))}
            </select>
          ) : (
            <div className="variant-controls__chips">
              {playerPoolScopeOptions.map((scope) => (
                <button
                  key={scope.id}
                  className={`theme-chip ${scope.id === playerPoolScope ? 'is-active' : ''}`}
                  type="button"
                  disabled={locked || scope.disabled}
                  onClick={() => onPlayerPoolScopeChange(scope.id)}
                >
                  <span>{scope.label}</span>
                  {scope.count !== null ? <strong>{scope.count}</strong> : null}
                </button>
              ))}
            </div>
          )}
          <div className="variant-controls__summary">
            <span className="variant-controls__summary-copy">
              {activeScopeDescription}
            </span>
            {playerPoolScope === 'history' ? (
              <strong>History mode stays practice-only and uses difficulty-aware curation.</strong>
            ) : null}
          </div>
        </div>
      ) : null}

      {mode === 'practice' && showEntryDecadeFilter ? (
        <div className="variant-controls__group">
          <span className="settings-panel__label">Era</span>
          {isCompact ? (
            <select
              className="variant-controls__select"
              disabled={locked}
              value={entryDecadeId ?? 'all'}
              onChange={(event) =>
                onEntryDecadeChange(
                  event.target.value === 'all'
                    ? null
                    : (event.target.value as EntryDecadeId),
                )
              }
            >
              {entryDecadeOptions.map((option) => (
                <option
                  key={option.id ?? 'all'}
                  value={option.id ?? 'all'}
                  disabled={option.disabled}
                >
                  {`${option.label} (${option.count})`}
                </option>
              ))}
            </select>
          ) : (
            <div className="variant-controls__chips">
              {entryDecadeOptions.map((option) => (
                <button
                  key={option.id ?? 'all'}
                  className={`theme-chip ${option.id === entryDecadeId ? 'is-active' : ''}`}
                  type="button"
                  disabled={locked || option.disabled}
                  onClick={() => onEntryDecadeChange(option.id)}
                >
                  <span>{option.label}</span>
                  <strong>{option.count}</strong>
                </button>
              ))}
            </div>
          )}
          <div className="variant-controls__summary">
            <span className="variant-controls__summary-copy">
              Era filters use the normalized entry class year for both the answer pool and the search list.
            </span>
            {entryDecadeId ? <strong>{entryDecadeId} only</strong> : <strong>All eras</strong>}
          </div>
        </div>
      ) : null}

      {mode === 'practice' && showPracticePostseasonToggle ? (
        <div className="variant-controls__group">
          <span className="settings-panel__label">Postseason Context</span>
          <div className="toggle-row">
            <button
              className={`toggle-chip ${postseasonRule.includePostseason ? 'is-active' : ''}`}
              type="button"
              disabled={postseasonRule.locked || locked}
              onClick={() => onPracticeIncludePostseasonChange(!postseasonRule.includePostseason)}
            >
              {postseasonRule.includePostseason ? 'Postseason On' : 'Postseason Off'}
            </button>
          </div>
          <div className="variant-controls__summary">
            <span className="variant-controls__summary-copy">{postseasonRule.helpText}</span>
            <strong>{postseasonRule.label}</strong>
          </div>
        </div>
      ) : null}

      {mode === 'practice' && showThemeFilters ? (
        <div className="variant-controls__group">
          <span className="settings-panel__label">Theme</span>
          {isCompact ? (
            <select
              className="variant-controls__select"
              disabled={locked}
              value={themeId}
              onChange={(event) => onThemeChange(event.target.value as PlayerThemeId)}
            >
              {themeOptions.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.label} ({theme.count})
                </option>
              ))}
            </select>
          ) : (
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
          )}
        </div>
      ) : null}

      <div className="variant-controls__summary">
        <span className="variant-controls__summary-copy">
          {mode === 'daily'
            ? 'Daily always pulls from the full eligible current roster so the answer stays identical across difficulties.'
            : activePoolSummary}
        </span>
        <strong>{activePlayerCount} eligible players</strong>
      </div>
    </section>
  )
}
