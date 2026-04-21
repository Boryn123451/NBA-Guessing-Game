import type { GameVariant, PlayerRecord, PlayerThemeId } from './types'

export interface ThemeDefinition {
  id: PlayerThemeId
  label: string
  description: string
}

export interface ThemeOption extends ThemeDefinition {
  count: number
}

export const PLAYER_THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    id: 'classic',
    label: 'Full League',
    description: 'All eligible current NBA players in the refreshed roster pool.',
  },
  {
    id: 'rookies',
    label: 'Rookies',
    description: 'Only players in their first NBA season.',
  },
  {
    id: 'international',
    label: 'International',
    description: 'Current players whose listed country is outside the United States.',
  },
  {
    id: 'all-stars',
    label: 'All-Stars',
    description: 'Current players on the official current-season NBA All-Star roster.',
  },
  {
    id: 'under-25',
    label: 'Under 25',
    description: 'Current players younger than 25 in the refreshed data snapshot.',
  },
]

const THEME_BY_ID = new Map<PlayerThemeId, ThemeDefinition>(
  PLAYER_THEME_DEFINITIONS.map((theme) => [theme.id, theme]),
)

function matchesTheme(player: PlayerRecord, themeId: PlayerThemeId): boolean {
  switch (themeId) {
    case 'classic':
      return true
    case 'rookies':
      return player.flags.isRookie
    case 'international':
      return player.flags.isInternational
    case 'all-stars':
      return player.flags.isAllStar
    case 'under-25':
      return player.flags.isUnder25
  }
}

export function getThemeDefinition(themeId: PlayerThemeId): ThemeDefinition {
  return THEME_BY_ID.get(themeId) ?? PLAYER_THEME_DEFINITIONS[0]
}

export function getVariantPlayerPool(
  players: PlayerRecord[],
  variant: GameVariant,
): PlayerRecord[] {
  return players.filter((player) => matchesTheme(player, variant.themeId))
}

export function getThemeOptions(players: PlayerRecord[]): ThemeOption[] {
  return PLAYER_THEME_DEFINITIONS.map((theme) => ({
    ...theme,
    count: players.filter((player) => matchesTheme(player, theme.id)).length,
  }))
}

export function formatThemeSummary(themeId: PlayerThemeId): string {
  return getThemeDefinition(themeId).description
}
