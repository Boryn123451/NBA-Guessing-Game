import { describe, expect, it } from 'vitest'

import { getCareerPathClues, isCareerClueRevealed } from './careerPath'
import { buildPlayerRecord } from './testUtils'

describe('career path clues', () => {
  it('formats undrafted and one-franchise players cleanly', () => {
    const player = buildPlayerRecord({
      draft: {
        year: null,
        round: null,
        pick: null,
        teamId: null,
        teamAbbreviation: null,
        teamName: null,
        isUndrafted: true,
      },
      career: {
        debutYear: 2022,
        finalSeasonYear: 2025,
        seasonsPlayed: 4,
        preNbaPath: 'Real Madrid',
        careerTeamIds: [1610612742],
        careerTeamAbbreviations: ['DAL'],
        careerTeamNames: ['Dallas Mavericks'],
        previousTeamIds: [],
        previousTeamAbbreviations: [],
        previousTeamNames: [],
        allStarAppearances: 0,
        championships: 0,
        accolades: [],
        primaryAccolade: null,
        hasRichMetadata: true,
      },
    })

    const clues = getCareerPathClues(player)

    expect(clues.find((clue) => clue.id === 'draftTeam')?.value).toBe('Undrafted')
    expect(clues.find((clue) => clue.id === 'previousTeams')?.value).toBe('No previous NBA teams')
  })

  it('reveals every clue after the round ends', () => {
    const clue = getCareerPathClues(buildPlayerRecord())[4]

    expect(isCareerClueRevealed(clue, 0, 'won')).toBe(true)
  })
})
