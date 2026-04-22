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
import { compareDraftGuess } from '../lib/nba/draftMode'
import { getActiveEventModes, getUpcomingEventModes, sanitizeEventId } from '../lib/nba/events'
import {
  DIFFICULTY_DEFINITIONS,
  getDifficultyDefinition,
} from '../lib/nba/difficulty'
import {
  getBlockedTeamIdForNextGuess,
  shouldBlockConsecutiveSameTeamGuess,
} from '../lib/nba/guessRules'
import { getPlayablePlayerPool } from '../lib/nba/pools'
import { resolvePostseasonRule } from '../lib/nba/postseason'
import { buildShareSummary } from '../lib/nba/share'
import { formatThemeSummary, getThemeOptions } from '../lib/nba/themes'
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
import { getRetroThemeDefinition } from '../lib/profile/retroThemes'
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

function sanitizeClueModeForDifficulty(
  clueMode: ClueMode,
  difficultyId: DifficultyId,
): ClueMode {
  const difficulty = getDifficultyDefinition(difficultyId)

  if (clueMode === 'career' && !difficulty.clueAvailability.careerPathMode) {
    return 'standard'
  }

  if (clueMode === 'draft' && !difficulty.clueAvailability.draftMode) {
    return 'standard'
  }

  return clueMode
}

function resolveVariantForDifficulty(
  clueMode: ClueMode,
  themeId: PlayerThemeId,
  eventId: PersistedState['preferences']['eventId'],
  difficultyId: DifficultyId,
  includePostseason: boolean,
): GameVariant {
  return normalizeVariant({
    clueMode: sanitizeClueModeForDifficulty(clueMode, difficultyId),
    themeId,
    eventId,
    includePostseason,
  })
}

function resolveVariantFromState(state: PersistedState, dateKey: string): GameVariant {
  const postseasonRule = resolvePostseasonRule(
    state.preferences.mode,
    dateKey,
    state.preferences.practiceIncludePostseason,
  )

  if (state.preferences.mode === 'daily') {
    return normalizeVariant({
      clueMode: sanitizeClueModeForDifficulty(
        state.preferences.clueMode,
        state.preferences.difficulty,
      ),
      themeId: 'classic',
      eventId: null,
      includePostseason: postseasonRule.includePostseason,
    })
  }

  return resolveVariantForDifficulty(
    state.preferences.clueMode,
    state.preferences.themeId,
    state.preferences.eventId,
    state.preferences.difficulty,
    postseasonRule.includePostseason,
  )
}

