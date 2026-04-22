import type { LocalProfile, RetroThemeId } from '../nba/types'

export interface RetroThemeDefinition {
  id: RetroThemeId
  label: string
  description: string
  cost: number
  previewLine: string
}

export const RETRO_THEME_DEFINITIONS: RetroThemeDefinition[] = [
  {
    id: '1950s',
    label: '1950s',
    description: 'Sepia stat-sheet tones and early pro-basketball paper-stock contrast.',
    cost: 45,
    previewLine: 'Cream stock, dark ink, box-score restraint.',
  },
  {
    id: '1960s',
    label: '1960s',
    description: 'Arena-program greens and scoreboard cream with sharper contrast than pure nostalgia sludge.',
    cost: 60,
    previewLine: 'Scoreboard green, enamel trim, readable vintage warmth.',
  },
  {
    id: '1970s',
    label: '1970s',
    description: 'Warm ABA-era oranges, caramel trim, and broad broadcast stripes.',
    cost: 75,
    previewLine: 'Burnt orange, walnut brown, loud but still clean.',
  },
  {
    id: '1980s',
    label: '1980s',
    description: 'Big-network brightness, electric accents, and prime-time TV energy.',
    cost: 90,
    previewLine: 'Neon sideline pop, bold navy anchors, zero muddy blur.',
  },
  {
    id: '1990s',
    label: '1990s',
    description: 'Heavy broadcast graphics, chrome trim, and cable-era playoff drama.',
    cost: 105,
    previewLine: 'Deep navy, teal highlights, polished studio framing.',
  },
  {
    id: '2000s',
    label: '2000s',
    description: 'Studio-show metallics, ticker-bar blues, and glossy cable packaging.',
    cost: 120,
    previewLine: 'Steel blue, silver trim, sports-center sheen.',
  },
  {
    id: '2010s',
    label: '2010s',
    description: 'Flat broadcast graphics, hardwood warmth, and cleaner mobile-era contrast.',
    cost: 135,
    previewLine: 'Graphite panels, bright hardwood accents, modern TV polish.',
  },
  {
    id: '2020s',
    label: '2020s',
    description: 'Current broadcast presentation with the cleanest default readability.',
    cost: 0,
    previewLine: 'Modern glass, warm hardwood, readable contrast.',
  },
]

const RETRO_THEME_BY_ID = new Map(
  RETRO_THEME_DEFINITIONS.map((theme) => [theme.id, theme]),
)

export function getRetroThemeDefinition(themeId: RetroThemeId): RetroThemeDefinition {
  return RETRO_THEME_BY_ID.get(themeId) ?? RETRO_THEME_DEFINITIONS.at(-1) ?? RETRO_THEME_DEFINITIONS[0]
}

export function canUnlockRetroTheme(profile: LocalProfile, themeId: RetroThemeId): boolean {
  const theme = getRetroThemeDefinition(themeId)

  return !profile.unlockedRetroThemeIds.includes(themeId) && profile.points >= theme.cost
}
