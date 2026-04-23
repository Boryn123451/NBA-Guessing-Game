import { getPlayerEntryDecadeId, getPlayerEntryDraftYear } from './decades'
import type { DifficultyId, PlayerRecord } from './types'

const EASY_HISTORIC_MAX_PER_DECADE = 45

function getAccoladeCount(accolades: string[] | undefined, label: string): number {
  if (!accolades) {
    return 0
  }

  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  for (const accolade of accolades) {
    if (accolade === label) {
      return 1
    }

    const countMatch = accolade.match(new RegExp(`^${escapedLabel} x(\\d+)$`, 'i'))

    if (countMatch) {
      return Number(countMatch[1])
    }
  }

  return 0
}

function hasAccolade(accolades: string[] | undefined, label: string): boolean {
  return getAccoladeCount(accolades, label) > 0
}

function getCareerCounts(player: PlayerRecord) {
  const accolades = player.career.accolades

  return {
    allStarAppearances: player.career.allStarAppearances ?? 0,
    allNbaSelections: player.career.allNbaSelections ?? getAccoladeCount(accolades, 'All-NBA'),
    allDefensiveSelections:
      player.career.allDefensiveSelections ?? getAccoladeCount(accolades, 'All-Defensive Team'),
    championships: player.career.championships ?? 0,
    finalsMvpAwards: player.career.finalsMvpAwards ?? getAccoladeCount(accolades, 'NBA Finals MVP'),
    mvpAwards: player.career.mvpAwards ?? getAccoladeCount(accolades, 'NBA MVP'),
    rookieOfTheYearAwards:
      player.career.rookieOfTheYearAwards ?? getAccoladeCount(accolades, 'NBA Rookie of the Year'),
    defensivePlayerOfTheYearAwards:
      player.career.defensivePlayerOfTheYearAwards ??
      getAccoladeCount(accolades, 'NBA Defensive Player of the Year'),
    scoringTitles: player.career.scoringTitles ?? getAccoladeCount(accolades, 'Scoring Champion'),
    reboundTitles:
      player.career.reboundTitles ?? getAccoladeCount(accolades, 'Rebounding Champion'),
    assistTitles: player.career.assistTitles ?? getAccoladeCount(accolades, 'Assist Leader'),
    isHallOfFame: player.career.isHallOfFame ?? hasAccolade(accolades, 'Hall of Fame'),
    isGreatest75: player.career.isGreatest75 ?? hasAccolade(accolades, 'NBA 75 Team'),
  }
}

function getEntryYear(player: PlayerRecord): number | null {
  return getPlayerEntryDraftYear(player)
}

function getDecadeKey(player: PlayerRecord): string | null {
  return getPlayerEntryDecadeId(player)
}

function hasAccoladeSignal(player: PlayerRecord): boolean {
  const careerCounts = getCareerCounts(player)

  return (
    (player.career.accolades?.length ?? 0) > 0 ||
    careerCounts.allStarAppearances > 0 ||
    careerCounts.allNbaSelections > 0 ||
    careerCounts.championships > 0 ||
    careerCounts.isHallOfFame ||
    careerCounts.isGreatest75
  )
}

function getCareerScoringSignal(player: PlayerRecord): number {
  const pointsPerGame = player.snapshot.pointsPerGame ?? 0

  if (pointsPerGame >= 20) {
    return 8
  }

  if (pointsPerGame >= 15) {
    return 4
  }

  return 0
}

function getLongevitySignal(player: PlayerRecord): number {
  const seasonsPlayed = player.career.seasonsPlayed ?? 0

  if (seasonsPlayed >= 12) {
    return 8
  }

  if (seasonsPlayed >= 7) {
    return 4
  }

  return 0
}

function hasEasyAnchor(player: PlayerRecord): boolean {
  const careerCounts = getCareerCounts(player)

  return (
    careerCounts.isHallOfFame ||
    careerCounts.isGreatest75 ||
    careerCounts.mvpAwards >= 1 ||
    careerCounts.allStarAppearances >= 5 ||
    careerCounts.allNbaSelections >= 4 ||
    careerCounts.championships >= 3
  )
}

function hasMediumAnchor(player: PlayerRecord): boolean {
  const careerCounts = getCareerCounts(player)

  return (
    careerCounts.isHallOfFame ||
    careerCounts.allStarAppearances >= 2 ||
    careerCounts.allNbaSelections >= 2 ||
    careerCounts.championships >= 1 ||
    (player.career.seasonsPlayed ?? 0) >= 10
  )
}

function compareHistoricPriority(left: PlayerRecord, right: PlayerRecord): number {
  const visibilityGap = getHistoricVisibilityScore(right) - getHistoricVisibilityScore(left)

  if (visibilityGap !== 0) {
    return visibilityGap
  }

  const completenessGap = getHistoricCompletenessScore(right) - getHistoricCompletenessScore(left)

  if (completenessGap !== 0) {
    return completenessGap
  }

  const rightCounts = getCareerCounts(right)
  const leftCounts = getCareerCounts(left)
  const allStarGap = rightCounts.allStarAppearances - leftCounts.allStarAppearances

  if (allStarGap !== 0) {
    return allStarGap
  }

  const championshipGap = rightCounts.championships - leftCounts.championships

  if (championshipGap !== 0) {
    return championshipGap
  }

  return left.displayName.localeCompare(right.displayName)
}