function getPlayersForVariant(
  mode: GameMode,
  variant: GameVariant,
  difficultyId: DifficultyId,
): PlayerRecord[] {
  if (mode === 'daily') {
    return allPlayers
  }

  const filteredPlayers = getPlayablePlayerPool(allPlayers, variant, difficultyId)
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

function findLegacyDailySession(
  state: PersistedState,
  dateKey: string,
  playerIds: Set<number>,
): StoredGameSession | null {
  const matchingEntries = Object.entries(state.dailySessions)
    .filter(([sessionKey, session]) => sessionKey.startsWith(`${dateKey}:`) && playerIds.has(session.targetPlayerId))
    .toSorted((left, right) => {
      const leftSession = left[1]
      const rightSession = right[1]

      if (leftSession.status !== rightSession.status) {
        if (leftSession.status === 'in_progress') {
          return -1
        }

        if (rightSession.status === 'in_progress') {
          return 1
        }
      }

      return rightSession.guessIds.length - leftSession.guessIds.length
    })

  return matchingEntries[0]?.[1] ?? null
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
  const variant = resolveVariantFromState(state, dateKey)
  const players = getPlayersForVariant(state.preferences.mode, variant, difficultyId)
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

  if (state.preferences.mode === 'daily') {
    const legacySession = findLegacyDailySession(state, dateKey, playerIds)

    if (legacySession) {
      return {
        difficultyId,
        variant,
        players,
        sessionKey,
        session: legacySession,
      }
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

  const variant = resolveVariantFromState(state, dateKey)
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
      : sanitizeEventId(
          state.preferences.eventId,
          activeEventIds.filter(Boolean) as NonNullable<PersistedState['preferences']['eventId']>[],
        )
  const sanitizedClueMode = sanitizeClueModeForDifficulty(
    state.preferences.clueMode,
    state.preferences.difficulty,
  )
  const nextState =
    progressionState === state.progression &&
    sanitizedEventId === state.preferences.eventId &&
    sanitizedClueMode === state.preferences.clueMode
      ? state
      : {
          ...state,
          preferences: {
            ...state.preferences,
            clueMode: sanitizedClueMode,
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

  return replaceModeSession(preparedState, preparedState.preferences.mode, nextSession, sessionKey)
}

function findDailyCompletionEntry(state: PersistedState, dateKey: string) {
  return state.progression.dailyHistory.find((entry) => entry.dateKey === dateKey) ?? null
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
  const activeVariant = resolveVariantFromState(hydratedState, dailyDateKey)
  const activePlayers = getPlayersForVariant(
    hydratedState.preferences.mode,
    activeVariant,
    activeDifficultyId,
  )
  const activePostseasonRule = resolvePostseasonRule(
    hydratedState.preferences.mode,
    dailyDateKey,
    hydratedState.preferences.practiceIncludePostseason,
  )
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
  const standardGuessResults = guessedPlayers.map((player) =>
    compareGuess(player, activeTarget, dailyDateKey, activeDifficultyId),
  )
  const draftGuessResults = guessedPlayers.map((player) =>
    compareDraftGuess(player, activeTarget, activeDifficultyId),
  )
  const guessedIds = new Set(activeSession.guessIds)
  const lastGuessedPlayer = guessedPlayers.at(-1) ?? null
  const variantLocked =
    activeSession.status === 'in_progress' && activeSession.guessIds.length > 0
  const wrongGuessCount =
    activeSession.status === 'won'
      ? Math.max(activeSession.guessIds.length - 1, 0)
      : activeSession.guessIds.length
  const lastStandardGuess = standardGuessResults.at(-1) ?? null
  const blockedTeamId = getBlockedTeamIdForNextGuess({
    difficultyId: activeDifficultyId,
    lastGuessResult: lastStandardGuess,
    lastGuessedPlayer,
    status: activeSession.status,
  })
  const themeOptions = getThemeOptions(allPlayers)
  const dailyCompletionEntry = findDailyCompletionEntry(hydratedState, dailyDateKey)
  const dailyLockedOut =
    hydratedState.preferences.mode === 'daily' && dailyCompletionEntry !== null
  const canGuess =
    !dailyLockedOut &&
    activeSession.status === 'in_progress' &&
    activeSession.guessIds.length < activeDifficulty.maxGuesses
  const revealedBonusClues = getRevealedBonusClues(
    activeTarget,
    activeDifficultyId,
    wrongGuessCount,
    activeSession.revealedBonusClueIds,
  )
  const canRevealBonusClue =
    activeVariant.clueMode === 'standard' &&
    activeSession.status === 'in_progress' &&
    !dailyLockedOut &&
    canRevealManualBonusClue(
      activeTarget,
      activeDifficultyId,
      wrongGuessCount,
      activeSession.revealedBonusClueIds,
    )
  const closeGuessFeedback =
    activeVariant.clueMode === 'standard' &&
    activeDifficulty.ui.showCloseGuessFeedback &&
    lastStandardGuess &&
    !lastStandardGuess.isCorrect &&
    Object.values(lastStandardGuess.clues).some((clue) => clue.status === 'close')
      ? 'Close guess. One or more clues are within range.'
      : null
  const profileWarning =
    activeDifficulty.profileWarningAfterMisses !== null &&
    activeSession.status === 'in_progress' &&
    wrongGuessCount >= activeDifficulty.profileWarningAfterMisses
      ? 'Change the player profile. Repeating the same archetype will waste the board.'
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

      if (
        preparedState.preferences.mode === 'daily' &&
        findDailyCompletionEntry(preparedState, dailyDateKey)
      ) {
        return preparedState
      }

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
        const priorGuess = lastGuessId ? playerById.get(lastGuessId) : null
        const nextGuess = playerById.get(playerId)
        const target = playerById.get(session.targetPlayerId) ?? null

        if (
          shouldBlockConsecutiveSameTeamGuess({
            difficultyId,
            priorGuess: priorGuess ?? null,
            nextGuess: nextGuess ?? null,
            target,
            referenceDate: dailyDateKey,
          })
        ) {
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
          clueMode: variant.clueMode,
          themeId: variant.themeId,
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

      return {
        ...preparedState,
        preferences: {
          ...preparedState.preferences,
          clueMode: sanitizeClueModeForDifficulty(clueMode, preparedState.preferences.difficulty),
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
          clueMode: sanitizeClueModeForDifficulty(preparedState.preferences.clueMode, difficulty),
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

  function setPracticeIncludePostseason(includePostseason: boolean): void {
    setState((previousState) => {
      const preparedState = ensureHydratedState(
        previousState,
        dailyDateKey,
        now,
        timeZone,
        activeEventIds,
      )
      const { session } = resolveSession(preparedState, dailyDateKey)

      if (
        preparedState.preferences.mode === 'practice' &&
        session.status === 'in_progress' &&
        session.guessIds.length > 0
      ) {
        return preparedState
      }

      return {
        ...preparedState,
        preferences: {
          ...preparedState.preferences,
          practiceIncludePostseason: includePostseason,
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

  function setRetroThemeId(retroThemeId: PersistedState['settings']['retroThemeId']): void {
    setState((previousState) => {
      if (retroThemeId !== '2020s' && !previousState.profile.unlockedRetroThemeIds.includes(retroThemeId)) {
        return previousState
      }

      return {
        ...previousState,
        settings: {
          ...previousState.settings,
          retroThemeId,
        },
      }
    })
  }

  function unlockRetroTheme(retroThemeId: PersistedState['settings']['retroThemeId']): void {
    setState((previousState) => {
      if (previousState.profile.unlockedRetroThemeIds.includes(retroThemeId)) {
        return previousState
      }

      const theme = getRetroThemeDefinition(retroThemeId)

      if (previousState.profile.points < theme.cost) {
        return previousState
      }

      return {
        ...previousState,
        profile: {
          ...previousState.profile,
          points: previousState.profile.points - theme.cost,
          unlockedRetroThemeIds: [...previousState.profile.unlockedRetroThemeIds, retroThemeId],
        },
        settings: {
          ...previousState.settings,
          retroThemeId,
        },
      }
    })
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
      updateActiveSession(previousState, dailyDateKey, now, timeZone, activeEventIds, (session) => {
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
      }),
    )
  }

  function revealSilhouette(): void {
    setState((previousState) =>
      updateActiveSession(previousState, dailyDateKey, now, timeZone, activeEventIds, (session) => {
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
      }),
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
        const nextMode: GameMode = 'practice'
        const nextVariant = resolveVariantForDifficulty(
          preparedState.preferences.clueMode,
          preparedState.preferences.themeId,
          preparedState.preferences.eventId,
          difficultyId,
          preparedState.preferences.practiceIncludePostseason,
        )
        const players = getPlayersForVariant(nextMode, nextVariant, difficultyId)
        const nextTarget = pickPracticePlayer(players, [activeTarget.id])
        const nextSession = createSession(nextTarget.id)

        return {
          ...preparedState,
          preferences: {
            ...preparedState.preferences,
            mode: nextMode,
          },
          practiceSessions: {
            ...preparedState.practiceSessions,
            [getVariantSessionKey(nextVariant, difficultyId)]: nextSession,
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
    activeEventModes,
    activeMode: hydratedState.preferences.mode,
    activePlayerCount: activePlayers.length,
    activePostseasonRule,
    activeSession,
    activeTarget,
    activeThemeId: activeVariant.themeId,
    activeThemeSummary: formatThemeSummary(activeVariant.themeId),
    canGuess,
    canRevealBonusClue,
    canRevealSilhouette:
      !dailyLockedOut &&
      activeSession.status === 'in_progress' &&
      !activeSession.silhouetteRevealed &&
      activeDifficulty.image.silhouetteHint !== 'none',
    blockedTeamId,
    celebrations: hydratedState.progression.pendingCelebrations,
    claimQuest,
    closeGuessFeedback,
    dailyCompletionEntry,
    dailyDateKey,
    dailyLockedOut,
    dataMeta: playerPool,
    difficultyOptions: DIFFICULTY_DEFINITIONS,
    dismissCelebration: dismissCelebrationById,
    draftGuessResults,
    eventId: activeVariant.eventId,
    exportPayload: JSON.stringify(hydratedState, null, 2),
    guessResults: standardGuessResults,
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
    remainingGuesses: Math.max(activeDifficulty.maxGuesses - activeSession.guessIds.length, 0),
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
    setPracticeIncludePostseason,
    setTheme,
    setThemeId,
    setRetroThemeId,
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
      guesses:
        activeVariant.clueMode === 'draft'
          ? (draftGuessResults as never as typeof standardGuessResults)
          : standardGuessResults,
      guessCount: activeSession.guessIds.length,
      dateKey: dailyDateKey,
    }),
    showBonusClues:
      activeDifficulty.clueAvailability.bonusClues && activeVariant.clueMode === 'standard',
    showCareerPathOption: activeDifficulty.clueAvailability.careerPathMode,
    showDraftModeOption: activeDifficulty.clueAvailability.draftMode,
    showSeasonSnapshot:
      activeDifficulty.clueAvailability.seasonSnapshot && activeVariant.clueMode === 'standard',
    startPracticeGame,
    stats: hydratedState.stats,
    submitGuess,
    themeOptions,
    upcomingEventModes,
    unlockRetroTheme,
  }
}
