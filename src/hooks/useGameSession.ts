import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react'

import { loadPlayerPool } from '../lib/data/provider'
import {
  canRevealManualBonusClue,
  getNextManualBonusClueId,
  getRevealedBonusClues,
} from '../lib/nba/bonusClues'
import { compareGuess } from '../lib/nba/comparison'
import {
  formatCountdown,
  getDetectedTimeZone,
  getLeagueDateKey,
  getResetCountdown,
  pickDailyPlayer,
  pickPracticePlayer,
} from '../lib/nba/daily'
import {
  getActiveEventModes,
  getUpcomingEventModes,
  sanitizeEventId,
} from '../lib/nba/events'
import {
  DIFFICULTY_DEFINITIONS,
  getDifficultyDefinition,
} from '../lib/nba/difficulty'
import { buildShareSummary } from '../lib/nba/share'
import {
  formatThemeSummary,
  getThemeOptions,
  getVariantPlayerPool,
} from '../lib/nba/themes'
import {
  getDailySessionKey,
  getVariantSessionKey,
  normalizeVariant,
} from '../lib/nba/variant'
import type {
  ClueMode,
  DifficultyId,
  GameMode,
  GameVariant,
  PersistedState,
  PlayerRecord,
  PlayerThemeId,
  StoredGameSession,
  ThemeMode,
  UnitSystem,
} from '../lib/nba/types'
import { sanitizeDisplayName } from '../lib/profile/profile'
import {
  applyCompletedRoundProgression,
  claimWeeklyQuestReward,
  dismissCelebration,
  ensureProgressionState,
} from '../lib/profile/progression'
import { getNextWeeklyReset } from '../lib/profile/weeklyQuests'
import {
  coercePersistedState,
  createDefaultState,
  createSession,
  getStoredSession,
  isStorageAvailable,
  loadPersistedState,
  recordCompletedGame,
  replaceModeSession,
  savePersistedState,
} from '../lib/storage'

const playerPool = loadPlayerPool()
const allPlayers = playerPool.players
const playerById = new Map<number, PlayerRecord>(allPlayers.map((player) => [player.id, player]))

function resolveVariantForDifficulty(
  clueMode: ClueMode,
  themeId: PlayerThemeId,
  eventId: PersistedState['preferences']['eventId'],
  difficultyId: DifficultyId,
): GameVariant {
  const difficulty = getDifficultyDefinition(difficultyId)

  return normalizeVariant({
    clueMode: difficulty.clueAvailability.careerPathMode ? clueMode : 'standard',
    themeId,
    eventId,
  })
}

function resolveVariantFromState(state: PersistedState): GameVariant {
  return resolveVariantForDifficulty(
    state.preferences.clueMode,
    state.preferences.themeId,
    state.preferences.eventId,
    state.preferences.difficulty,
  )
}

function getPlayersForVariant(variant: GameVariant): PlayerRecord[] {
  const filteredPlayers = getVariantPlayerPool(allPlayers, variant)
  return filteredPlayers.length > 0 ? filteredPlayers : allPlayers
}

function getSessionKey(
  mode: GameMode,
  dateKey: string,
  variant: GameVariant,
  difficultyId: DifficultyId,
): string {
  return mode === 'daily'
    ? getDailySessionKey(dateKey, variant, difficultyId)
    : getVariantSessionKey(variant, difficultyId)
}

function createVariantSession(
  mode: GameMode,
  dateKey: string,
  variant: GameVariant,
  players: PlayerRecord[],
  excludedPlayerIds: number[] = [],
): StoredGameSession {
  const target =
    mode === 'daily'
      ? pickDailyPlayer(players, dateKey, variant)
      : pickPracticePlayer(players, excludedPlayerIds)

  return createSession(target.id)
}

