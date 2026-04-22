import { filterPlayersForEvent } from './events'
import type { DifficultyId, GameVariant, PlayerRecord, PlayerThemeId } from './types'

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

function filterPlayersForClueMode(players: PlayerRecord[], variant: GameVariant): PlayerRecord[] {
  switch (variant.clueMode) {
    case 'career':
      return players.filter(
        (player) =>
          Boolean(player.country) &&
          Boolean(player.career.preNbaPath) &&
          player.career.debutYear !== null,
      )
    case 'draft':
      return players.filter(
        (player) =>
          player.draft.year !== null &&
          (player.draft.teamId !== null || player.draft.isUndrafted),
      )
    default:
      return players
  }
}

function filterPlayersForDifficulty(
  players: PlayerRecord[],
  difficultyId: DifficultyId,
): PlayerRecord[] {
  if (difficultyId !== 'elite-ball-knowledge') {
    return players
  }

  return players.filter(
    (player) =>
      player.snapshot.pointsPerGame !== null &&
      player.snapshot.minutesPerGame !== null &&
      player.snapshot.pointsPerGame < 10 &&
      player.snapshot.minutesPerGame <= 15,
  )
}

export function getPlayablePlayerPool(
  players: PlayerRecord[],
  variant: GameVariant,
  difficultyId: DifficultyId,
): PlayerRecord[] {
  const themedPlayers = players.filter((player) => matchesTheme(player, variant.themeId))
  const eventFilteredPlayers = filterPlayersForEvent(themedPlayers, variant.eventId)
  const clueModeFilteredPlayers = filterPlayersForClueMode(eventFilteredPlayers, variant)
  const difficultyFilteredPlayers = filterPlayersForDifficulty(clueModeFilteredPlayers, difficultyId)

  if (difficultyFilteredPlayers.length > 0) {
    return difficultyFilteredPlayers
  }

  if (clueModeFilteredPlayers.length > 0) {
    return clueModeFilteredPlayers
  }

  if (eventFilteredPlayers.length > 0) {
    return eventFilteredPlayers
  }

  return players
}
