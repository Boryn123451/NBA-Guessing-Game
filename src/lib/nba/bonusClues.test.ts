import { describe, expect, it } from 'vitest'

import {
  canRevealManualBonusClue,
  getRevealedBonusClues,
} from './bonusClues'
import { buildPlayerRecord } from './testUtils'

describe('bonus clues', () => {
  const player = buildPlayerRecord({
    country: 'Serbia',
    career: {
      debutYear: 2021,
      preNbaPath: 'Mega Basket',
      careerTeamIds: [1610612743],
      careerTeamAbbreviations: ['DEN'],
      careerTeamNames: ['Denver Nuggets'],
      previousTeamIds: [],
      previousTeamAbbreviations: [],
      previousTeamNames: [],
      allStarAppearances: 0,
    },
  })

  it('auto-reveals two clues in Easy after the configured miss thresholds', () => {
    const clues = getRevealedBonusClues(player, 'easy', 6, [])

    expect(clues.map((clue) => clue.id)).toEqual(['country', 'draftTeam'])
  })

  it('keeps Medium bonus clues manual and late', () => {
    expect(canRevealManualBonusClue(player, 'medium', 4, [])).toBe(false)
    expect(canRevealManualBonusClue(player, 'medium', 5, [])).toBe(true)
  })

  it('disables bonus clues entirely in Elite Ball Knowledge', () => {
    expect(getRevealedBonusClues(player, 'elite-ball-knowledge', 10, [])).toEqual([])
    expect(canRevealManualBonusClue(player, 'elite-ball-knowledge', 10, [])).toBe(false)
  })
})

