import { normalizePlayerAge } from './age'
import { getDifficultyDefinition } from './difficulty'

import { canonicalizePosition } from './normalize'
import type {
  ClueKey,
  DifficultyId,
  GuessFeedback,
  GuessResult,
  NumericDirection,
  PlayerRecord,
} from './types'

export const CLUE_KEYS: ClueKey[] = [
  'player',
  'team',
  'conference',
  'division',
  'position',
  'height',
  'age',
  'jerseyNumber',
]

export function getPlayerAge(player: PlayerRecord, referenceDate: string): number | null {
  return normalizePlayerAge(player.birthDate, player.currentAge, referenceDate)
}

export function getAgeBucketIndex(age: number | null): number | null {
  if (age === null) {
    return null
  }

  if (age < 23) {
    return 0
  }

  if (age <= 25) {
    return 1
  }

  if (age <= 28) {
    return 2
  }

  if (age <= 31) {
    return 3
  }

  return 4
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

  const difference = Math.abs(guessValue - targetValue)
  const direction: NumericDirection =
    showDirection ? (targetValue > guessValue ? 'up' : 'down') : null

  return {
    status: difference <= closeTolerance ? 'close' : 'miss',
    direction,
  }
}

function comparePosition(
  guess: PlayerRecord,
  target: PlayerRecord,
  allowOverlap: boolean,
): GuessFeedback {
  const guessPosition = canonicalizePosition(guess.position)
  const targetPosition = canonicalizePosition(target.position)

  if (guessPosition === 'N/A' || targetPosition === 'N/A') {
    return {
      status: 'unknown',
      direction: null,
    }
  }

  if (guessPosition === targetPosition) {
    return {
      status: 'exact',
      direction: null,
    }
  }

  const hasOverlap =
    allowOverlap && guess.positionTokens.some((token) => target.positionTokens.includes(token))

  return {
    status: hasOverlap ? 'close' : 'miss',
    direction: null,
  }
}

export function compareGuess(
  guess: PlayerRecord,
  target: PlayerRecord,
  referenceDate: string,
  difficultyId: DifficultyId,
): GuessResult {
  const difficulty = getDifficultyDefinition(difficultyId)

  const clues: Record<ClueKey, GuessFeedback> = {
    player: exactOrMiss(guess.id === target.id),
    team: exactOrMiss(guess.teamId === target.teamId),
    conference: exactOrMiss(guess.conference === target.conference),
    division: exactOrMiss(guess.division === target.division),
    position: comparePosition(guess, target, difficulty.allowPositionOverlap),
    height: compareNumeric(
      guess.heightInInches,
      target.heightInInches,
      difficulty.numericCloseTolerance,
      difficulty.showNumericArrows,
    ),
    age:
      difficulty.ageDisplay === 'bucketed'
        ? compareNumeric(
            getAgeBucketIndex(getPlayerAge(guess, referenceDate)),
            getAgeBucketIndex(getPlayerAge(target, referenceDate)),
            difficulty.ageCloseTolerance,
            false,
          )
        : compareNumeric(
            getPlayerAge(guess, referenceDate),
            getPlayerAge(target, referenceDate),
            difficulty.ageCloseTolerance,
            difficulty.showNumericArrows,
          ),
    jerseyNumber: compareNumeric(
      guess.jerseyNumber,
      target.jerseyNumber,
      difficulty.jerseyCloseTolerance,
      difficulty.showNumericArrows,
    ),
  }

  return {
    guess,
    isCorrect: guess.id === target.id,
    clues,
  }
}
