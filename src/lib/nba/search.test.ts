import { describe, expect, it } from 'vitest'

import { getDifficultyDefinition } from './difficulty'
import { searchPlayers } from './search'
import { buildPlayerRecord } from './testUtils'

describe('player search', () => {
  const players = [
    buildPlayerRecord({
      id: 1,
      displayName: 'Nikola Jokic',
      firstName: 'Nikola',
      lastName: 'Jokic',
      searchText: 'nikola jokic den denver nuggets c serbia',
    }),
  ]

  it('allows typo-tolerant search in easier modes', () => {
    const easy = getDifficultyDefinition('easy')
    const results = searchPlayers(players, 'nikola jokc', new Set(), {
      includeGuessedPlayers: easy.search.includeGuessedPlayers,
      limit: easy.search.resultLimit,
      matchMode: easy.search.matchMode,
      typoTolerance: easy.search.typoTolerance,
    })

    expect(results.map((player) => player.id)).toEqual([1])
  })

  it('requires near-exact matching in Elite Ball Knowledge', () => {
    const elite = getDifficultyDefinition('elite-ball-knowledge')
    const typoResults = searchPlayers(players, 'nikola jokc', new Set(), {
      includeGuessedPlayers: elite.search.includeGuessedPlayers,
      limit: elite.search.resultLimit,
      matchMode: elite.search.matchMode,
      typoTolerance: elite.search.typoTolerance,
    })
    const exactishResults = searchPlayers(players, 'nikola jo', new Set(), {
      includeGuessedPlayers: elite.search.includeGuessedPlayers,
      limit: elite.search.resultLimit,
      matchMode: elite.search.matchMode,
      typoTolerance: elite.search.typoTolerance,
    })

    expect(typoResults).toEqual([])
    expect(exactishResults.map((player) => player.id)).toEqual([1])
  })
})

