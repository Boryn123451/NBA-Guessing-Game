import { getDifficultyDefinition } from './difficulty'
import type { BonusClueId, DifficultyId, PlayerRecord } from './types'

export interface BonusClue {
  id: BonusClueId
  label: string
  value: string
}

const BONUS_CLUE_ORDER: BonusClueId[] = ['country', 'draftTeam', 'debutWindow']

function formatDraftTeam(player: PlayerRecord): string {
  if (player.draft.isUndrafted) {
    return 'Undrafted'
  }

  return player.draft.teamName ?? 'Draft team unavailable'
}

function formatDebutWindow(player: PlayerRecord): string {
  if (player.career.debutYear === null) {
    return 'Debut window unavailable'
  }

  const windowStart = player.career.debutYear - (player.career.debutYear % 3)
  const windowEnd = windowStart + 2

  return `${windowStart}-${windowEnd}`
}

export function getBonusClues(player: PlayerRecord): BonusClue[] {
  return [
    {
      id: 'country',
      label: 'Country',
      value: player.country ?? 'Country unavailable',
    },
    {
      id: 'draftTeam',
      label: 'Draft team',
      value: formatDraftTeam(player),
    },
    {
      id: 'debutWindow',
      label: 'Debut window',
      value: formatDebutWindow(player),
    },
  ]
}

export function getAutoRevealedBonusCount(
  difficultyId: DifficultyId,
  wrongGuessCount: number,
): number {
  const config = getDifficultyDefinition(difficultyId)

  return Math.min(
    config.bonusClues.automaticRevealMisses.filter((threshold) => wrongGuessCount >= threshold)
      .length,
    config.bonusClues.maxClues,
  )
}

export function getRevealedBonusClues(
  player: PlayerRecord,
  difficultyId: DifficultyId,
  wrongGuessCount: number,
  manualRevealIds: BonusClueId[],
): BonusClue[] {
  const config = getDifficultyDefinition(difficultyId)

  if (!config.clueAvailability.bonusClues || config.bonusClues.maxClues === 0) {
    return []
  }

  const allClues = getBonusClues(player)
  const autoCount = getAutoRevealedBonusCount(difficultyId, wrongGuessCount)
  const autoIds = BONUS_CLUE_ORDER.slice(0, autoCount)
  const orderedIds = [...autoIds]

  for (const clueId of manualRevealIds) {
    if (!orderedIds.includes(clueId)) {
      orderedIds.push(clueId)
    }
  }

  return orderedIds
    .slice(0, config.bonusClues.maxClues)
    .map((clueId) => allClues.find((clue) => clue.id === clueId))
    .filter((clue): clue is BonusClue => Boolean(clue))
}

export function canRevealManualBonusClue(
  player: PlayerRecord,
  difficultyId: DifficultyId,
  wrongGuessCount: number,
  manualRevealIds: BonusClueId[],
): boolean {
  const config = getDifficultyDefinition(difficultyId)

  if (
    !config.clueAvailability.bonusClues ||
    config.bonusClues.maxClues === 0 ||
    config.bonusClues.manualRevealAfterMisses === null ||
    wrongGuessCount < config.bonusClues.manualRevealAfterMisses
  ) {
    return false
  }

  return getRevealedBonusClues(player, difficultyId, wrongGuessCount, manualRevealIds).length <
    Math.min(config.bonusClues.maxClues, getBonusClues(player).length)
}

export function getNextManualBonusClueId(
  player: PlayerRecord,
  difficultyId: DifficultyId,
  wrongGuessCount: number,
  manualRevealIds: BonusClueId[],
): BonusClueId | null {
  if (!canRevealManualBonusClue(player, difficultyId, wrongGuessCount, manualRevealIds)) {
    return null
  }

  const revealedIds = new Set(
    getRevealedBonusClues(player, difficultyId, wrongGuessCount, manualRevealIds).map(
      (clue) => clue.id,
    ),
  )

  return BONUS_CLUE_ORDER.find((clueId) => !revealedIds.has(clueId)) ?? null
}

