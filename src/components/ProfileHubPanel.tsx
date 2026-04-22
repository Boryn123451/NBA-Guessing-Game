import { useState } from 'react'

import type {
  DifficultyStats,
  GameMode,
  LocalProfile,
  ProgressionState,
  RetroThemeId,
  ThemeMode,
  UnitSystem,
} from '../lib/nba/types'
import { ProfilePanel } from './ProfilePanel'
import { SettingsPanel } from './SettingsPanel'
import { ThemeStorePanel } from './ThemeStorePanel'

type HubTabId = 'profile' | 'shop' | 'settings'

interface ProfileHubPanelProps {
  activeRetroThemeId: RetroThemeId
  exportPayload: string
  isCompact?: boolean
  isStorageAvailable: boolean
  nextWeeklyResetCountdown: string
  profile: LocalProfile
  progression: ProgressionState
  stats: Record<GameMode, DifficultyStats>
  theme: ThemeMode
  units: UnitSystem
  onDisplayNameChange: (displayName: string) => void
  onImport: (rawValue: string) => { ok: true } | { ok: false; error: string }
  onRetroThemeActivate: (themeId: RetroThemeId) => void
  onRetroThemeUnlock: (themeId: RetroThemeId) => void
  onThemeChange: (theme: ThemeMode) => void
  onUnitsChange: (units: UnitSystem) => void
}

const HUB_TABS: Array<{ id: HubTabId; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'shop', label: 'Shop' },
  { id: 'settings', label: 'Settings' },
]

export function ProfileHubPanel({
  activeRetroThemeId,
  exportPayload,
  isCompact = false,
  isStorageAvailable,
  nextWeeklyResetCountdown,
  onDisplayNameChange,
  onImport,
  onRetroThemeActivate,
  onRetroThemeUnlock,
  onThemeChange,
  onUnitsChange,
  profile,
  progression,
  stats,
  theme,
  units,
}: ProfileHubPanelProps) {
  const [activeTab, setActiveTab] = useState<HubTabId>('profile')

  return (
    <div className={`profile-hub ${isCompact ? 'is-compact' : ''}`}>
      <div className="profile-hub__tabs" role="tablist" aria-label="Profile hub tabs">
        {HUB_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`theme-chip ${activeTab === tab.id ? 'is-active' : ''}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'profile' ? (
        <ProfilePanel
          exportPayload={exportPayload}
          isCompact={isCompact}
          isStorageAvailable={isStorageAvailable}
          nextWeeklyResetCountdown={nextWeeklyResetCountdown}
          profile={profile}
          progression={progression}
          stats={stats}
          onDisplayNameChange={onDisplayNameChange}
          onImport={onImport}
        />
      ) : null}

      {activeTab === 'shop' ? (
        <ThemeStorePanel
          activeThemeId={activeRetroThemeId}
          profile={profile}
          onActivate={onRetroThemeActivate}
          onUnlock={onRetroThemeUnlock}
        />
      ) : null}

      {activeTab === 'settings' ? (
        <div className="settings-hub">
          <div className="settings-hub__summary">
            <article className="record-card">
              <span className="stats-strip__label">Color mode</span>
              <strong>{theme}</strong>
              <span>Controls light, dark, or system rendering.</span>
            </article>
            <article className="record-card">
              <span className="stats-strip__label">Units</span>
              <strong>{units}</strong>
              <span>Switches height presentation without touching round state.</span>
            </article>
            <article className="record-card">
              <span className="stats-strip__label">Active pack</span>
              <strong>{activeRetroThemeId}</strong>
              <span>Decade presentation packs are bought in the shop tab.</span>
            </article>
          </div>
          <SettingsPanel
            theme={theme}
            units={units}
            onThemeChange={onThemeChange}
            onUnitsChange={onUnitsChange}
          />
        </div>
      ) : null}
    </div>
  )
}
