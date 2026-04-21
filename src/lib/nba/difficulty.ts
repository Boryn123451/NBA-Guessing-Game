import type { DifficultyId } from './types'

export type SearchMatchMode = 'assistive' | 'standard' | 'strict' | 'near-exact'
export type SilhouetteHintMode = 'free' | 'available' | 'none'

export interface DifficultyConfig {
  id: DifficultyId
  label: string
  description: string
  maxGuesses: number
  numericCloseTolerance: number
  ageCloseTolerance: number
  ageDisplay: 'exact' | 'bucketed'
  jerseyCloseTolerance: number
  showNumericArrows: boolean
  allowPositionOverlap: boolean
  blockConsecutiveSameTeam: boolean
  profileWarningAfterMisses: number | null
  search: {
    matchMode: SearchMatchMode
    typoTolerance: boolean
    includeGuessedPlayers: boolean
    resultLimit: number
  }
  image: {
    revealEveryMisses: number | null
    curvePower: number
    baseReveal: number
    maxBlurPx: number
    silhouetteHint: SilhouetteHintMode
  }
  bonusClues: {
    maxClues: number
    automaticRevealMisses: number[]
    manualRevealAfterMisses: number | null
  }
  ui: {
    showSearchHint: boolean
    showEmptyStateGuidance: boolean
    showCloseGuessFeedback: boolean
    showRoundGuidance: boolean
  }
  clueAvailability: {
    careerPathMode: boolean
    seasonSnapshot: boolean
    bonusClues: boolean
  }
}

