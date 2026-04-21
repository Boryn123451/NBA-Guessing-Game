import { describe, expect, it } from 'vitest'

import { compareGuess } from './comparison'
import { buildPlayerRecord } from './testUtils'

describe('compareGuess', () => {
  it('marks combo position overlap as close', () => {
    const guess = buildPlayerRecord({ position: 'F', positionTokens: ['F'] })
    const target = buildPlayerRecord({
      id: 2,
      position: 'F-C',
      positionTokens: ['F', 'C'],
    })

    const result = compareGuess(guess, target, '2026-04-21', 'medium')

    expect(result.clues.position.status).toBe('close')
  })

  it('marks nearby numbers as close and shows direction', () => {
    const guess = buildPlayerRecord({ heightInInches: 78, currentAge: 26, jerseyNumber: 4 })
    const target = buildPlayerRecord({
      id: 2,
      heightInInches: 80,
      currentAge: 28,
      jerseyNumber: 6,
    })

    const result = compareGuess(guess, target, '2026-04-21', 'medium')

    expect(result.clues.height).toEqual({ status: 'close', direction: 'up' })
    expect(result.clues.age).toEqual({ status: 'close', direction: 'up' })
    expect(result.clues.jerseyNumber).toEqual({ status: 'close', direction: 'up' })
  })

  it('falls back to unknown when jersey data is missing', () => {
    const guess = buildPlayerRecord({ jerseyNumber: null })
    const target = buildPlayerRecord({ id: 2, jerseyNumber: 10 })

    const result = compareGuess(guess, target, '2026-04-21', 'medium')

    expect(result.clues.jerseyNumber.status).toBe('unknown')
  })

  it('strips Elite jersey closeness and uses age buckets instead of exact ages', () => {
    const guess = buildPlayerRecord({ currentAge: 24, jerseyNumber: 4 })
    const target = buildPlayerRecord({ id: 2, currentAge: 25, jerseyNumber: 5 })

    const result = compareGuess(guess, target, '2026-04-21', 'elite-ball-knowledge')

    expect(result.clues.age.status).toBe('exact')
    expect(result.clues.jerseyNumber.status).toBe('miss')
  })
})
