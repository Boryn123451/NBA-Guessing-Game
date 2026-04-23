import { filterPlayersByEntryDecade } from './decades'
import { filterPlayersForEvent } from './events'
import { filterHistoricPlayersForDifficulty } from './historicFilters'
import type {
  DifficultyId,
  GameVariant,
  PlayerRecord,
  PlayerThemeId,
} from './types'

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

function filterPlayersForClueMode(
  players: PlayerRecord[],
  variant: GameVariant,
): PlayerRecord[] {
  switch (variant.clueMode) {
    case 'career':
      return players.filter(
        (player) =>
          Boolean(player.country) &&
          Boolean(player.career.preNbaPath) &&
          player.career.debutYear !== null,
      )
    case 'draft':
      return players.filter((player) => player.draft.isUndrafted || player.draft.year !== null)
    default:
      return players
  }
}

function isCurrentEliteEligible(player: PlayerRecord): boolean {
  return (
    player.snapshot.pointsPerGame !== null &&
    player.snapshot.minutesPerGame !== null &&
    player.snapshot.pointsPerGame < 10 &&
    player.snapshot.minutesPerGame <= 15
  )
}

function filterPlayersForDifficulty(
  players: PlayerRecord[],
  difficultyId: DifficultyId,
  variant: GameVariant,
): PlayerRecord[] {
  if (variant.playerPoolScope === 'history') {
    return filterHistoricPlayersForDifficulty(players, difficultyId)
  }

  if (difficultyId === 'elite-ball-knowledge') {
    return players.filter(isCurrentEliteEligible)
  }

  return players
}

export function getPlayablePlayerPool(
  players: PlayerRecord[],
  variant: GameVariant,
  difficultyId: DifficultyId,
): PlayerRecord[] {
  const themedPlayers = players.filter((player) => matchesTheme(player, variant.themeId))
  const eventFilteredPlayers = filterPlayersForEvent(themedPlayers, variant.eventId)
  const clueModeFilteredPlayers = filterPlayersForClueMode(eventFilteredPlayers, variant)
  const decadeFilteredPlayers = filterPlayersByEntryDecade(
    clueModeFilteredPlayers,
    variant.entryDecadeId ?? null,
  )
  const difficultyFilteredPlayers = filterPlayersForDifficulty(
    decadeFilteredPlayers,
    difficultyId,
    variant,
  )

  if (difficultyFilteredPlayers.length > 0) {
    return difficultyFilteredPlayers
  }

  if (variant.entryDecadeId !== null) {
    return decadeFilteredPlayers
  }

  if (decadeFilteredPlayers.length > 0) {
    return decadeFilteredPlayers
  }

  if (clueModeFilteredPlayers.length > 0) {
    return clueModeFilteredPlayers
  }

  if (eventFilteredPlayers.length > 0) {
    return eventFilteredPlayers
  }

  return players
}
