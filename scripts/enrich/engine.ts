import type { PlayerImageFallbackManifest, PlayerRecord } from '../../src/lib/nba/types'
import { normalizePlayerAge } from '../../src/lib/nba/age'
import { enrichConfig } from './config'
import { createProgressTracker, mapWithConcurrency, writeJsonFile } from './cache'
import { loadImageManifest, loadPools, getMergedPlayers, getMissingFields, updatePlayerRecords, writeImageManifest, writePools } from './players'
import { fetchBasketballReferenceProfile } from './providers/basketballReference'
import { fetchFallbackImage } from './providers/fallbackImage'
import { fetchNbaCommonPlayerInfo } from './providers/nba'
import { createEmptyPlayerState, finalizeStatus, readStatusFile, writeStatusFile } from './status'
import type {
  EnrichmentField,
  EnrichmentMode,
  EnrichmentReport,
  EnrichmentSource,
  EnrichmentStatusFile,
  PlayerEnrichmentState,
  ProviderResult,
} from './types'

function shouldProcessPlayer(
  mode: EnrichmentMode,
  player: PlayerRecord,
  state: PlayerEnrichmentState,
  imageManifest: PlayerImageFallbackManifest | null,
): boolean {
  const missingFields = getMissingFields(player, imageManifest)

  if (mode === 'full') {
    return true
  }

  if (mode === 'repair-missing') {
    return missingFields.length > 0
  }

  return missingFields.length > 0 || state.status === 'failed_last_attempt' || state.status === 'partial'
}

function shouldUseNbaPrimary(
  player: PlayerRecord,
  state: PlayerEnrichmentState,
  missingFields: EnrichmentField[],
): boolean {
  const needsCoreBio =
    missingFields.includes('birthDate') || missingFields.includes('entryDraftYear')

  if (!needsCoreBio) {
    return false
  }

  if (player.isCurrentPlayer) {
    return true
  }

  return (
    state.sourceStates.nba.lastSuccessAt !== null ||
    state.fieldSources.birthDate === 'nba' ||
    state.fieldSources.entryDraftYear === 'nba'
  )
}

function mergeProviderResult(
  player: PlayerRecord,
  result: ProviderResult,
  referenceDate: string,
): PlayerRecord {
  const birthDate = result.birthDate ?? player.birthDate
  const entryDraftYear = result.entryDraftYear ?? player.entryDraftYear
  const nextPlayer: PlayerRecord = {
    ...player,
    birthDate,
    currentAge: normalizePlayerAge(birthDate, player.currentAge, referenceDate),
    entryDraftYear,
    entryDraftYearSource:
      result.entryDraftYear !== undefined
        ? result.entryDraftYearSource ?? player.entryDraftYearSource
        : player.entryDraftYearSource,
  }

  return nextPlayer
}

function markSourceSuccess(
  state: PlayerEnrichmentState,
  result: ProviderResult,
  previousPlayer: PlayerRecord,
  nextPlayer: PlayerRecord,
): void {
  state.sourceStates[result.source].lastAttemptAt = result.fetchedAt
  state.sourceStates[result.source].lastSuccessAt = result.fetchedAt
  state.sourceStates[result.source].lastFailureAt = null
  state.sourceStates[result.source].lastFailureMessage = null
  state.sourceStates[result.source].lastUrl = result.url ?? null
  state.sourceStates[result.source].transport = result.transport

  if (result.birthDate && !previousPlayer.birthDate && nextPlayer.birthDate) {
    state.fieldSources.birthDate = result.source
  }

  if (
    result.entryDraftYear !== undefined &&
    previousPlayer.entryDraftYear === null &&
    nextPlayer.entryDraftYear !== null
  ) {
    state.fieldSources.entryDraftYear = result.source
  }
}

function markSourceFailure(
  state: PlayerEnrichmentState,
  source: EnrichmentSource,
  error: unknown,
  url: string | null = null,
): void {
  const message = error instanceof Error ? error.message : String(error)
  const now = new Date().toISOString()
  state.sourceStates[source].lastAttemptAt = now
  state.sourceStates[source].lastFailureAt = now
  state.sourceStates[source].lastFailureMessage = message
  state.sourceStates[source].lastUrl = url
}

function updateImageManifest(
  imageManifest: PlayerImageFallbackManifest | null,
  playerId: number,
  imageUrl: string,
  generatedAt: string,
): PlayerImageFallbackManifest {
  return {
    schemaVersion: 1,
    generatedAt,
    source: imageManifest?.source ?? '2KRatings static image fallback manifest',
    fallbacks: {
      ...(imageManifest?.fallbacks ?? {}),
      [`${playerId}`]: imageUrl,
    },
  }
}

