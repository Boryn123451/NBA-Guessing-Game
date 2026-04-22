import { compareGuess } from './comparison'
import { getDifficultyDefinition } from './difficulty'
import type { DifficultyId, GameOutcome, GuessResult, PlayerRecord } from './types'

interface GetBlockedTeamIdOptions {
  difficultyId: DifficultyId
  status: GameOutcome
  lastGuessResult: GuessResult | null
  lastGuessedPlayer: PlayerRecord | null
}

interface ShouldBlockConsecutiveSameTeamGuessOptions {
  difficultyId: DifficultyId
  priorGuess: PlayerRecord | null
  nextGuess: PlayerRecord | null
  target: PlayerRecord | null
  referenceDate: string
}

export function getBlockedTeamIdForNextGuess({
  difficultyId,
  lastGuessResult,
  lastGuessedPlayer,
  status,
}: GetBlockedTeamIdOptions): number | null {
  const difficulty = getDifficultyDefinition(difficultyId)

  if (!difficulty.blockConsecutiveSameTeam || status !== 'in_progress' || !lastGuessedPlayer) {
    return null
  }

  return lastGuessResult?.clues.team.status === 'exact' ? null : lastGuessedPlayer.teamId
}

export function shouldBlockConsecutiveSameTeamGuess({
  difficultyId,
  nextGuess,
  priorGuess,
  referenceDate,
  target,
}: ShouldBlockConsecutiveSameTeamGuessOptions): boolean {
  const difficulty = getDifficultyDefinition(difficultyId)

  if (
    !difficulty.blockConsecutiveSameTeam ||
    !priorGuess ||
    !nextGuess ||
    !target ||
    priorGuess.teamId !== nextGuess.teamId
  ) {
    return false
  }

  return compareGuess(priorGuess, target, referenceDate, difficultyId).clues.team.status !== 'exact'
}
