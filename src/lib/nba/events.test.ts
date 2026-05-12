import { describe, expect, it } from 'vitest'

import { getActiveEventModes } from './events'
import { buildPlayerRecord } from './testUtils'

describe('event modes', () => {
  it('activates the Brandon Clarke tribute only until the fixed ET expiry', () => {
    const players = [
      buildPlayerRecord({
        id: 1629634,
        displayName: 'Brandon Clarke',
        teamAbbreviation: 'MEM',
      }),
      buildPlayerRecord({
        id: 2,
        displayName: 'Other Player',
        teamAbbreviation: 'NYK',
      }),
    ]

    const activeEvents = getActiveEventModes(
      players,
      new Date('2026-05-14T23:59:00-04:00'),
      'America/New_York',
    )
    const expiredEvents = getActiveEventModes(
      players,
      new Date('2026-05-15T00:00:00-04:00'),
      'America/New_York',
    )

    expect(activeEvents.find((eventMode) => eventMode.id === 'brandon-clarke-tribute')).toMatchObject({
      playerCount: 1,
      tribute: expect.objectContaining({
        title: 'Rest in peace, Brandon Clarke',
      }),
    })
    expect(expiredEvents.some((eventMode) => eventMode.id === 'brandon-clarke-tribute')).toBe(false)
  })
})
