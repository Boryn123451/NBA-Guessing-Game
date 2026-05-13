import type { DifficultyId, GameMode, GameVariant } from './types'

export const DEFAULT_GAME_VARIANT: GameVariant = {
  playerPoolScope: 'current',
  clueMode: 'standard',
  themeId: 'classic',
  eventId: null,
  includePostseason: false,
  includeTenDayContracts: false,
  entryDecadeId: null,
}

export function normalizeVariant(variant: GameVariant): GameVariant {
  return {
    playerPoolScope: variant.playerPoolScope,
    clueMode: variant.clueMode,
    themeId: variant.themeId,
    eventId: variant.eventId,
    includePostseason: variant.includePostseason,
    includeTenDayContracts: variant.includeTenDayContracts,
    entryDecadeId: variant.entryDecadeId ?? null,
  }
}

export function getVariantKey(variant: GameVariant): string {
  const normalizedVariant = normalizeVariant(variant)

  const keyParts = [
    normalizedVariant.playerPoolScope,
    normalizedVariant.clueMode,
    normalizedVariant.themeId,
    normalizedVariant.eventId ?? 'none',
    normalizedVariant.includePostseason ? 'post' : 'reg',
    normalizedVariant.includeTenDayContracts ? 'ten-day' : 'no-ten-day',
  ]

  if (normalizedVariant.entryDecadeId) {
    keyParts.push(normalizedVariant.entryDecadeId)
  }

  return keyParts.join(':')
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
