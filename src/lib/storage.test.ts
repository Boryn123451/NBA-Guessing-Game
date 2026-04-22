import { describe, expect, it } from 'vitest'

import { coercePersistedState } from './storage'

describe('persisted state coercion', () => {
  it('dedupes pending celebrations and daily history entries', () => {
    const state = coercePersistedState(
      {
        version: 5,
        preferences: {
          mode: 'daily',
          clueMode: 'standard',
          themeId: 'classic',
          difficulty: 'medium',
          eventId: null,
          practiceIncludePostseason: false,
        },
        settings: {
          units: 'imperial',
          theme: 'system',
          retroThemeId: '2020s',
        },
        profile: {
          profileId: 'local-profile',
          displayName: 'Player',
          createdAt: '2026-04-22T08:00:00.000Z',
          points: 12,
          unlockedRetroThemeIds: ['2020s'],
        },
        progression: {
          badges: {},
          weeklyQuests: {
            weekId: '2026-W17',
            generatedAt: '2026-04-20T08:00:00.000Z',
            currentWinStreak: 0,
            quests: [],
          },
          records: {
            bestSolveByDifficulty: {
              easy: null,
              medium: null,
              hard: null,
              impossible: null,
              'elite-ball-knowledge': null,
            },
            longestWinStreak: 0,
            bestDailyStreak: 0,
            bestEventSolveByEvent: {},
            eventWinsByEvent: {},
          },
          streaks: {
            currentOverall: 0,
            maxOverall: 0,
            currentDaily: 0,
            maxDaily: 0,
            lastDailyWinDate: null,
          },
          dailyWinDateKeys: ['2026-04-21', '2026-04-21'],
          dailyHistory: [
            {
              dateKey: '2026-04-21',
              completedAt: '2026-04-21T08:00:00.000Z',
              didWin: false,
              guessCount: 8,
              difficultyId: 'easy',
              clueMode: 'career',
              themeId: 'rookies',
              eventId: null,
            },
            {
              dateKey: '2026-04-21',
              completedAt: '2026-04-21T10:00:00.000Z',
              didWin: true,
              guessCount: 4,
              difficultyId: 'hard',
              clueMode: 'draft',
              themeId: 'international',
              eventId: 'playoff-mode',
            },
          ],
          pendingCelebrations: [
            {
              id: 'record:daily-streak',
              type: 'record',
              title: 'New personal record',
              body: 'Best daily streak: 2',
              createdAt: '2026-04-21T10:00:00.000Z',
            },
            {
              id: 'record:daily-streak',
              type: 'record',
              title: 'New personal record',
              body: 'Best daily streak: 2',
              createdAt: '2026-04-21T10:00:00.000Z',
            },
            {
              id: 'badge:first-win',
              type: 'badge',
              title: 'Badge unlocked: First Win',
              body: 'Take your first board.',
              createdAt: '2026-04-21T10:01:00.000Z',
            },
          ],
        },
        dailySessions: {},
        practiceSessions: {},
        stats: {
          daily: {
            overall: {
              gamesPlayed: 0,
              wins: 0,
              losses: 0,
              currentStreak: 0,
              maxStreak: 0,
              totalCompletedGuesses: 0,
              totalWinningGuesses: 0,
            },
            byDifficulty: {
              easy: {
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                currentStreak: 0,
                maxStreak: 0,
                totalCompletedGuesses: 0,
                totalWinningGuesses: 0,
              },
              medium: {
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                currentStreak: 0,
                maxStreak: 0,
                totalCompletedGuesses: 0,
                totalWinningGuesses: 0,
              },
              hard: {
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                currentStreak: 0,
                maxStreak: 0,
                totalCompletedGuesses: 0,
                totalWinningGuesses: 0,
              },
              impossible: {
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                currentStreak: 0,
                maxStreak: 0,
                totalCompletedGuesses: 0,
                totalWinningGuesses: 0,
              },
              'elite-ball-knowledge': {
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                currentStreak: 0,
                maxStreak: 0,
                totalCompletedGuesses: 0,
                totalWinningGuesses: 0,
              },
            },
          },
          practice: {
            overall: {
              gamesPlayed: 0,
              wins: 0,
              losses: 0,
              currentStreak: 0,
              maxStreak: 0,
              totalCompletedGuesses: 0,
              totalWinningGuesses: 0,
            },
            byDifficulty: {
              easy: {
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                currentStreak: 0,
                maxStreak: 0,
                totalCompletedGuesses: 0,
                totalWinningGuesses: 0,
              },
              medium: {
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                currentStreak: 0,
                maxStreak: 0,
                totalCompletedGuesses: 0,
                totalWinningGuesses: 0,
              },
              hard: {
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                currentStreak: 0,
                maxStreak: 0,
                totalCompletedGuesses: 0,
                totalWinningGuesses: 0,
              },
              impossible: {
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                currentStreak: 0,
                maxStreak: 0,
                totalCompletedGuesses: 0,
                totalWinningGuesses: 0,
              },
              'elite-ball-knowledge': {
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                currentStreak: 0,
                maxStreak: 0,
                totalCompletedGuesses: 0,
                totalWinningGuesses: 0,
              },
            },
          },
        },
      },
      new Date('2026-04-22T08:00:00.000Z'),
      'UTC',
    )

    expect(state.progression.pendingCelebrations).toHaveLength(2)
    expect(state.progression.dailyWinDateKeys).toEqual(['2026-04-21'])
    expect(state.progression.dailyHistory).toHaveLength(1)
    expect(state.progression.dailyHistory[0]).toMatchObject({
      dateKey: '2026-04-21',
      didWin: true,
      guessCount: 4,
      difficultyId: 'hard',
      clueMode: 'draft',
      themeId: 'international',
      eventId: 'playoff-mode',
    })
  })

  it('migrates legacy retro theme ids into decade packs', () => {
    const state = coercePersistedState(
      {
        version: 5,
        preferences: {
          mode: 'daily',
          clueMode: 'standard',
          themeId: 'classic',
          difficulty: 'medium',
          eventId: null,
          practiceIncludePostseason: false,
        },
        settings: {
          units: 'imperial',
          theme: 'system',
          retroThemeId: 'vhs-crt',
        },
        profile: {
          profileId: 'local-profile',
          displayName: 'Player',
          createdAt: '2026-04-22T08:00:00.000Z',
          points: 12,
          unlockedRetroThemeIds: ['default', 'newsprint', 'arcade', 'vhs-crt'],
        },
        progression: {},
        dailySessions: {},
        practiceSessions: {},
        stats: {},
      },
      new Date('2026-04-22T08:00:00.000Z'),
      'UTC',
    )

    expect(state.settings.retroThemeId).toBe('1990s')
    expect(state.profile.unlockedRetroThemeIds).toEqual(['2020s', '1950s', '1980s', '1990s'])
  })
})