function capEasyHistoricPlayers(players: PlayerRecord[]): PlayerRecord[] {
  const sortedPlayers = [...players].sort(compareHistoricPriority)
  const countsByDecade = new Map<string, number>()
  const selectedIds = new Set<number>()

  for (const player of sortedPlayers) {
    const decadeKey = getDecadeKey(player)

    if (!decadeKey) {
      continue
    }

    const used = countsByDecade.get(decadeKey) ?? 0

    if (used >= EASY_HISTORIC_MAX_PER_DECADE) {
      continue
    }

    countsByDecade.set(decadeKey, used + 1)
    selectedIds.add(player.id)
  }

  return players.filter((player) => selectedIds.has(player.id))
}

export function getHistoricCompletenessScore(player: PlayerRecord): number {
  return (
    Number(Boolean(player.birthDate) || player.career.hasRichMetadata) +
    Number(player.position !== 'N/A') +
    Number(player.heightInInches !== null) +
    Number(player.career.careerTeamIds.length > 0 || player.career.previousTeamIds.length > 0) +
    Number(getEntryYear(player) !== null || player.draft.isUndrafted) +
    Number(Boolean(player.headshotUrl)) +
    Number(hasAccoladeSignal(player))
  )
}

export function getHistoricVisibilityScore(player: PlayerRecord): number {
  const careerCounts = getCareerCounts(player)

  return (
    (careerCounts.isHallOfFame ? 35 : 0) +
    (careerCounts.isGreatest75 ? 30 : 0) +
    Math.min(careerCounts.mvpAwards, 2) * 18 +
    Math.min(careerCounts.finalsMvpAwards, 2) * 12 +
    Math.min(careerCounts.championships, 4) * 8 +
    Math.min(careerCounts.allNbaSelections, 6) * 4 +
    Math.min(careerCounts.allStarAppearances, 10) * 3 +
    Math.min(careerCounts.allDefensiveSelections, 6) * 2 +
    Math.min(careerCounts.scoringTitles, 3) * 4 +
    Math.min(careerCounts.reboundTitles, 3) * 3 +
    Math.min(careerCounts.assistTitles, 3) * 3 +
    Math.min(careerCounts.defensivePlayerOfTheYearAwards, 2) * 6 +
    Math.min(careerCounts.rookieOfTheYearAwards, 1) * 4 +
    getCareerScoringSignal(player) +
    getLongevitySignal(player)
  )
}

function isEasyHistoricEligible(player: PlayerRecord): boolean {
  return (
    getHistoricCompletenessScore(player) >= 7 &&
    getHistoricVisibilityScore(player) >= 65 &&
    hasEasyAnchor(player)
  )
}

function isMediumHistoricEligible(player: PlayerRecord): boolean {
  return (
    getHistoricCompletenessScore(player) >= 6 &&
    getHistoricVisibilityScore(player) >= 35 &&
    hasMediumAnchor(player)
  )
}

function isHardHistoricEligible(player: PlayerRecord): boolean {
  return (
    getHistoricCompletenessScore(player) >= 5 &&
    getHistoricVisibilityScore(player) >= 18 &&
    (player.career.seasonsPlayed ?? 0) >= 6
  )
}

function isBroadHistoricEligible(player: PlayerRecord): boolean {
  const careerCounts = getCareerCounts(player)

  return (
    getHistoricCompletenessScore(player) >= 5 &&
    (getHistoricVisibilityScore(player) >= 8 ||
      (player.career.seasonsPlayed ?? 0) >= 3 ||
      careerCounts.allStarAppearances > 0 ||
      careerCounts.allNbaSelections > 0 ||
      careerCounts.championships > 0)
  )
}

export function getHistoricPoolSummary(difficultyId: DifficultyId): string {
  switch (difficultyId) {
    case 'easy':
      return 'Curated legends and famous stars only. Easy Historic is capped by era so it does not surface random fringe names.'
    case 'medium':
      return 'Recognizable all-time names with strong metadata and a clear visibility signal.'
    case 'hard':
      return 'Broader all-time pool with solid metadata, lower celebrity filtering, and real deduction value.'
    case 'impossible':
      return 'Broad history pool with fairness guards. Incomplete or weak-metadata records stay out.'
    case 'elite-ball-knowledge':
      return 'Strict all-time pool with fairness guards. Obscurity for its own sake stays out.'
    default:
      return 'All-time pool with difficulty-aware curation.'
  }
}

export function filterHistoricPlayersForDifficulty(
  players: PlayerRecord[],
  difficultyId: DifficultyId,
): PlayerRecord[] {
  const eligiblePlayers = players.filter((player) => {
    switch (difficultyId) {
      case 'easy':
        return isEasyHistoricEligible(player)
      case 'medium':
        return isMediumHistoricEligible(player)
      case 'hard':
        return isHardHistoricEligible(player)
      case 'impossible':
      case 'elite-ball-knowledge':
        return isBroadHistoricEligible(player)
      default:
        return true
    }
  })

  return difficultyId === 'easy' ? capEasyHistoricPlayers(eligiblePlayers) : eligiblePlayers
}
