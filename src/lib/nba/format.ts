import { getAgeBucketIndex, getPlayerAge } from './comparison'
import { getDifficultyDefinition } from './difficulty'
import { getThemeDefinition } from './themes'
import type {
  ClueKey,
  ClueMode,
  DifficultyId,
  GameMode,
  PlayerRecord,
  PlayerThemeId,
  UnitSystem,
} from './types'

export const CLUE_LABELS: Record<ClueKey, string> = {
  player: 'Player',
  team: 'Team',
  conference: 'Conf',
  division: 'Div',
  position: 'Pos',
  height: 'Height',
  age: 'Age',
  jerseyNumber: '#',
}

export function formatModeLabel(mode: GameMode): string {
  return mode === 'daily' ? 'Daily' : 'Practice'
}

export function formatClueModeLabel(clueMode: ClueMode): string {
  return clueMode === 'standard' ? 'Roster Clues' : 'Career Path'
}

export function formatDifficultyLabel(difficultyId: DifficultyId): string {
  return getDifficultyDefinition(difficultyId).label
}

export function formatThemeLabel(themeId: PlayerThemeId): string {
  return getThemeDefinition(themeId).label
}

export function formatHeight(player: PlayerRecord, units: UnitSystem): string {
  if (player.heightInInches === null || player.heightCm === null) {
    return 'N/A'
  }

  if (units === 'metric') {
    return `${player.heightCm} cm`
  }

  const feet = Math.floor(player.heightInInches / 12)
  const inches = player.heightInInches % 12

  return `${feet}'${inches}"`
}

function formatAgeBucketLabel(age: number | null): string {
  switch (getAgeBucketIndex(age)) {
    case 0:
      return 'Under 23'
    case 1:
      return '23-25'
    case 2:
      return '26-28'
    case 3:
      return '29-31'
    case 4:
      return '32+'
    default:
      return 'N/A'
  }
}

export function formatAge(
  player: PlayerRecord,
  referenceDate: string,
  difficultyId: DifficultyId,
): string {
  const age = getPlayerAge(player, referenceDate)
  const difficulty = getDifficultyDefinition(difficultyId)

  return difficulty.ageDisplay === 'bucketed' ? formatAgeBucketLabel(age) : age === null ? 'N/A' : `${age}`
}

export function formatJerseyNumber(jerseyNumber: number | null): string {
  return jerseyNumber === null ? 'N/A' : `${jerseyNumber}`
}

export function formatRefreshDate(isoDate: string): string {
  const date = new Date(isoDate)
  return Number.isNaN(date.getTime())
    ? isoDate
    : new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}
