import path from 'node:path'

import { enrichConfig } from '../config'
import { isFileFresh, readJsonFile, writeJsonFile } from '../cache'
import type { ProviderResult } from '../types'
import type { PlayerRecord } from '../../../src/lib/nba/types'

const TWO_K_RATINGS_IMAGE_BASE = 'https://www.2kratings.com/wp-content/uploads'
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

async function headExists(url: string): Promise<boolean> {
  try {
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

    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(enrichConfig.httpTimeoutMs),
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    })

    return response.ok
  } catch {
    return false
  }
}

export async function fetchFallbackImage(player: PlayerRecord): Promise<ProviderResult | null> {
  const parsedCachePath = path.join(enrichConfig.parsedDirectory, 'fallback-image', `${player.id}.json`)
  const cachedParsed = await readJsonFile<ProviderResult>(parsedCachePath)

  if (cachedParsed && (await isFileFresh(parsedCachePath, enrichConfig.imageManifestMaxAgeMs))) {
    return {
      ...cachedParsed,
      fromCache: true,
    }
  }

  for (const candidateUrl of buildCandidates(player)) {
    if (await headExists(candidateUrl)) {
      const result: ProviderResult = {
        source: 'fallbackImage',
        transport: 'http',
        url: candidateUrl,
        fetchedAt: new Date().toISOString(),
        fromCache: false,
        imageFallbackUrl: candidateUrl,
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
