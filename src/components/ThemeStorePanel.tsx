import {
  RETRO_THEME_DEFINITIONS,
  isRetroThemeTemporarilyFree,
} from '../lib/profile/retroThemes'
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
      <div className="panel-heading">
        <span className="eyebrow">Theme shop</span>
        <h3>Buy presentation packs</h3>
      </div>
      <p className="theme-store__copy">
        Spend local coins on readable NBA-inspired presentation packs. The Brandon Clarke tribute
        pack is free for everyone until its memorial window closes, then becomes a paid unlock.
      </p>
      <div className="profile-panel__section-heading">
        <span className="settings-panel__label">Available coins</span>
        <strong>{profile.points} coins</strong>
      </div>
      <div className="theme-store__grid">
        {RETRO_THEME_DEFINITIONS.map((theme) => {
          const isUnlocked = profile.unlockedRetroThemeIds.includes(theme.id)
          const isTemporarilyFree = !isUnlocked && isRetroThemeTemporarilyFree(theme.id)
          const canBuy = !isUnlocked && !isTemporarilyFree && profile.points >= theme.cost
          const canUse = isUnlocked || isTemporarilyFree || theme.cost === 0
          const priceLabel = isTemporarilyFree
            ? 'Free now'
            : theme.cost === 0
              ? 'Free'
              : `${theme.cost} coins`

          return (
            <article
              key={theme.id}
              className={`theme-pack-card ${activeThemeId === theme.id ? 'is-active' : ''} theme-pack-card--${theme.id}`}
            >
              <div className="theme-pack-card__header">
                <span className="theme-pack-card__eyebrow">{theme.categoryLabel ?? 'Decade pack'}</span>
                <span className="theme-pack-card__price">{priceLabel}</span>
              </div>
              <strong>{theme.label}</strong>
              <p>{theme.description}</p>
              <span>{theme.previewLine}</span>
              {theme.freeUntilLabel ? (
                <em className="theme-pack-card__limited">{theme.freeUntilLabel}</em>
              ) : null}
              {canUse ? (
                <button
                  className="action-button action-button--ghost"
                  type="button"
                  onClick={() => onActivate(theme.id)}
                >
                  {activeThemeId === theme.id ? 'Active' : isTemporarilyFree ? 'Use free theme' : 'Use theme'}
                </button>
              ) : (
                <button
                  className="action-button"
                  disabled={!canBuy}
                  type="button"
                  onClick={() => onUnlock(theme.id)}
                >
                  {canBuy ? `Unlock for ${priceLabel}` : `${priceLabel} required`}
                </button>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
