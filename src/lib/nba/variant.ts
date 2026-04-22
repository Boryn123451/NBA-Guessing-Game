import type { DifficultyId, GameMode, GameVariant } from './types'

export const DEFAULT_GAME_VARIANT: GameVariant = {
  playerPoolScope: 'current',
  clueMode: 'standard',
  themeId: 'classic',
  eventId: null,
  includePostseason: false,
}

export function normalizeVariant(variant: GameVariant): GameVariant {
  return {
    playerPoolScope: variant.playerPoolScope,
    clueMode: variant.clueMode,
    themeId: variant.themeId,
    eventId: variant.eventId,
    includePostseason: variant.includePostseason,
  }
}

export function getVariantKey(variant: GameVariant): string {
  const normalizedVariant = normalizeVariant(variant)

  return [
    normalizedVariant.playerPoolScope,
    normalizedVariant.clueMode,
    normalizedVariant.themeId,
    normalizedVariant.eventId ?? 'none',
    normalizedVariant.includePostseason ? 'post' : 'reg',
  ].join(':')
}

export function getVariantSessionKey(variant: GameVariant, difficulty: DifficultyId): string {
  return `${getVariantKey(variant)}:${difficulty}`
}

export function getDailySessionKey(
  dateKey: string,
  _variant?: GameVariant,
  _difficulty?: DifficultyId,
): string {
  void _variant
  void _difficulty
  return `${dateKey}:daily`
}

export function describeModeScope(mode: GameMode): string {
  return mode === 'daily' ? 'Daily' : 'Practice'
}
