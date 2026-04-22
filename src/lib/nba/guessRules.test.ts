import { describe, expect, it } from 'vitest'

import { buildPlayerRecord } from './testUtils'
import {
  getBlockedTeamIdForNextGuess,
  shouldBlockConsecutiveSameTeamGuess,
} from './guessRules'

describe('elite guess rules', () => {
  it('blocks consecutive same-team guesses when the prior team clue was not solved', () => {
    const target = buildPlayerRecord({
      id: 90,
      teamId: 1610612749,
      teamAbbreviation: 'MIL',
      teamName: 'Milwaukee Bucks',
    })
    const priorGuess = buildPlayerRecord({
      id: 11,
      teamId: 1610612752,
      teamAbbreviation: 'NYK',
      teamName: 'New York Knicks',
    })
    const nextGuess = buildPlayerRecord({
      id: 12,
      teamId: 1610612752,
      teamAbbreviation: 'NYK',
      teamName: 'New York Knicks',
    })

    expect(
      shouldBlockConsecutiveSameTeamGuess({
        difficultyId: 'elite-ball-knowledge',
        priorGuess,
        nextGuess,
        target,
        referenceDate: '2026-04-22',
      }),
    ).toBe(true)
  })

  it('allows consecutive same-team guesses after the team clue is solved', () => {
    const target = buildPlayerRecord({
      id: 90,
      teamId: 1610612747,
      teamAbbreviation: 'LAL',
      teamName: 'Los Angeles Lakers',
    })
    const priorGuess = buildPlayerRecord({
      id: 11,
      teamId: 1610612747,
      teamAbbreviation: 'LAL',
      teamName: 'Los Angeles Lakers',
    })
    const nextGuess = buildPlayerRecord({
      id: 12,
      teamId: 1610612747,
      teamAbbreviation: 'LAL',
      teamName: 'Los Angeles Lakers',
    })

    expect(
      shouldBlockConsecutiveSameTeamGuess({
        difficultyId: 'elite-ball-knowledge',
        priorGuess,
        nextGuess,
        target,
        referenceDate: '2026-04-22',
      }),
    ).toBe(false)
  })

  it('drops the blocked-team marker after an exact team hit', () => {
    const lastGuessedPlayer = buildPlayerRecord({
      id: 11,
      teamId: 1610612747,
      teamAbbreviation: 'LAL',
      teamName: 'Los Angeles Lakers',
    })

    expect(
      getBlockedTeamIdForNextGuess({
        difficultyId: 'elite-ball-knowledge',
        status: 'in_progress',
        lastGuessedPlayer,
        lastGuessResult: {
          guess: lastGuessedPlayer,
          isCorrect: false,
          clues: {
            player: { status: 'miss', direction: null },
            team: { status: 'exact', direction: null },
            conference: { status: 'exact', direction: null },
            division: { status: 'exact', direction: null },
            position: { status: 'miss', direction: null },
            height: { status: 'miss', direction: null },
            age: { status: 'miss', direction: null },
            jerseyNumber: { status: 'miss', direction: null },
          },
        },
      }),
    ).toBeNull()
  })
})
