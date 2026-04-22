import { filterPlayersForEvent } from './events'
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

function isHistoryEasyEligible(player: PlayerRecord): boolean {
  if (player.isCurrentPlayer) {
    return true
  }

  const seasons = player.career.seasonsPlayed ?? 0
  const pointsPerGame = player.snapshot.pointsPerGame ?? 0

  return (
    player.career.hasRichMetadata &&
    (seasons >= 5 ||
      pointsPerGame >= 10 ||
      player.career.allStarAppearances > 0 ||
      player.career.championships > 0 ||
      (player.draft.pick !== null && player.draft.pick <= 15))
  )
}

function isHistoryMediumEligible(player: PlayerRecord): boolean {
  if (player.isCurrentPlayer) {
    return true
  }

  const seasons = player.career.seasonsPlayed ?? 0
  const pointsPerGame = player.snapshot.pointsPerGame ?? 0

  return (
    player.career.hasRichMetadata &&
    ((seasons >= 4 && pointsPerGame >= 6) ||
      pointsPerGame >= 9 ||
      player.career.allStarAppearances > 0 ||
      player.career.championships > 0 ||
      (player.draft.pick !== null && player.draft.pick <= 20))
  )
}

function isHistoryHardEligible(player: PlayerRecord): boolean {
  if (player.isCurrentPlayer) {
    return true
  }

  const seasons = player.career.seasonsPlayed ?? 0
  const pointsPerGame = player.snapshot.pointsPerGame ?? 0

  return (
    player.career.hasRichMetadata &&
    ((seasons >= 3 && pointsPerGame >= 5) ||
      player.career.allStarAppearances > 0 ||
      player.career.championships > 0 ||
      player.draft.pick !== null)
  )
}

function isHistoryImpossibleEligible(player: PlayerRecord): boolean {
  if (player.isCurrentPlayer) {
    return true
  }

  const seasons = player.career.seasonsPlayed ?? 0
  const pointsPerGame = player.snapshot.pointsPerGame ?? 0

  return (
    player.career.hasRichMetadata &&
    (seasons >= 2 ||
      pointsPerGame >= 4 ||
      player.draft.pick !== null)
  )
}

function isHistoryEliteEligible(player: PlayerRecord): boolean {
  if (player.isCurrentPlayer) {
    return (
      isCurrentEliteEligible(player) &&
      player.career.hasRichMetadata &&
      (player.career.seasonsPlayed ?? 0) >= 3
    )
  }

  const seasons = player.career.seasonsPlayed ?? 0
  const pointsPerGame = player.snapshot.pointsPerGame ?? 0
  const hasDraftSignal = player.draft.pick !== null && player.draft.pick <= 20
  const hasScoringSignal = pointsPerGame >= 11

  return (
    player.career.hasRichMetadata &&
    seasons >= 5 &&
    seasons <= 10 &&
    pointsPerGame >= 8 &&
    pointsPerGame <= 15 &&
    (hasDraftSignal || hasScoringSignal)
  )
}

function filterPlayersForDifficulty(
  players: PlayerRecord[],
  difficultyId: DifficultyId,
  variant: GameVariant,
): PlayerRecord[] {
  if (variant.playerPoolScope === 'history') {
    switch (difficultyId) {
      case 'easy':
        return players.filter(isHistoryEasyEligible)
      case 'medium':
        return players.filter(isHistoryMediumEligible)
      case 'hard':
        return players.filter(isHistoryHardEligible)
      case 'impossible':
        return players.filter(isHistoryImpossibleEligible)
      case 'elite-ball-knowledge':
        return players.filter(isHistoryEliteEligible)
      default:
        return players
    }
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
  const difficultyFilteredPlayers = filterPlayersForDifficulty(
    clueModeFilteredPlayers,
    difficultyId,
    variant,
  )

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
