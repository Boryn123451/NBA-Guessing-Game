import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { enrichConfig } from '../config'
import { isFileFresh, readJsonFile, writeJsonFile } from '../cache'
import type { ProviderResult } from '../types'
import type { PlayerRecord } from '../../../src/lib/nba/types'

const TWO_K_RATINGS_IMAGE_BASE = 'https://www.2kratings.com/wp-content/uploads'
const PLAYER_IMAGE_PUBLIC_DIRECTORY = 'player-images'
let nextFallbackImageRequestAt = 0
let fallbackImageRequestCount = 0

function normalizeFilenamePart(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[â€™']/g, '')
    .replace(/\./g, '')
    .replace(/&/g, 'and')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function buildCandidates(player: PlayerRecord): string[] {
  const candidates = new Set<string>()
  const baseNames = [
    player.displayName,
    `${player.firstName} ${player.lastName}`.trim(),
    `${player.firstName} ${player.lastName.replace(/\b(Jr|Sr)\b/gi, '').trim()}`.trim(),
  ]

  for (const baseName of baseNames) {
    const normalizedName = normalizeFilenamePart(baseName)

    if (normalizedName) {
      candidates.add(`${TWO_K_RATINGS_IMAGE_BASE}/${normalizedName}-2K-Rating.png`)
    }
  }

  return [...candidates]
}

function buildLocalImageManifestPath(playerId: number): string {
  return `${PLAYER_IMAGE_PUBLIC_DIRECTORY}/${playerId}.png`
}

function buildLocalImagePath(playerId: number): string {
  return path.join(enrichConfig.playerImageDirectory, `${playerId}.png`)
}

function isLocalImageManifestPath(value: string | null | undefined): boolean {
  return Boolean(value && !/^https?:\/\//i.test(value))
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const fileStat = await stat(filePath)
    return fileStat.isFile() && fileStat.size > 0
  } catch {
    return false
  }
}

async function throttleFallbackImageRequest(): Promise<void> {
  const waitMs = Math.max(0, nextFallbackImageRequestAt - Date.now())

  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }

  fallbackImageRequestCount += 1
  const applyBatchCooldown =
    enrichConfig.fallbackImageBatchSize > 0 &&
    fallbackImageRequestCount % enrichConfig.fallbackImageBatchSize === 0
  nextFallbackImageRequestAt =
    Date.now() +
    (applyBatchCooldown
      ? enrichConfig.fallbackImageBatchCooldownMs
      : enrichConfig.fallbackImageMinDelayMs)
}

async function downloadImage(candidateUrl: string, playerId: number): Promise<string | null> {
  try {
    await throttleFallbackImageRequest()

    const response = await fetch(candidateUrl, {
      signal: AbortSignal.timeout(enrichConfig.httpTimeoutMs),
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    })

    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
      return null
    }

    await mkdir(enrichConfig.playerImageDirectory, { recursive: true })
    await writeFile(buildLocalImagePath(playerId), Buffer.from(await response.arrayBuffer()))
    return buildLocalImageManifestPath(playerId)
  } catch {
    return null
  }
}

export async function fetchFallbackImage(
  player: PlayerRecord,
  options: { forceDownload?: boolean } = {},
): Promise<ProviderResult | null> {
  const parsedCachePath = path.join(enrichConfig.parsedDirectory, 'fallback-image', `${player.id}.json`)
  const cachedParsed = await readJsonFile<ProviderResult>(parsedCachePath)
  const localImageManifestPath = buildLocalImageManifestPath(player.id)
  const localImagePath = buildLocalImagePath(player.id)
  const localImageExists = await fileExists(localImagePath)

  if (!options.forceDownload && localImageExists && await isFileFresh(localImagePath, enrichConfig.imageManifestMaxAgeMs)) {
    return {
      source: 'fallbackImage',
      transport: 'http',
      url: localImageManifestPath,
      fetchedAt: new Date().toISOString(),
      fromCache: true,
      imageFallbackUrl: localImageManifestPath,
    }
  }

  if (
    !options.forceDownload &&
    cachedParsed &&
    isLocalImageManifestPath(cachedParsed.imageFallbackUrl) &&
    localImageExists &&
    (await isFileFresh(parsedCachePath, enrichConfig.imageManifestMaxAgeMs))
  ) {
    return {
      ...cachedParsed,
      fromCache: true,
    }
  }

  for (const candidateUrl of buildCandidates(player)) {
    const localFallbackUrl = await downloadImage(candidateUrl, player.id)

    if (localFallbackUrl) {
      const result: ProviderResult = {
        source: 'fallbackImage',
        transport: 'http',
        url: candidateUrl,
        fetchedAt: new Date().toISOString(),
        fromCache: false,
        imageFallbackUrl: localFallbackUrl,
      }

      await writeJsonFile(parsedCachePath, result)
      return result
    }
  }

  const result: ProviderResult = {
    source: 'fallbackImage',
    transport: 'http',
    fetchedAt: new Date().toISOString(),
    fromCache: false,
    imageFallbackUrl: null,
  }

  await writeJsonFile(parsedCachePath, result)
  return result
}
