import type { EntryDecadeId, PlayerRecord } from './types'

export interface EntryDecadeDefinition {
  id: EntryDecadeId
  label: string
  startYear: number
  endYear: number
}

export const ENTRY_DECADE_DEFINITIONS: EntryDecadeDefinition[] = [
  { id: '1950s', label: '1950s', startYear: 1950, endYear: 1959 },
  { id: '1960s', label: '1960s', startYear: 1960, endYear: 1969 },
  { id: '1970s', label: '1970s', startYear: 1970, endYear: 1979 },
  { id: '1980s', label: '1980s', startYear: 1980, endYear: 1989 },
  { id: '1990s', label: '1990s', startYear: 1990, endYear: 1999 },
  { id: '2000s', label: '2000s', startYear: 2000, endYear: 2009 },
  { id: '2010s', label: '2010s', startYear: 2010, endYear: 2019 },
  { id: '2020s', label: '2020s', startYear: 2020, endYear: 2029 },
]

const ENTRY_DECADE_BY_ID = new Map(
  ENTRY_DECADE_DEFINITIONS.map((definition) => [definition.id, definition]),
)

export function sanitizeEntryDecadeId(value: unknown): EntryDecadeId | null {
  switch (value) {
    case '1950s':
    case '1960s':
    case '1970s':
    case '1980s':
    case '1990s':
    case '2000s':
    case '2010s':
    case '2020s':
      return value
    default:
      return null
  }
}

export function getEntryDecadeDefinition(
  decadeId: EntryDecadeId | null,
): EntryDecadeDefinition | null {
  return decadeId ? ENTRY_DECADE_BY_ID.get(decadeId) ?? null : null
}

export function getPlayerEntryDraftYear(player: PlayerRecord): number | null {
  return player.entryDraftYear ?? player.draft.year ?? player.career.debutYear ?? null
}

export function getPlayerEntryDecadeId(player: PlayerRecord): EntryDecadeId | null {
  const year = getPlayerEntryDraftYear(player)

  if (year === null) {
    return null
  }

  return (
    ENTRY_DECADE_DEFINITIONS.find(
      (definition) => year >= definition.startYear && year <= definition.endYear,
    )?.id ?? null
  )
}

export function filterPlayersByEntryDecade(
  players: PlayerRecord[],
  decadeId: EntryDecadeId | null,
): PlayerRecord[] {
  if (decadeId === null) {
    return players
  }

  return players.filter((player) => getPlayerEntryDecadeId(player) === decadeId)
}
