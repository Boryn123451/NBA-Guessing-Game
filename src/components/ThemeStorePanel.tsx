import { RETRO_THEME_DEFINITIONS } from '../lib/profile/retroThemes'
import type { LocalProfile, RetroThemeId } from '../lib/nba/types'

interface ThemeStorePanelProps {
  activeThemeId: RetroThemeId
  profile: LocalProfile
  onActivate: (themeId: RetroThemeId) => void
  onUnlock: (themeId: RetroThemeId) => void
}

export function ThemeStorePanel({
  activeThemeId,
  onActivate,
  onUnlock,
  profile,
}: ThemeStorePanelProps) {
  return (
    <section className="theme-store">
      <div className="profile-panel__section-heading">
        <span className="settings-panel__label">Decade theme store</span>
        <strong>{profile.points} points</strong>
      </div>
      <div className="theme-store__grid">
        {RETRO_THEME_DEFINITIONS.map((theme) => {
          const isUnlocked = profile.unlockedRetroThemeIds.includes(theme.id)
          const canBuy = !isUnlocked && profile.points >= theme.cost

          return (
            <article key={theme.id} className={`theme-pack-card ${activeThemeId === theme.id ? 'is-active' : ''}`}>
              <span className="theme-pack-card__eyebrow">{theme.cost === 0 ? 'Included' : `${theme.cost} points`}</span>
              <strong>{theme.label}</strong>
              <p>{theme.description}</p>
              <span>{theme.previewLine}</span>
              {isUnlocked ? (
                <button
                  className="action-button action-button--ghost"
                  type="button"
                  onClick={() => onActivate(theme.id)}
                >
                  {activeThemeId === theme.id ? 'Active' : 'Use theme'}
                </button>
              ) : (
                <button
                  className="action-button"
                  disabled={!canBuy}
                  type="button"
                  onClick={() => onUnlock(theme.id)}
                >
                  {canBuy ? 'Unlock' : 'Need more points'}
                </button>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