function resolveSession(
  state: PersistedState,
  dateKey: string,
): {
  difficultyId: DifficultyId
  variant: GameVariant
  players: PlayerRecord[]
  sessionKey: string
  session: StoredGameSession
} {
  const difficultyId = state.preferences.difficulty
  const variant = resolveVariantFromState(state)
  const players = getPlayersForVariant(variant)
  const sessionKey = getSessionKey(state.preferences.mode, dateKey, variant, difficultyId)
  const storedSession = getStoredSession(state, state.preferences.mode, sessionKey)
  const playerIds = new Set(players.map((player) => player.id))

  if (storedSession && playerIds.has(storedSession.targetPlayerId)) {
    return {
      difficultyId,
      variant,
      players,
      sessionKey,
      session: storedSession,
    }
  }

  return {
    difficultyId,
    variant,
    players,
    sessionKey,
    session: createVariantSession(state.preferences.mode, dateKey, variant, players),
  }
}

function shouldKeepInactiveEventSelection(
  state: PersistedState,
  dateKey: string,
): boolean {
  if (!state.preferences.eventId) {
    return false
  }

  const variant = resolveVariantFromState(state)
  const sessionKey = getSessionKey(state.preferences.mode, dateKey, variant, state.preferences.difficulty)
  const session = getStoredSession(state, state.preferences.mode, sessionKey)

  return Boolean(session && session.status === 'in_progress' && session.guessIds.length > 0)
}

function ensureHydratedState(
  state: PersistedState,
  dateKey: string,
  now: Date,
  timeZone: string,
  activeEventIds: PersistedState['preferences']['eventId'][],
): PersistedState {
  const progressionState = ensureProgressionState(state.progression, now, timeZone)
  const keepInactiveEvent = shouldKeepInactiveEventSelection(
    {
      ...state,
      progression: progressionState,
    },
    dateKey,
  )
  const sanitizedEventId =
    activeEventIds.includes(state.preferences.eventId) || keepInactiveEvent
      ? state.preferences.eventId
      : sanitizeEventId(state.preferences.eventId, activeEventIds.filter(Boolean) as NonNullable<
          PersistedState['preferences']['eventId']
        >[])
  const resolvedVariant = resolveVariantForDifficulty(
    state.preferences.clueMode,
    state.preferences.themeId,
    sanitizedEventId,
    state.preferences.difficulty,
  )
  const nextState =
    progressionState === state.progression &&
    sanitizedEventId === state.preferences.eventId &&
    resolvedVariant.clueMode === state.preferences.clueMode
      ? state
      : {
          ...state,
          preferences: {
            ...state.preferences,
            clueMode: resolvedVariant.clueMode,
            eventId: sanitizedEventId,
          },
          progression: progressionState,
        }
  const { session, sessionKey } = resolveSession(nextState, dateKey)
  const storedSession = getStoredSession(nextState, nextState.preferences.mode, sessionKey)

  if (storedSession && storedSession.targetPlayerId === session.targetPlayerId) {
    return nextState
  }

  return replaceModeSession(nextState, nextState.preferences.mode, session, sessionKey)
}

function updateActiveSession(
  state: PersistedState,
  dateKey: string,
  now: Date,
  timeZone: string,
  activeEventIds: PersistedState['preferences']['eventId'][],
  mutate: (session: StoredGameSession) => StoredGameSession | null,
): PersistedState {
  const preparedState = ensureHydratedState(state, dateKey, now, timeZone, activeEventIds)
  const { session, sessionKey } = resolveSession(preparedState, dateKey)
  const nextSession = mutate(session)

  if (!nextSession) {
    return preparedState
  }

  return replaceModeSession(
    preparedState,
    preparedState.preferences.mode,
    nextSession,
    sessionKey,
  )
}

