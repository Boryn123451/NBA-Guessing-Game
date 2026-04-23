import type { PlayerImageFallbackManifest, PlayerPoolData, PlayerRecord } from '../../src/lib/nba/types'
import { normalizeBirthDateValue } from '../../src/lib/nba/age'
import { enrichConfig } from './config'
import { readJsonFile, writeJsonFile } from './cache'
import type { EnrichmentField, LoadedPools } from './types'

export async function loadPools(): Promise<LoadedPools> {
  const current = await readJsonFile<PlayerPoolData>(enrichConfig.currentPoolPath)
  const history = await readJsonFile<PlayerPoolData>(enrichConfig.historyPoolPath)

  return {
    current,
    history,
    currentPlayers: current?.players ?? [],
    historyPlayers: history?.players ?? [],
  }
}

export async function loadImageManifest(): Promise<PlayerImageFallbackManifest | null> {
  return readJsonFile<PlayerImageFallbackManifest>(enrichConfig.imageManifestPath)
}

export function getMergedPlayers(pools: LoadedPools): PlayerRecord[] {
  const byId = new Map<number, PlayerRecord>()

  for (const player of [...pools.currentPlayers, ...pools.historyPlayers]) {
    if (!byId.has(player.id)) {
      byId.set(player.id, player)
    }
  }

  return [...byId.values()]
}

export function getMissingFields(
  player: PlayerRecord,
  imageManifest: PlayerImageFallbackManifest | null,
): EnrichmentField[] {
  const missingFields: EnrichmentField[] = []

  if (!normalizeBirthDateValue(player.birthDate)) {
    missingFields.push('birthDate')
  }

  if (player.entryDraftYear === null) {
    missingFields.push('entryDraftYear')
  }

  if (player.isCurrentPlayer && !imageManifest?.fallbacks?.[`${player.id}`]) {
    missingFields.push('imageFallback')
  }

  return missingFields
}

export async function writePools(
  current: PlayerPoolData | null,
  history: PlayerPoolData | null,
): Promise<void> {
  if (current) {
    await writeJsonFile(enrichConfig.currentPoolPath, current)
  }

  if (history) {
    await writeJsonFile(enrichConfig.historyPoolPath, history)
  }
}

export async function writeImageManifest(manifest: PlayerImageFallbackManifest): Promise<void> {
  await writeJsonFile(enrichConfig.imageManifestPath, manifest)
}

export function updatePlayerRecords(
  players: PlayerRecord[],
  updatedById: Map<number, PlayerRecord>,
): PlayerRecord[] {
  return players.map((player) => updatedById.get(player.id) ?? player)
}
