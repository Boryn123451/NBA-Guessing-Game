import type { SearchMatchMode } from './difficulty'
import { normalizeSearchValue } from './normalize'
import type { PlayerRecord } from './types'

interface RankedResult {
  player: PlayerRecord
  score: number
  guessed: boolean
}

export interface SearchOptions {
  includeGuessedPlayers: boolean
  limit: number
  matchMode: SearchMatchMode
  typoTolerance: boolean
}

function getEditDistance(left: string, right: string): number {
  if (left === right) {
    return 0
  }

  if (left.length === 0) {
    return right.length
  }

  if (right.length === 0) {
    return left.length
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  const current = new Array<number>(right.length + 1)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1

      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      )
    }

    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index]
    }
  }

  return previous[right.length]
}

function getTypoScore(needle: string, displayName: string, parts: string[]): number | null {
  if (needle.length < 4) {
    return null
  }

  const threshold = needle.length >= 8 ? 2 : 1
  const candidates = [displayName, ...parts]
  let bestDistance = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    bestDistance = Math.min(bestDistance, getEditDistance(needle, candidate))
  }

  return bestDistance <= threshold ? 4 + bestDistance : null
}

function getScore(
  needle: string,
  tokens: string[],
  displayName: string,
  parts: string[],
  haystack: string,
  matchMode: SearchMatchMode,
  typoTolerance: boolean,
): number | null {
  if (displayName === needle) {
    return 0
  }

  const everyTokenStartsAWord =
    tokens.length > 1 && tokens.every((token) => parts.some((part) => part.startsWith(token)))

  if (displayName.startsWith(needle)) {
    return 1
  }

  if (parts.some((part) => part.startsWith(needle))) {
    return 2
  }

  if (matchMode === 'near-exact') {
    return everyTokenStartsAWord ? 3 : null
  }

  if (everyTokenStartsAWord) {
    return 3
  }

  if (matchMode === 'assistive' || matchMode === 'standard' || matchMode === 'strict') {
    if (tokens.every((token) => haystack.includes(token))) {
      return matchMode === 'strict' ? 4 : 3
    }
  }

  if ((matchMode === 'assistive' || matchMode === 'standard') && typoTolerance) {
    return getTypoScore(needle, displayName, parts)
  }

  return null
}

export function searchPlayers(
  players: PlayerRecord[],
  query: string,
  guessedIds: Set<number>,
  options: SearchOptions,
): PlayerRecord[] {
  const needle = normalizeSearchValue(query)

  if (!needle) {
    return []
  }

  const tokens = needle.split(' ').filter(Boolean)
  const ranked: RankedResult[] = []

  for (const player of players) {
    const isGuessed = guessedIds.has(player.id)

    if (isGuessed && !options.includeGuessedPlayers) {
      continue
    }

    const displayName = normalizeSearchValue(player.displayName)
    const parts = displayName.split(' ').filter(Boolean)
    const score = getScore(
      needle,
      tokens,
      displayName,
      parts,
      player.searchText,
      options.matchMode,
      options.typoTolerance,
    )

    if (score !== null) {
      ranked.push({
        player,
        score,
        guessed: isGuessed,
      })
    }
  }

  return ranked
    .toSorted((left, right) => {
      if (left.guessed !== right.guessed) {
        return left.guessed ? 1 : -1
      }

      if (left.score !== right.score) {
        return left.score - right.score
      }

      return left.player.displayName.localeCompare(right.player.displayName)
    })
    .slice(0, options.limit)
    .map(({ player }) => player)
}

