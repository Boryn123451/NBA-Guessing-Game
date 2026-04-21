import { describe, expect, it } from 'vitest'

import { getSeasonSnapshotClues, isSeasonSnapshotClueRevealed } from './seasonSnapshot'
import { buildPlayerRecord } from './testUtils'

describe('season snapshot clues', () => {
  it('buckets stat ranges instead of exposing exact numbers', () => {
    const player = buildPlayerRecord({
      snapshot: {
        pointsPerGame: 27.4,
        reboundsPerGame: 11.2,
        assistsPerGame: 8.1,
        playoffPicture: true,
        playoffRank: 2,
        accoladeLabel: '3x All-Star',
      },
    })

    const clues = getSeasonSnapshotClues(player)

    expect(clues.find((clue) => clue.id === 'points')?.value).toBe('25-29.9 PPG')
    expect(clues.find((clue) => clue.id === 'rebounds')?.value).toBe('9-11.9 RPG')
    expect(clues.find((clue) => clue.id === 'assists')?.value).toBe('8-9.9 APG')
  })

  it('keeps late snapshot clues locked until enough misses', () => {
    const clue = getSeasonSnapshotClues(buildPlayerRecord())[4]

    expect(isSeasonSnapshotClueRevealed(clue, 5, 'in_progress')).toBe(false)
    expect(isSeasonSnapshotClueRevealed(clue, 6, 'in_progress')).toBe(true)
  })
})
