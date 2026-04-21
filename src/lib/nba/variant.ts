import type { DifficultyId, GameMode, GameVariant } from './types'

export const DEFAULT_GAME_VARIANT: GameVariant = {
  clueMode: 'standard',
  themeId: 'classic',
  eventId: null,
}

export function normalizeVariant(variant: GameVariant): GameVariant {
  return {
    clueMode: variant.clueMode,
    themeId: variant.themeId,
    eventId: variant.eventId,
  }
}

export function getVariantKey(variant: GameVariant): string {
  const normalizedVariant = normalizeVariant(variant)

  return [
    normalizedVariant.clueMode,
    normalizedVariant.themeId,
    normalizedVariant.eventId ?? 'none',
  ].join(':')
}

export function getVariantSessionKey(variant: GameVariant, difficulty: DifficultyId): string {
  return `${getVariantKey(variant)}:${difficulty}`
}

export function getDailySessionKey(
  dateKey: string,
  variant: GameVariant,
  difficulty: DifficultyId,
): string {
  return `${dateKey}:${getVariantSessionKey(variant, difficulty)}`
}

export function describeModeScope(mode: GameMode): string {
  return mode === 'daily' ? 'Daily' : 'Practice'
}