export const DIFFICULTY_DEFINITIONS: DifficultyConfig[] = [
  {
    id: 'easy',
    label: 'Easy',
    description: 'More guesses, more help, more reveals.',
    maxGuesses: 10,
    numericCloseTolerance: 2,
    ageCloseTolerance: 2,
    ageDisplay: 'exact',
    jerseyCloseTolerance: 2,
    showNumericArrows: true,
    allowPositionOverlap: true,
    blockConsecutiveSameTeam: false,
    profileWarningAfterMisses: null,
    search: {
      matchMode: 'assistive',
      typoTolerance: true,
      includeGuessedPlayers: true,
      resultLimit: 10,
    },
    image: {
      revealEveryMisses: 1,
      curvePower: 1.1,
      baseReveal: 0.09,
      maxBlurPx: 20,
      silhouetteHint: 'free',
    },
    bonusClues: {
      maxClues: 2,
      automaticRevealMisses: [3, 6],
      manualRevealAfterMisses: null,
    },
    ui: {
      showSearchHint: true,
      showEmptyStateGuidance: true,
      showCloseGuessFeedback: true,
      showRoundGuidance: true,
    },
    clueAvailability: {
      careerPathMode: true,
      seasonSnapshot: true,
      bonusClues: true,
    },
  },
  {
    id: 'medium',
    label: 'Medium',
    description: 'Balanced default challenge.',
    maxGuesses: 8,
    numericCloseTolerance: 2,
    ageCloseTolerance: 2,
    ageDisplay: 'exact',
    jerseyCloseTolerance: 2,
    showNumericArrows: true,
    allowPositionOverlap: true,
    blockConsecutiveSameTeam: false,
    profileWarningAfterMisses: null,
    search: {
      matchMode: 'standard',
      typoTolerance: true,
      includeGuessedPlayers: false,
      resultLimit: 8,
    },
    image: {
      revealEveryMisses: 1,
      curvePower: 1.8,
      baseReveal: 0.04,
      maxBlurPx: 26,
      silhouetteHint: 'available',
    },
    bonusClues: {
      maxClues: 1,
      automaticRevealMisses: [],
      manualRevealAfterMisses: 5,
    },
    ui: {
      showSearchHint: true,
      showEmptyStateGuidance: false,
      showCloseGuessFeedback: false,
      showRoundGuidance: true,
    },
    clueAvailability: {
      careerPathMode: true,
      seasonSnapshot: true,
      bonusClues: true,
    },
  },
  {
    id: 'hard',
    label: 'Hard',
    description: 'Fewer guesses, fewer assists.',
    maxGuesses: 6,
    numericCloseTolerance: 1,
    ageCloseTolerance: 1,
    ageDisplay: 'exact',
    jerseyCloseTolerance: 1,
    showNumericArrows: true,
    allowPositionOverlap: true,
    blockConsecutiveSameTeam: false,
    profileWarningAfterMisses: null,
    search: {
      matchMode: 'strict',
      typoTolerance: false,
      includeGuessedPlayers: false,
      resultLimit: 8,
    },
    image: {
      revealEveryMisses: 2,
      curvePower: 2.4,
      baseReveal: 0.02,
      maxBlurPx: 32,
      silhouetteHint: 'none',
    },
    bonusClues: {
      maxClues: 1,
      automaticRevealMisses: [],
      manualRevealAfterMisses: 5,
    },
    ui: {
      showSearchHint: false,
      showEmptyStateGuidance: false,
      showCloseGuessFeedback: false,
      showRoundGuidance: false,
    },
    clueAvailability: {
      careerPathMode: true,
      seasonSnapshot: true,
      bonusClues: true,
    },
  },
  {
    id: 'impossible',
    label: 'Impossible',
    description: 'Minimal help. Maximum pressure.',
    maxGuesses: 5,
    numericCloseTolerance: 1,
    ageCloseTolerance: 1,
    ageDisplay: 'exact',
    jerseyCloseTolerance: 1,
    showNumericArrows: false,
    allowPositionOverlap: true,
    blockConsecutiveSameTeam: false,
    profileWarningAfterMisses: null,
    search: {
      matchMode: 'near-exact',
      typoTolerance: false,
      includeGuessedPlayers: false,
      resultLimit: 6,
    },
    image: {
      revealEveryMisses: null,
      curvePower: 4,
      baseReveal: 0,
      maxBlurPx: 38,
      silhouetteHint: 'none',
    },
    bonusClues: {
      maxClues: 0,
      automaticRevealMisses: [],
      manualRevealAfterMisses: null,
    },
    ui: {
      showSearchHint: false,
      showEmptyStateGuidance: false,
      showCloseGuessFeedback: false,
      showRoundGuidance: false,
    },
    clueAvailability: {
      careerPathMode: true,
      seasonSnapshot: true,
      bonusClues: false,
    },
  },
  {
    id: 'elite-ball-knowledge',
    label: 'Elite Ball Knowledge',
    description: 'Only for true NBA sickos.',
    maxGuesses: 3,
    numericCloseTolerance: 1,
    ageCloseTolerance: 0,
    ageDisplay: 'bucketed',
    jerseyCloseTolerance: 0,
    showNumericArrows: false,
    allowPositionOverlap: false,
    blockConsecutiveSameTeam: true,
    profileWarningAfterMisses: 2,
    search: {
      matchMode: 'near-exact',
      typoTolerance: false,
      includeGuessedPlayers: false,
      resultLimit: 5,
    },
    image: {
      revealEveryMisses: null,
      curvePower: 4,
      baseReveal: 0,
      maxBlurPx: 40,
      silhouetteHint: 'none',
    },
    bonusClues: {
      maxClues: 0,
      automaticRevealMisses: [],
      manualRevealAfterMisses: null,
    },
    ui: {
      showSearchHint: false,
      showEmptyStateGuidance: false,
      showCloseGuessFeedback: false,
      showRoundGuidance: false,
    },
    clueAvailability: {
      careerPathMode: false,
      seasonSnapshot: false,
      bonusClues: false,
    },
  },
]

const DIFFICULTY_BY_ID = new Map<DifficultyId, DifficultyConfig>(
  DIFFICULTY_DEFINITIONS.map((difficulty) => [difficulty.id, difficulty]),
)

export const DEFAULT_DIFFICULTY_ID: DifficultyId = 'medium'

export function getDifficultyDefinition(difficultyId: DifficultyId): DifficultyConfig {
  return DIFFICULTY_BY_ID.get(difficultyId) ?? DIFFICULTY_DEFINITIONS[1]
}

export function sanitizeDifficultyId(value: unknown): DifficultyId {
  switch (value) {
    case 'easy':
    case 'medium':
    case 'hard':
    case 'impossible':
    case 'elite-ball-knowledge':
      return value
    default:
      return DEFAULT_DIFFICULTY_ID
  }
}
