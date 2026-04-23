import { getPlayerEntryDraftYear } from './decades'
import { getDifficultyDefinition } from './difficulty'
import type {
  DifficultyId,
  GuessFeedback,
  NumericDirection,
  PlayerRecord,
} from './types'

export type DraftClueKey =
  | 'player'
  | 'draftTeam'
  | 'draftYear'
  | 'draftRound'
  | 'draftPickBucket'
  | 'lottery'
  | 'undrafted'

export interface DraftGuessResult {
  guess: PlayerRecord
  isCorrect: boolean
  clues: Record<DraftClueKey, GuessFeedback>
}

export const DRAFT_CLUE_KEYS: DraftClueKey[] = [
  'player',
  'draftTeam',
  'draftYear',
  'draftRound',
  'draftPickBucket',
  'lottery',
  'undrafted',
]

export const DRAFT_CLUE_LABELS: Record<DraftClueKey, string> = {
  player: 'Player',
  draftTeam: 'Draft Team',
  draftYear: 'Year',
  draftRound: 'Round',
  draftPickBucket: 'Pick',
  lottery: 'Lottery',
  undrafted: 'Undrafted',
}

function exactOrMiss(isExact: boolean): GuessFeedback {
  return {
    status: isExact ? 'exact' : 'miss',
    direction: null,
  }
}

function compareNumeric(
  guessValue: number | null,
  targetValue: number | null,
  closeTolerance: number,
  showDirection: boolean,
): GuessFeedback {
  if (guessValue === null || targetValue === null) {
    return {
      status: 'unknown',
      direction: null,
    }
  }

  if (guessValue === targetValue) {
    return {
      status: 'exact',
      direction: null,
    }
  }

  const direction: NumericDirection =
    showDirection ? (targetValue > guessValue ? 'up' : 'down') : null

  return {
    status: Math.abs(guessValue - targetValue) <= closeTolerance ? 'close' : 'miss',
    direction,
  }
}

export function getDraftPickBucketLabel(player: PlayerRecord): string {
  if (player.draft.isUndrafted || player.draft.pick === null) {
    return 'Undrafted'
  }

  if (player.draft.pick === 1) {
    return '1'
  }

  if (player.draft.pick <= 5) {
    return '2-5'
  }

  if (player.draft.pick <= 14) {
    return '6-14'
  }

  if (player.draft.pick <= 30) {
    return '15-30'
  }

  if (player.draft.pick <= 45) {
    return '31-45'
  }

  return '46+'
}

function getDraftPickBucketIndex(player: PlayerRecord): number | null {
  if (player.draft.isUndrafted || player.draft.pick === null) {
    return null
  }

  if (player.draft.pick === 1) {
    return 0
  }

  if (player.draft.pick <= 5) {
    return 1
  }

  if (player.draft.pick <= 14) {
    return 2
  }

  if (player.draft.pick <= 30) {
    return 3
  }

  if (player.draft.pick <= 45) {
    return 4
  }

  return 5
}

export function compareDraftGuess(
  guess: PlayerRecord,
  target: PlayerRecord,
  difficultyId: DifficultyId,
): DraftGuessResult {
  const difficulty = getDifficultyDefinition(difficultyId)

  return {
    guess,
    isCorrect: guess.id === target.id,
    clues: {
      player: exactOrMiss(guess.id === target.id),
      draftTeam: exactOrMiss(guess.draft.teamId === target.draft.teamId),
      draftYear: compareNumeric(
        getPlayerEntryDraftYear(guess),
        getPlayerEntryDraftYear(target),
        difficulty.numericCloseTolerance,
        difficulty.showNumericArrows,
      ),
      draftRound: exactOrMiss(guess.draft.round === target.draft.round),
      draftPickBucket: compareNumeric(
        getDraftPickBucketIndex(guess),
        getDraftPickBucketIndex(target),
        0,
        false,
      ),
      lottery: exactOrMiss(
        Boolean(guess.draft.pick !== null && guess.draft.pick <= 14) ===
          Boolean(target.draft.pick !== null && target.draft.pick <= 14),
      ),
      undrafted: exactOrMiss(guess.draft.isUndrafted === target.draft.isUndrafted),
    },
  }
}
