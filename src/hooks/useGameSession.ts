import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react'

import {
  loadCurrentPlayerPool,
  loadHistoricalPlayerPool,
} from '../lib/data/provider'
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
  ENTRY_DECADE_DEFINITIONS,
  getPlayerEntryDecadeId,
} from '../lib/nba/decades'
import { compareDraftGuess } from '../lib/nba/draftMode'
import {
  DIFFICULTY_DEFINITIONS,
  getDifficultyDefinition,
} from '../lib/nba/difficulty'
import { getActiveEventModes, getUpcomingEventModes, sanitizeEventId } from '../lib/nba/events'
import {
  getBlockedTeamIdForNextGuess,
  shouldBlockConsecutiveSameTeamGuess,
} from '../lib/nba/guessRules'
import { getHistoricPoolSummary } from '../lib/nba/historicFilters'
import { getPlayablePlayerPool } from '../lib/nba/pools'
import {
  DEFAULT_PLAYER_POOL_SCOPE_ID,
  getPlayerPoolScopeDefinition,
} from '../lib/nba/playerScopes'
import { resolvePostseasonRule, type PostseasonRule } from '../lib/nba/postseason'
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
  EntryDecadeId,
  GameMode,
  GameVariant,
  PersistedState,
  PlayerPoolData,
  PlayerPoolScopeId,
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

const currentPlayerPool = loadCurrentPlayerPool()
const currentPlayers = currentPlayerPool.players

type HistoryPoolStatus = 'loading' | 'ready' | 'error'

interface PlayerPoolScopeOption {
  id: PlayerPoolScopeId
  label: string
  description: string
  count: number | null
  disabled: boolean
}

interface EntryDecadeOption {
  id: EntryDecadeId | null
  label: string
  count: number
  disabled: boolean
}

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

function resolveRequestedPlayerPoolScope(
  mode: GameMode,
  requestedScope: PlayerPoolScopeId,
  historyReady: boolean,
): PlayerPoolScopeId {
  if (mode === 'daily') {
    return 'current'
  }

  return requestedScope === 'history' && historyReady ? 'history' : DEFAULT_PLAYER_POOL_SCOPE_ID
}

function resolveVariantForDifficulty(
  clueMode: ClueMode,
  themeId: PlayerThemeId,
  eventId: PersistedState['preferences']['eventId'],
  difficultyId: DifficultyId,
  includePostseason: boolean,
  playerPoolScope: PlayerPoolScopeId,
  entryDecadeId: EntryDecadeId | null,
): GameVariant {
  const normalizedClueMode = sanitizeClueModeForDifficulty(clueMode, difficultyId)

  if (playerPoolScope === 'history') {
    return normalizeVariant({
      playerPoolScope,
      clueMode: normalizedClueMode,
      themeId: 'classic',
      eventId: null,
      includePostseason: false,
      entryDecadeId,
    })
  }

  return normalizeVariant({
    playerPoolScope,
    clueMode: normalizedClueMode,
    themeId,
    eventId,
    includePostseason,
    entryDecadeId: null,
  })
}

function resolveVariantFromState(
  state: PersistedState,
  dateKey: string,
  historyReady: boolean,
): GameVariant {
  const postseasonRule = resolvePostseasonRule(
    state.preferences.mode,
    dateKey,
    state.preferences.practiceIncludePostseason,
  )
  const playerPoolScope = resolveRequestedPlayerPoolScope(
    state.preferences.mode,
    state.preferences.playerPoolScope,
    historyReady,
  )

  if (state.preferences.mode === 'daily') {
    return normalizeVariant({
      playerPoolScope: 'current',
      clueMode: sanitizeClueModeForDifficulty(
        state.preferences.clueMode,
        state.preferences.difficulty,
      ),
      themeId: 'classic',
      eventId: null,
      includePostseason: postseasonRule.includePostseason,
      entryDecadeId: null,
    })
  }

  return resolveVariantForDifficulty(
    state.preferences.clueMode,
    state.preferences.themeId,
    state.preferences.eventId,
    state.preferences.difficulty,
    postseasonRule.includePostseason,
    playerPoolScope,
    state.preferences.entryDecadeId,
  )
}