function buildReport(
  players: PlayerRecord[],
  imageManifest: PlayerImageFallbackManifest | null,
  statusFile: EnrichmentStatusFile,
): EnrichmentReport {
  const missingFieldCounts: Record<EnrichmentField, number> = {
    birthDate: 0,
    entryDraftYear: 0,
    imageFallback: 0,
  }
  let completePlayers = 0
  let partialPlayers = 0
  let unresolvedPlayers = 0
  let nba = 0
  let basketballReferenceHttp = 0
  let basketballReferencePlaywright = 0
  let fallbackImages = 0
  const failures: EnrichmentReport['failures'] = []

  for (const player of players) {
    const state = statusFile.players[`${player.id}`] ?? createEmptyPlayerState(player.id)
    const missingFields = getMissingFields(player, imageManifest)

    if (missingFields.length === 0) {
      completePlayers += 1
    } else if (missingFields.length < 3) {
      partialPlayers += 1
    } else {
      unresolvedPlayers += 1
    }

    for (const field of missingFields) {
      missingFieldCounts[field] += 1
    }

    if (state.fieldSources.birthDate === 'nba' || state.fieldSources.entryDraftYear === 'nba') {
      nba += 1
    }

    if (
      state.fieldSources.birthDate === 'basketballReference' ||
      state.fieldSources.entryDraftYear === 'basketballReference'
    ) {
      if (state.sourceStates.basketballReference.transport === 'playwright') {
        basketballReferencePlaywright += 1
      } else {
        basketballReferenceHttp += 1
      }
    }

    if (state.fieldSources.imageFallback === 'fallbackImage') {
      fallbackImages += 1
    }

    for (const [source, sourceState] of Object.entries(state.sourceStates) as Array<
      [EnrichmentSource, PlayerEnrichmentState['sourceStates'][EnrichmentSource]]
    >) {
      if (sourceState.lastFailureAt) {
        failures.push({
          playerId: player.id,
          source,
          url: sourceState.lastUrl,
          reason: sourceState.lastFailureMessage,
        })
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    completePlayers,
    partialPlayers,
    unresolvedPlayers,
    missingFieldCounts,
    scrapings: {
      nba,
      basketballReferenceHttp,
      basketballReferencePlaywright,
      fallbackImages,
    },
    failures,
  }
}

export async function runEnrichment(mode: EnrichmentMode): Promise<EnrichmentReport> {
  const pools = await loadPools()

  if (!pools.current && !pools.history) {
    throw new Error('Generated player pools are missing. Run the data refresh first.')
  }

  let imageManifest = await loadImageManifest()
  const existingStatus = await readStatusFile(enrichConfig.statusPath)
  const statusFile: EnrichmentStatusFile = existingStatus ?? {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    players: {},
  }
  const mergedPlayers = getMergedPlayers(pools)
  const updatedById = new Map<number, PlayerRecord>(mergedPlayers.map((player) => [player.id, player]))
  const referenceDate = pools.current?.asOfDate ?? pools.history?.asOfDate ?? new Date().toISOString().slice(0, 10)
  const selectedPlayers = mergedPlayers.filter((player) => {
    const state = statusFile.players[`${player.id}`] ?? createEmptyPlayerState(player.id)
    return shouldProcessPlayer(mode, player, state, imageManifest)
  })
  console.log(`Mode: ${mode}. Selected ${selectedPlayers.length} player records.`)

  const bioCandidates = selectedPlayers.filter((player) => {
    const state = statusFile.players[`${player.id}`] ?? createEmptyPlayerState(player.id)
    const missingFields = getMissingFields(player, imageManifest)
    return shouldUseNbaPrimary(player, state, missingFields)
  })
  const nbaProgress = createProgressTracker('NBA bio', bioCandidates.length, {
    initialMsPerItem: 900,
  })

  await mapWithConcurrency(bioCandidates, enrichConfig.nbaConcurrency, async (player) => {
    const state = statusFile.players[`${player.id}`] ?? createEmptyPlayerState(player.id)
    statusFile.players[`${player.id}`] = state

    try {
      const result = await fetchNbaCommonPlayerInfo(player.id)

      if (!result) {
        return
      }

      const previousPlayer = updatedById.get(player.id) ?? player
      const nextPlayer = mergeProviderResult(previousPlayer, result, referenceDate)
      updatedById.set(player.id, nextPlayer)
      markSourceSuccess(state, result, previousPlayer, nextPlayer)
    } catch (error) {
      markSourceFailure(state, 'nba', error)
    } finally {
      nbaProgress.tick()
    }
  })
  nbaProgress.finish()

  const basketballReferenceHttpCandidates = selectedPlayers.filter((player) => {
    const nextPlayer = updatedById.get(player.id) ?? player
    const missingFields = getMissingFields(nextPlayer, imageManifest)
    return missingFields.includes('birthDate') || missingFields.includes('entryDraftYear')
  })
  const basketballReferenceHttpProgress = createProgressTracker(
    'Basketball-Reference HTTP',
    basketballReferenceHttpCandidates.length,
    {
      initialMsPerItem: 4200,
    },
  )

  await mapWithConcurrency(
    basketballReferenceHttpCandidates,
    enrichConfig.basketballReferenceConcurrency,
    async (player) => {
      const state = statusFile.players[`${player.id}`] ?? createEmptyPlayerState(player.id)
      statusFile.players[`${player.id}`] = state

      try {
        const result = await fetchBasketballReferenceProfile(player.id, player.displayName, 'http')

        if (!result) {
          return
        }

        const previousPlayer = updatedById.get(player.id) ?? player
        const nextPlayer = mergeProviderResult(previousPlayer, result, referenceDate)
        updatedById.set(player.id, nextPlayer)
        markSourceSuccess(state, result, previousPlayer, nextPlayer)
      } catch (error) {
        markSourceFailure(state, 'basketballReference', error)
      } finally {
        basketballReferenceHttpProgress.tick()
      }
    },
  )
  basketballReferenceHttpProgress.finish()

  if (mode === 'repair-playwright') {
    const playwrightCandidates = selectedPlayers.filter((player) => {
      const nextPlayer = updatedById.get(player.id) ?? player
      const missingFields = getMissingFields(nextPlayer, imageManifest)
      return missingFields.includes('birthDate') || missingFields.includes('entryDraftYear')
    })
    const playwrightProgress = createProgressTracker(
      'Basketball-Reference Playwright',
      playwrightCandidates.length,
      {
        initialMsPerItem: 9000,
      },
    )

    await mapWithConcurrency(playwrightCandidates, enrichConfig.playwrightConcurrency, async (player) => {
      const state = statusFile.players[`${player.id}`] ?? createEmptyPlayerState(player.id)
      statusFile.players[`${player.id}`] = state

      try {
        const result = await fetchBasketballReferenceProfile(player.id, player.displayName, 'playwright')

        if (!result) {
          return
        }

        const previousPlayer = updatedById.get(player.id) ?? player
        const nextPlayer = mergeProviderResult(previousPlayer, result, referenceDate)
        updatedById.set(player.id, nextPlayer)
        markSourceSuccess(state, result, previousPlayer, nextPlayer)
      } catch (error) {
        markSourceFailure(state, 'basketballReference', error)
      } finally {
        playwrightProgress.tick()
      }
    })
    playwrightProgress.finish()
  }

  const imageCandidates = selectedPlayers.filter((player) => {
    const nextPlayer = updatedById.get(player.id) ?? player
    return nextPlayer.isCurrentPlayer && getMissingFields(nextPlayer, imageManifest).includes('imageFallback')
  })
  const imageProgress = createProgressTracker('Fallback images', imageCandidates.length, {
    initialMsPerItem: 180,
  })

  await mapWithConcurrency(imageCandidates, enrichConfig.fallbackImageConcurrency, async (player) => {
    const state = statusFile.players[`${player.id}`] ?? createEmptyPlayerState(player.id)
    statusFile.players[`${player.id}`] = state

    try {
      const result = await fetchFallbackImage(player)

      if (!result?.imageFallbackUrl) {
        return
      }

      imageManifest = updateImageManifest(imageManifest, player.id, result.imageFallbackUrl, result.fetchedAt)
      state.sourceStates.fallbackImage.lastAttemptAt = result.fetchedAt
      state.sourceStates.fallbackImage.lastSuccessAt = result.fetchedAt
      state.sourceStates.fallbackImage.lastFailureAt = null
      state.sourceStates.fallbackImage.lastFailureMessage = null
      state.sourceStates.fallbackImage.lastUrl = result.imageFallbackUrl
      state.sourceStates.fallbackImage.transport = 'http'
      state.fieldSources.imageFallback = 'fallbackImage'
    } catch (error) {
      markSourceFailure(state, 'fallbackImage', error)
    } finally {
      imageProgress.tick()
    }
  })
  imageProgress.finish()

  for (const player of mergedPlayers) {
    const nextPlayer = updatedById.get(player.id) ?? player
    const state = statusFile.players[`${player.id}`] ?? createEmptyPlayerState(player.id)
    statusFile.players[`${player.id}`] = finalizeStatus(state, getMissingFields(nextPlayer, imageManifest))
  }

  const nextCurrentPool = pools.current
    ? {
        ...pools.current,
        players: updatePlayerRecords(pools.current.players, updatedById),
      }
    : null
  const nextHistoryPool = pools.history
    ? {
        ...pools.history,
        players: updatePlayerRecords(pools.history.players, updatedById),
      }
    : null

  if (nextCurrentPool || nextHistoryPool) {
    await writePools(nextCurrentPool, nextHistoryPool)
  }

  if (imageManifest) {
    await writeImageManifest(imageManifest)
  }

  statusFile.updatedAt = new Date().toISOString()
  await writeStatusFile(enrichConfig.statusPath, statusFile)

  const nextMergedPlayers = getMergedPlayers({
    current: nextCurrentPool,
    history: nextHistoryPool,
    currentPlayers: nextCurrentPool?.players ?? [],
    historyPlayers: nextHistoryPool?.players ?? [],
  })
  const report = buildReport(nextMergedPlayers, imageManifest, statusFile)
  await writeJsonFile(enrichConfig.reportPath, report)
  return report
}
