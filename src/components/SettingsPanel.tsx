import type { ThemeMode, UnitSystem } from '../lib/nba/types'

interface SettingsPanelProps {
  units: UnitSystem
  theme: ThemeMode
  onUnitsChange: (units: UnitSystem) => void
  onThemeChange: (theme: ThemeMode) => void
}

function ToggleButton<T extends string>({
  label,
  active,
  onClick,
}: {
  label: T
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`toggle-chip ${active ? 'is-active' : ''}`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export function SettingsPanel({
  units,
  theme,
  onUnitsChange,
  onThemeChange,
}: SettingsPanelProps) {
  return (
    <section className="settings-panel">
      <div className="panel-heading">
        <span className="eyebrow">Settings</span>
        <h3>Display</h3>
      </div>
      <div className="settings-panel__group">
        <span className="settings-panel__label">Units</span>
        <div className="toggle-row">
          <ToggleButton
            active={units === 'imperial'}
            label="Imperial"
            onClick={() => onUnitsChange('imperial')}
          />
          <ToggleButton
            active={units === 'metric'}
            label="Metric"
            onClick={() => onUnitsChange('metric')}
          />
        </div>
      </div>
      <div className="settings-panel__group">
        <span className="settings-panel__label">Theme</span>
        <div className="toggle-row">
          <ToggleButton
            active={theme === 'system'}
            label="System"
            onClick={() => onThemeChange('system')}
          />
          <ToggleButton
            active={theme === 'dark'}
            label="Dark"
            onClick={() => onThemeChange('dark')}
          />
          <ToggleButton
            active={theme === 'light'}
            label="Light"
            onClick={() => onThemeChange('light')}
          />
        </div>
      </div>
    </section>
  )
}
