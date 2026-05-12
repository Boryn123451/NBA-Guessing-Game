import { describe, expect, it } from 'vitest'

import type { LocalProfile } from '../nba/types'
import {
  BRANDON_CLARKE_RETRO_THEME_ID,
  canUnlockRetroTheme,
  isRetroThemeAvailable,
  isRetroThemeTemporarilyFree,
} from './retroThemes'

function buildProfile(overrides: Partial<LocalProfile> = {}): LocalProfile {
  return {
    profileId: 'test-profile',
    displayName: 'Scout',
    createdAt: '2026-05-12T00:00:00Z',
    points: 0,
    unlockedRetroThemeIds: ['2020s'],
    ...overrides,
  }
}

describe('retro theme shop availability', () => {
  it('makes the Brandon Clarke tribute theme free until the ET memorial deadline only', () => {
    const beforeExpiry = new Date('2026-05-15T03:59:59Z')
    const afterExpiry = new Date('2026-05-15T04:00:00Z')

    expect(isRetroThemeTemporarilyFree(BRANDON_CLARKE_RETRO_THEME_ID, beforeExpiry)).toBe(true)
    expect(isRetroThemeAvailable(buildProfile(), BRANDON_CLARKE_RETRO_THEME_ID, beforeExpiry)).toBe(true)
    expect(isRetroThemeTemporarilyFree(BRANDON_CLARKE_RETRO_THEME_ID, afterExpiry)).toBe(false)
    expect(isRetroThemeAvailable(buildProfile(), BRANDON_CLARKE_RETRO_THEME_ID, afterExpiry)).toBe(false)
  })

  it('requires coins after the free tribute window expires', () => {
    const afterExpiry = new Date('2026-05-15T04:00:00Z')

    expect(canUnlockRetroTheme(buildProfile({ points: 149 }), BRANDON_CLARKE_RETRO_THEME_ID)).toBe(false)
    expect(canUnlockRetroTheme(buildProfile({ points: 150 }), BRANDON_CLARKE_RETRO_THEME_ID)).toBe(true)
    expect(isRetroThemeAvailable(
      buildProfile({ unlockedRetroThemeIds: ['2020s', BRANDON_CLARKE_RETRO_THEME_ID] }),
      BRANDON_CLARKE_RETRO_THEME_ID,
      afterExpiry,
    )).toBe(true)
  })
})