function getPlayersForVariant(
  mode: GameMode,
  variant: GameVariant,
  difficultyId: DifficultyId,
  historyPlayers: PlayerRecord[],
): PlayerRecord[] {
  const sourcePlayers =
    mode === 'daily' || variant.playerPoolScope === 'current'
      ? currentPlayers
      : historyPlayers

  if (mode === 'daily') {
    return currentPlayers
  }

  const filteredPlayers = getPlayablePlayerPool(sourcePlayers, variant, difficultyId)
  return filteredPlayers.length > 0 ? filteredPlayers : sourcePlayers
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
  const pool = players.length > 0 ? players : currentPlayers
  const target =
    mode === 'daily'
      ? pickDailyPlayer(pool, dateKey, variant)
      : pickPracticePlayer(pool, excludedPlayerIds)

  return createSession(target.id)
}

function findLegacyDailySession(
  state: PersistedState,
  dateKey: string,
  playerIds: Set<number>,
): StoredGameSession | null {
  const matchingEntries = Object.entries(state.dailySessions)
    .filter(
      ([sessionKey, session]) =>
        sessionKey.startsWith(`${dateKey}:`) && playerIds.has(session.targetPlayerId),
    )
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

function findDailyCompletionEntry(state: PersistedState, dateKey: string) {
  return state.progression.dailyHistory.find((entry) => entry.dateKey === dateKey) ?? null
}

function getHistoryPostseasonRule(): PostseasonRule {
  return {
    includePostseason: false,
    locked: true,
    label: 'History pool ignores postseason context',
    helpText:
      'All-time practice does not mix in current-season postseason filters or playoff snapshots.',
  }
}

export function useGameSession() {
  const [timeZone] = useState(() => getDetectedTimeZone())
  const [now, setNow] = useState(() => new Date())
  const dailyDateKey = getLeagueDateKey(now, timeZone)
  const [state, setState] = useState<PersistedState>(() => loadPersistedState())
  const [storageAvailable] = useState(() => isStorageAvailable())
  const [historyPoolState, setHistoryPoolState] = useState<{
    status: HistoryPoolStatus
    data: PlayerPoolData | null
  }>({
    status: 'loading',
    data: null,
  })

  const syncClock = useEffectEvent(() => {
    setNow(new Date())
  })

  useEffect(() => {
    const timer = window.setInterval(syncClock, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false

    loadHistoricalPlayerPool()
      .then((data) => {
        if (cancelled) {
          return
        }

        setHistoryPoolState({
          status: 'ready',
          data,
        })
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setHistoryPoolState({
          status: 'error',
          data: null,
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const historyReady = historyPoolState.status === 'ready' && historyPoolState.data !== null
  const historyPlayers = historyPoolState.data?.players ?? currentPlayers
  const playerById = useMemo(
    () =>
      new Map<number, PlayerRecord>(
        [...currentPlayers, ...(historyPoolState.data?.players ?? [])].map((player) => [
          player.id,
          player,
        ]),
      ),
    [historyPoolState.data],
  )

  function resolveSessionForState(stateValue: PersistedState): {
    difficultyId: DifficultyId
    variant: GameVariant
    players: PlayerRecord[]
    sessionKey: string
    session: StoredGameSession
  } {
    const difficultyId = stateValue.preferences.difficulty
    const variant = resolveVariantFromState(stateValue, dailyDateKey, historyReady)
    const players = getPlayersForVariant(
      stateValue.preferences.mode,
      variant,
      difficultyId,
      historyPlayers,
    )
    const sessionKey = getSessionKey(stateValue.preferences.mode, dailyDateKey, variant, difficultyId)
    const storedSession = getStoredSession(stateValue, stateValue.preferences.mode, sessionKey)
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

    if (stateValue.preferences.mode === 'daily') {
      const legacySession = findLegacyDailySession(stateValue, dailyDateKey, playerIds)

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
      session: createVariantSession(
        stateValue.preferences.mode,
        dailyDateKey,
        variant,
        players,
      ),
    }
  }

  function shouldKeepInactiveEventSelection(stateValue: PersistedState): boolean {
    if (!stateValue.preferences.eventId || stateValue.preferences.playerPoolScope === 'history') {
      return false
    }

    const variant = resolveVariantFromState(stateValue, dailyDateKey, historyReady)
    const sessionKey = getSessionKey(
      stateValue.preferences.mode,
      dailyDateKey,
      variant,
      stateValue.preferences.difficulty,
    )
    const session = getStoredSession(stateValue, stateValue.preferences.mode, sessionKey)

    return Boolean(session && session.status === 'in_progress' && session.guessIds.length > 0)
  }

  const activeEventModes = useMemo(
    () => getActiveEventModes(currentPlayers, now, timeZone),
    [now, timeZone],
  )
  const upcomingEventModes = useMemo(
    () => getUpcomingEventModes(currentPlayers, now, timeZone),
    [now, timeZone],
  )
  const activeEventIds = activeEventModes.map((eventMode) => eventMode.id)

  function ensureHydratedStateLocal(stateValue: PersistedState): PersistedState {
    const progressionState = ensureProgressionState(stateValue.progression, now, timeZone)
    const keepInactiveEvent = shouldKeepInactiveEventSelection({
      ...stateValue,
      progression: progressionState,
    })
    const scopeForMode =
      stateValue.preferences.mode === 'daily'
        ? 'current'
        : stateValue.preferences.playerPoolScope
    const sanitizedEventId =
      scopeForMode === 'history'
        ? null
        : (stateValue.preferences.eventId !== null &&
            activeEventIds.includes(stateValue.preferences.eventId)) ||
          keepInactiveEvent
          ? stateValue.preferences.eventId
          : sanitizeEventId(
              stateValue.preferences.eventId,
              activeEventIds.filter(Boolean) as NonNullable<
                PersistedState['preferences']['eventId']
              >[],
            )
    const sanitizedClueMode = sanitizeClueModeForDifficulty(
      stateValue.preferences.clueMode,
      stateValue.preferences.difficulty,
    )
    const sanitizedThemeId = scopeForMode === 'history' ? 'classic' : stateValue.preferences.themeId
    const sanitizedScope = stateValue.preferences.mode === 'daily' ? 'current' : scopeForMode
    const sanitizedEntryDecadeId = stateValue.preferences.entryDecadeId
    const nextState =
      progressionState === stateValue.progression &&
      sanitizedEventId === stateValue.preferences.eventId &&
      sanitizedClueMode === stateValue.preferences.clueMode &&
      sanitizedThemeId === stateValue.preferences.themeId &&
      sanitizedScope === stateValue.preferences.playerPoolScope &&
      sanitizedEntryDecadeId === stateValue.preferences.entryDecadeId
        ? stateValue
        : {
            ...stateValue,
            preferences: {
              ...stateValue.preferences,
              playerPoolScope: sanitizedScope,
              clueMode: sanitizedClueMode,
              themeId: sanitizedThemeId,
              eventId: sanitizedEventId,
              entryDecadeId: sanitizedEntryDecadeId,
            },
            progression: progressionState,
          }
    const { session, sessionKey } = resolveSessionForState(nextState)
    const storedSession = getStoredSession(nextState, nextState.preferences.mode, sessionKey)

    if (storedSession && storedSession.targetPlayerId === session.targetPlayerId) {
      return nextState
    }

    return replaceModeSession(nextState, nextState.preferences.mode, session, sessionKey)
  }

  function updateActiveSessionLocal(
    stateValue: PersistedState,
    mutate: (session: StoredGameSession) => StoredGameSession | null,
  ): PersistedState {
    const preparedState = ensureHydratedStateLocal(stateValue)
    const { session, sessionKey } = resolveSessionForState(preparedState)
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

  const hydratedState = ensureHydratedStateLocal(state)

  useEffect(() => {
    savePersistedState(hydratedState)
  }, [hydratedState])

  const activeDifficultyId = hydratedState.preferences.difficulty
  const activeDifficulty = getDifficultyDefinition(activeDifficultyId)
  const activeVariant = resolveVariantFromState(hydratedState, dailyDateKey, historyReady)
  const activePlayers = getPlayersForVariant(
    hydratedState.preferences.mode,
    activeVariant,
    activeDifficultyId,
    historyPlayers,
  )
  const activePostseasonRule =
    activeVariant.playerPoolScope === 'history'
      ? getHistoryPostseasonRule()
      : resolvePostseasonRule(
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
  const activeTarget =
    playerById.get(activeSession.targetPlayerId) ?? activePlayers[0] ?? currentPlayers[0]
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
  const themeOptions = getThemeOptions(currentPlayers)
  const dailyCompletionEntry = findDailyCompletionEntry(hydratedState, dailyDateKey)
  const dailyLockedOut =
    hydratedState.preferences.mode === 'daily' && dailyCompletionEntry !== null
  const canGuess =
    !dailyLockedOut &&
    activeSession.status === 'in_progress' &&
    activePlayers.length > 0 &&
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
  const playerPoolScopeOptions: PlayerPoolScopeOption[] = [
    {
      id: 'current',
      label: getPlayerPoolScopeDefinition('current').label,
      description: getPlayerPoolScopeDefinition('current').description,
      count: currentPlayers.length,
      disabled: false,
    },
    {
      id: 'history',
      label: getPlayerPoolScopeDefinition('history').label,
      description:
        historyPoolState.status === 'ready'
          ? getHistoricPoolSummary(activeDifficultyId)
          : historyPoolState.status === 'error'
            ? 'All-time data failed to load in this session.'
            : 'Loading the all-time player pool.',
      count: historyPoolState.data?.players.length ?? null,
      disabled: historyPoolState.status !== 'ready',
    },
  ]
  const historyBaseVariant =
    activeVariant.playerPoolScope === 'history'
      ? { ...activeVariant, entryDecadeId: null }
      : null
  const historyBasePlayers =
    historyBaseVariant && historyPoolState.data
      ? getPlayablePlayerPool(historyPoolState.data.players, historyBaseVariant, activeDifficultyId)
      : []
  const entryDecadeOptions: EntryDecadeOption[] = [
    {
      id: null,
      label: 'All eras',
      count: historyBasePlayers.length,
      disabled: false,
    },
    ...ENTRY_DECADE_DEFINITIONS.map((definition) => {
      const count = historyBasePlayers.filter(
        (player) => getPlayerEntryDecadeId(player) === definition.id,
      ).length

      return {
        id: definition.id,
        label: definition.label,
        count,
        disabled: count === 0,
      }
    }),
  ]
  const activeDataMeta =
    activeVariant.playerPoolScope === 'history' && historyPoolState.data
      ? historyPoolState.data
      : currentPlayerPool

  function submitGuess(playerId: number): void {
    setState((previousState) => {
      const preparedState = ensureHydratedStateLocal(previousState)

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
      } = resolveSessionForState(preparedState)
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
          entryDecadeId: variant.entryDecadeId,
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

  function setPlayerPoolScope(playerPoolScope: PlayerPoolScopeId): void {
    if (playerPoolScope === 'history' && historyPoolState.status !== 'ready') {
      return
    }

    setState((previousState) => {
      const preparedState = ensureHydratedStateLocal(previousState)
      const { session } = resolveSessionForState(preparedState)

      if (session.status === 'in_progress' && session.guessIds.length > 0) {
        return preparedState
      }

      return {
        ...preparedState,
        preferences: {
          ...preparedState.preferences,
          playerPoolScope,
          themeId: playerPoolScope === 'history' ? 'classic' : preparedState.preferences.themeId,
          eventId: playerPoolScope === 'history' ? null : preparedState.preferences.eventId,
          entryDecadeId: preparedState.preferences.entryDecadeId,
        },
      }
    })
  }

  function setEntryDecadeId(entryDecadeId: EntryDecadeId | null): void {
    setState((previousState) => {
      const preparedState = ensureHydratedStateLocal(previousState)
      const { session } = resolveSessionForState(preparedState)

      if (
        preparedState.preferences.mode !== 'practice' ||
        preparedState.preferences.playerPoolScope !== 'history' ||
        (session.status === 'in_progress' && session.guessIds.length > 0)
      ) {
        return preparedState
      }

      return {
        ...preparedState,
        preferences: {
          ...preparedState.preferences,
          entryDecadeId,
        },
      }
    })
  }

  function setClueMode(clueMode: ClueMode): void {
    setState((previousState) => {
      const preparedState = ensureHydratedStateLocal(previousState)
      const { session } = resolveSessionForState(preparedState)

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
      const preparedState = ensureHydratedStateLocal(previousState)
      const { session } = resolveSessionForState(preparedState)

      if (
        preparedState.preferences.playerPoolScope === 'history' ||
        (session.status === 'in_progress' && session.guessIds.length > 0)
      ) {
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
      const preparedState = ensureHydratedStateLocal(previousState)
      const { session } = resolveSessionForState(preparedState)
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
      const preparedState = ensureHydratedStateLocal(previousState)
      const { session } = resolveSessionForState(preparedState)

      if (
        preparedState.preferences.playerPoolScope === 'history' ||
        (session.status === 'in_progress' && session.guessIds.length > 0)
      ) {
        return preparedState
      }

      return {
        ...preparedState,
        preferences: {
          ...preparedState.preferences,
          eventId: sanitizeEventId(
            eventId,
            activeEventIds.filter(Boolean) as NonNullable<
              PersistedState['preferences']['eventId']
            >[],
          ),
        },
      }
    })
  }

  function setPracticeIncludePostseason(includePostseason: boolean): void {
    setState((previousState) => {
      const preparedState = ensureHydratedStateLocal(previousState)
      const { session } = resolveSessionForState(preparedState)

      if (
        preparedState.preferences.playerPoolScope === 'history' ||
        (preparedState.preferences.mode === 'practice' &&
          session.status === 'in_progress' &&
          session.guessIds.length > 0)
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
      if (
        retroThemeId !== '2020s' &&
        !previousState.profile.unlockedRetroThemeIds.includes(retroThemeId)
      ) {
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
          unlockedRetroThemeIds: [
            ...previousState.profile.unlockedRetroThemeIds,
            retroThemeId,
          ],
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
      updateActiveSessionLocal(previousState, (session) => {
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
      updateActiveSessionLocal(previousState, (session) => {
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
        const preparedState = ensureHydratedStateLocal(previousState)
        const difficultyId = preparedState.preferences.difficulty
        const nextMode: GameMode = 'practice'
        const nextVariant = resolveVariantForDifficulty(
          preparedState.preferences.clueMode,
          preparedState.preferences.themeId,
          preparedState.preferences.eventId,
          difficultyId,
          preparedState.preferences.practiceIncludePostseason,
          resolveRequestedPlayerPoolScope(
            nextMode,
            preparedState.preferences.playerPoolScope,
            historyReady,
          ),
          preparedState.preferences.entryDecadeId,
        )
        const players = getPlayersForVariant(
          nextMode,
          nextVariant,
          difficultyId,
          historyPlayers,
        )
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
    activeDataMeta,
    activeDifficulty,
    activeDifficultyId,
    activeEventModes,
    activeMode: hydratedState.preferences.mode,
    activePlayerCount: activePlayers.length,
    activePlayerPoolScope: activeVariant.playerPoolScope,
    activePlayerPoolScopeSummary:
      activeVariant.playerPoolScope === 'history'
        ? `${activeVariant.entryDecadeId ?? 'All eras'} | ${getHistoricPoolSummary(activeDifficultyId)}`
        : formatThemeSummary(activeVariant.themeId),
    activePostseasonRule,
    activeSession,
    activeTarget,
    activeThemeId: activeVariant.themeId,
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
    dataMeta: activeDataMeta,
    difficultyOptions: DIFFICULTY_DEFINITIONS,
    dismissCelebration: dismissCelebrationById,
    draftGuessResults,
    entryDecadeId: activeVariant.entryDecadeId,
    entryDecadeOptions,
    eventId: activeVariant.eventId,
    exportPayload: JSON.stringify(hydratedState, null, 2),
    guessResults: standardGuessResults,
    guessedIds,
    guessedPlayers,
    importProfileData,
    isHistoryPoolReady: historyReady,
    isStorageAvailable: storageAvailable,
    maxGuesses: activeDifficulty.maxGuesses,
    nextWeeklyResetCountdown: formatCountdown(weeklyResetCountdown),
    playerPoolScopeOptions,
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
    setEntryDecadeId,
    setEventId,
    setMode,
    setPlayerPoolScope,
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
      playerPoolScope: activeVariant.playerPoolScope,
      entryDecadeId: activeVariant.entryDecadeId,
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
    showEventModes:
      hydratedState.preferences.mode === 'practice' && activeVariant.playerPoolScope === 'current',
    showPracticePostseasonToggle:
      hydratedState.preferences.mode === 'practice' && activeVariant.playerPoolScope === 'current',
    showEntryDecadeFilter:
      hydratedState.preferences.mode === 'practice' && activeVariant.playerPoolScope === 'history',
    showSeasonSnapshot:
      activeDifficulty.clueAvailability.seasonSnapshot &&
      activeVariant.clueMode === 'standard' &&
      activeVariant.playerPoolScope === 'current',
    showThemeFilters:
      hydratedState.preferences.mode === 'practice' && activeVariant.playerPoolScope === 'current',
    startPracticeGame,
    stats: hydratedState.stats,
    submitGuess,
    themeOptions,
    upcomingEventModes,
    unlockRetroTheme,
  }
}