export function useGameSession() {
  const [timeZone] = useState(() => getDetectedTimeZone())
  const [now, setNow] = useState(() => new Date())
  const dailyDateKey = getLeagueDateKey(now, timeZone)
  const [state, setState] = useState<PersistedState>(() => loadPersistedState())
  const [storageAvailable] = useState(() => isStorageAvailable())

  const syncClock = useEffectEvent(() => {
    setNow(new Date())
  })

  useEffect(() => {
    const timer = window.setInterval(syncClock, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const activeEventModes = useMemo(
    () => getActiveEventModes(allPlayers, now, timeZone),
    [now, timeZone],
  )
  const upcomingEventModes = useMemo(
    () => getUpcomingEventModes(allPlayers, now, timeZone),
    [now, timeZone],
  )
  const activeEventIds = activeEventModes.map((eventMode) => eventMode.id)
  const hydratedState = useMemo(
    () => ensureHydratedState(state, dailyDateKey, now, timeZone, activeEventIds),
    [state, dailyDateKey, now, timeZone, activeEventIds],
  )

  useEffect(() => {
    savePersistedState(hydratedState)
  }, [hydratedState])

  const activeDifficultyId = hydratedState.preferences.difficulty
  const activeDifficulty = getDifficultyDefinition(activeDifficultyId)
  const activeVariant = resolveVariantFromState(hydratedState)
  const activePlayers = getPlayersForVariant(activeVariant)
  const sessionKey = getSessionKey(
    hydratedState.preferences.mode,
    dailyDateKey,
    activeVariant,
    activeDifficultyId,
  )
  const activeSession =
    getStoredSession(hydratedState, hydratedState.preferences.mode, sessionKey) ??
    createVariantSession(
      hydratedState.preferences.mode,
      dailyDateKey,
      activeVariant,
      activePlayers,
    )
  const activeTarget = playerById.get(activeSession.targetPlayerId) ?? activePlayers[0] ?? allPlayers[0]
  const guessedPlayers = activeSession.guessIds
    .map((guessId) => playerById.get(guessId))
    .filter((player): player is PlayerRecord => Boolean(player))
  const guessResults = guessedPlayers.map((player) =>
    compareGuess(player, activeTarget, dailyDateKey, activeDifficultyId),
  )
  const guessedIds = new Set(activeSession.guessIds)
  const lastGuessedPlayer = guessedPlayers.at(-1) ?? null
  const canGuess =
    activeSession.status === 'in_progress' &&
    activeSession.guessIds.length < activeDifficulty.maxGuesses
  const variantLocked =
    activeSession.status === 'in_progress' && activeSession.guessIds.length > 0
  const wrongGuessCount =
    activeSession.status === 'won'
      ? Math.max(activeSession.guessIds.length - 1, 0)
      : activeSession.guessIds.length
  const blockedTeamId =
    activeDifficulty.blockConsecutiveSameTeam && activeSession.status === 'in_progress'
      ? lastGuessedPlayer?.teamId ?? null
      : null
  const themeOptions = getThemeOptions(allPlayers)
  const revealedBonusClues = getRevealedBonusClues(
    activeTarget,
    activeDifficultyId,
    wrongGuessCount,
    activeSession.revealedBonusClueIds,
  )
  const canRevealBonusClue =
    activeVariant.clueMode === 'standard' &&
    activeSession.status === 'in_progress' &&
    canRevealManualBonusClue(
      activeTarget,
      activeDifficultyId,
      wrongGuessCount,
      activeSession.revealedBonusClueIds,
    )
  const lastGuess = guessResults.at(-1)
  const closeGuessFeedback =
    activeDifficulty.ui.showCloseGuessFeedback &&
    lastGuess &&
    !lastGuess.isCorrect &&
    Object.values(lastGuess.clues).some((clue) => clue.status === 'close')
      ? 'Close guess. One or more clues are within range.'
      : null
  const profileWarning =
    activeDifficulty.profileWarningAfterMisses !== null &&
    activeSession.status === 'in_progress' &&
    wrongGuessCount >= activeDifficulty.profileWarningAfterMisses
      ? 'Change the player profile. Repeating the same archetype will waste the board.'
      : null
  const activeEventMode =
    activeVariant.eventId !== null
      ? activeEventModes.find((eventMode) => eventMode.id === activeVariant.eventId) ?? null
      : null
  const nextWeeklyReset = getNextWeeklyReset(now, timeZone)
  const weeklyResetCountdown = Math.max(nextWeeklyReset.toMillis() - now.getTime(), 0)

  function submitGuess(playerId: number): void {
    setState((previousState) => {
      const preparedState = ensureHydratedState(
        previousState,
        dailyDateKey,
        now,
        timeZone,
        activeEventIds,
      )
      const {
        difficultyId,
        players,
        session,
        sessionKey: resolvedSessionKey,
        variant,
      } = resolveSession(preparedState, dailyDateKey)
      const playerIds = new Set(players.map((player) => player.id))
      const difficulty = getDifficultyDefinition(difficultyId)

      if (
        !playerIds.has(playerId) ||
        session.status !== 'in_progress' ||
        session.guessIds.includes(playerId)
      ) {
        return preparedState
      }

      if (difficulty.blockConsecutiveSameTeam && session.guessIds.length > 0) {
        const lastGuessId = session.guessIds.at(-1)
        const lastGuess = lastGuessId ? playerById.get(lastGuessId) : null
        const nextGuess = playerById.get(playerId)

        if (lastGuess && nextGuess && lastGuess.teamId === nextGuess.teamId) {
          return preparedState
        }
      }

      const nextGuessIds = [...session.guessIds, playerId]
      const didWin = playerId === session.targetPlayerId
      const didLose = !didWin && nextGuessIds.length >= difficulty.maxGuesses
      const completedAt = didWin || didLose ? new Date().toISOString() : null
      const nextSession: StoredGameSession = {
        ...session,
        guessIds: nextGuessIds,
        status: didWin ? 'won' : didLose ? 'lost' : 'in_progress',
        completedAt,
      }
      const replacedState = replaceModeSession(
        preparedState,
        preparedState.preferences.mode,
        nextSession,
        resolvedSessionKey,
      )

      if (nextSession.status === 'in_progress' || session.status !== 'in_progress') {
        return replacedState
      }

      const statsState = {
        ...replacedState.stats,
        [preparedState.preferences.mode]: recordCompletedGame(
          replacedState.stats[preparedState.preferences.mode],
          difficultyId,
          nextSession,
        ),
      }
      const progressed = applyCompletedRoundProgression({
        profile: replacedState.profile,
        progression: replacedState.progression,
        stats: statsState,
        context: {
          mode: preparedState.preferences.mode,
          difficultyId,
          eventId: variant.eventId,
          didWin,
          guessCount: nextSession.guessIds.length,
          dateKey: dailyDateKey,
          units: preparedState.settings.units,
        },
        now: completedAt ? new Date(completedAt) : new Date(),
        timeZone,
      })

      return {
        ...replacedState,
        stats: statsState,
        profile: progressed.profile,
        progression: progressed.progression,
      }
    })
  }

  function setMode(mode: GameMode): void {
    setState((previousState) => ({
      ...previousState,
      preferences: {
        ...previousState.preferences,
        mode,
      },
    }))
  }

  function setClueMode(clueMode: ClueMode): void {
    setState((previousState) => {
      const preparedState = ensureHydratedState(
        previousState,
        dailyDateKey,
        now,
        timeZone,
        activeEventIds,
      )
      const { session } = resolveSession(preparedState, dailyDateKey)

      if (session.status === 'in_progress' && session.guessIds.length > 0) {
        return preparedState
      }

      const difficulty = getDifficultyDefinition(preparedState.preferences.difficulty)

      return {
        ...preparedState,
        preferences: {
          ...preparedState.preferences,
          clueMode: difficulty.clueAvailability.careerPathMode ? clueMode : 'standard',
        },
      }
    })
  }

  function setThemeId(themeId: PlayerThemeId): void {
    setState((previousState) => {
      const preparedState = ensureHydratedState(
        previousState,
        dailyDateKey,
        now,
        timeZone,
        activeEventIds,
      )
      const { session } = resolveSession(preparedState, dailyDateKey)

      if (session.status === 'in_progress' && session.guessIds.length > 0) {
        return preparedState
      }

      return {
        ...preparedState,
        preferences: {
          ...preparedState.preferences,
          themeId,
        },
      }
    })
  }

  function setDifficulty(difficulty: DifficultyId): void {
    setState((previousState) => {
      const preparedState = ensureHydratedState(
        previousState,
        dailyDateKey,
        now,
        timeZone,
        activeEventIds,
      )
      const { session } = resolveSession(preparedState, dailyDateKey)
      const roundInProgress = session.status === 'in_progress' && session.guessIds.length > 0

      if (roundInProgress) {
        return preparedState
      }

      return {
        ...preparedState,
        preferences: {
          ...preparedState.preferences,
          difficulty,
          clueMode:
            getDifficultyDefinition(difficulty).clueAvailability.careerPathMode
              ? preparedState.preferences.clueMode
              : 'standard',
        },
      }
    })
  }

  function setEventId(eventId: PersistedState['preferences']['eventId']): void {
    setState((previousState) => {
      const preparedState = ensureHydratedState(
        previousState,
        dailyDateKey,
        now,
        timeZone,
        activeEventIds,
      )
      const { session } = resolveSession(preparedState, dailyDateKey)

      if (session.status === 'in_progress' && session.guessIds.length > 0) {
        return preparedState
      }

      return {
        ...preparedState,
        preferences: {
          ...preparedState.preferences,
          eventId: sanitizeEventId(
            eventId,
            activeEventIds.filter(Boolean) as NonNullable<PersistedState['preferences']['eventId']>[],
          ),
        },
      }
    })
  }

  function setUnits(units: UnitSystem): void {
    setState((previousState) => ({
      ...previousState,
      settings: {
        ...previousState.settings,
        units,
      },
    }))
  }

  function setTheme(theme: ThemeMode): void {
    setState((previousState) => ({
      ...previousState,
      settings: {
        ...previousState.settings,
        theme,
      },
    }))
  }

  function setDisplayName(displayName: string): void {
    setState((previousState) => ({
      ...previousState,
      profile: {
        ...previousState.profile,
        displayName: sanitizeDisplayName(displayName),
      },
    }))
  }

  function revealBonusClue(): void {
    setState((previousState) =>
      updateActiveSession(
        previousState,
        dailyDateKey,
        now,
        timeZone,
        activeEventIds,
        (session) => {
          if (session.status !== 'in_progress') {
            return null
          }

          const target = playerById.get(session.targetPlayerId)

          if (!target) {
            return null
          }

          const nextClueId = getNextManualBonusClueId(
            target,
            previousState.preferences.difficulty,
            session.guessIds.length,
            session.revealedBonusClueIds,
          )

          if (!nextClueId) {
            return null
          }

          return {
            ...session,
            revealedBonusClueIds: [...session.revealedBonusClueIds, nextClueId],
          }
        },
      ),
    )
  }

  function revealSilhouette(): void {
    setState((previousState) =>
      updateActiveSession(
        previousState,
        dailyDateKey,
        now,
        timeZone,
        activeEventIds,
        (session) => {
          if (
            session.status !== 'in_progress' ||
            session.silhouetteRevealed ||
            getDifficultyDefinition(previousState.preferences.difficulty).image.silhouetteHint ===
              'none'
          ) {
            return null
          }

          return {
            ...session,
            silhouetteRevealed: true,
          }
        },
      ),
    )
  }

  function claimQuest(questId: string): void {
    setState((previousState) => {
      const result = claimWeeklyQuestReward({
        profile: previousState.profile,
        progression: previousState.progression,
        questId,
        now,
        timeZone,
      })

      if (!result) {
        return previousState
      }

      return {
        ...previousState,
        profile: result.profile,
        progression: result.progression,
      }
    })
  }

  function dismissCelebrationById(celebrationId: string): void {
    setState((previousState) => ({
      ...previousState,
      progression: dismissCelebration(previousState.progression, celebrationId),
    }))
  }

  function importProfileData(rawValue: string): { ok: true } | { ok: false; error: string } {
    try {
      setState(coercePersistedState(JSON.parse(rawValue), now, timeZone))
      return { ok: true }
    } catch {
      return {
        ok: false,
        error: 'Import failed. Paste a valid exported profile JSON file.',
      }
    }
  }

  function startPracticeGame(): void {
    startTransition(() => {
      setState((previousState) => {
        const preparedState = ensureHydratedState(
          previousState,
          dailyDateKey,
          now,
          timeZone,
          activeEventIds,
        )
        const difficultyId = preparedState.preferences.difficulty
        const variant = resolveVariantFromState(preparedState)
        const players = getPlayersForVariant(variant)
        const nextTarget = pickPracticePlayer(players, [activeTarget.id])
        const nextSession = createSession(nextTarget.id)

        return {
          ...preparedState,
          preferences: {
            ...preparedState.preferences,
            mode: 'practice',
          },
          practiceSessions: {
            ...preparedState.practiceSessions,
            [getVariantSessionKey(variant, difficultyId)]: nextSession,
          },
        }
      })
    })
  }

  function resetStorage(): void {
    setState((previousState) => {
      const nextState = createDefaultState(now, timeZone)

      return {
        ...nextState,
        preferences: previousState.preferences,
        settings: previousState.settings,
        profile: previousState.profile,
      }
    })
  }

  return {
    activeClueMode: activeVariant.clueMode,
    activeDifficulty,
    activeDifficultyId,
    activeEventMode,
    activeEventModes,
    activeMode: hydratedState.preferences.mode,
    activePlayerCount: activePlayers.length,
    activeSession,
    activeTarget,
    activeThemeId: activeVariant.themeId,
    activeThemeSummary: formatThemeSummary(activeVariant.themeId),
    canGuess,
    canRevealBonusClue,
    canRevealSilhouette:
      activeSession.status === 'in_progress' &&
      !activeSession.silhouetteRevealed &&
      activeDifficulty.image.silhouetteHint !== 'none',
    blockedTeamId,
    celebrations: hydratedState.progression.pendingCelebrations,
    claimQuest,
    closeGuessFeedback,
    dailyDateKey,
    dataMeta: playerPool,
    difficultyOptions: DIFFICULTY_DEFINITIONS,
    dismissCelebration: dismissCelebrationById,
    eventId: activeVariant.eventId,
    exportPayload: JSON.stringify(hydratedState, null, 2),
    guessResults,
    guessedIds,
    guessedPlayers,
    importProfileData,
    isStorageAvailable: storageAvailable,
    maxGuesses: activeDifficulty.maxGuesses,
    nextWeeklyResetCountdown: formatCountdown(weeklyResetCountdown),
    players: activePlayers,
    profile: hydratedState.profile,
    profileWarning,
    progression: hydratedState.progression,
    preferences: hydratedState.preferences,
    remainingGuesses: activeDifficulty.maxGuesses - activeSession.guessIds.length,
    resetCountdown: formatCountdown(getResetCountdown(now, timeZone)),
    resetStorage,
    revealBonusClue,
    revealSilhouette,
    revealedBonusClues,
    roundLocked: variantLocked,
    setClueMode,
    setDifficulty,
    setDisplayName,
    setEventId,
    setMode,
    setTheme,
    setThemeId,
    setUnits,
    settings: hydratedState.settings,
    shareText: buildShareSummary({
      mode: hydratedState.preferences.mode,
      clueMode: activeVariant.clueMode,
      themeId: activeVariant.themeId,
      difficultyId: activeDifficultyId,
      eventId: activeVariant.eventId,
      maxGuesses: activeDifficulty.maxGuesses,
      session: activeSession,
      guesses: guessResults,
      guessCount: activeSession.guessIds.length,
      dateKey: dailyDateKey,
    }),
    showCareerPathOption: activeDifficulty.clueAvailability.careerPathMode,
    showSeasonSnapshot: activeDifficulty.clueAvailability.seasonSnapshot,
    showBonusClues: activeDifficulty.clueAvailability.bonusClues,
    startPracticeGame,
    stats: hydratedState.stats,
    submitGuess,
    themeOptions,
    upcomingEventModes,
  }
}
