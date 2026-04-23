import path from 'node:path'
import { fileURLToPath } from 'node:url'

function resolvePositiveInteger(name: string, fallback: number): number {
  const rawValue = process.env[name]
  const parsedValue = rawValue ? Number(rawValue) : Number.NaN

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback
  }

  return Math.trunc(parsedValue)
}

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const scriptsDirectory = path.resolve(currentDirectory, '..')

export const enrichConfig = {
  scriptsDirectory,
  generatedDirectory: path.resolve(scriptsDirectory, '../src/data/generated'),
  currentPoolPath: path.resolve(scriptsDirectory, '../src/data/generated/player-pool.json'),
  historyPoolPath: path.resolve(scriptsDirectory, '../src/data/generated/history-player-pool.json'),
  imageManifestPath: path.resolve(scriptsDirectory, '../src/data/generated/player-image-fallbacks.json'),
  cacheDirectory: path.resolve(scriptsDirectory, '.cache/enrich'),
  rawDirectory: path.resolve(scriptsDirectory, '.cache/enrich/raw'),
  parsedDirectory: path.resolve(scriptsDirectory, '.cache/enrich/parsed'),
  statusPath: path.resolve(scriptsDirectory, '.cache/enrich/status.json'),
  reportPath: path.resolve(scriptsDirectory, '.cache/enrich/report.json'),
  nbaConcurrency: resolvePositiveInteger('ENRICH_NBA_CONCURRENCY', 4),
  basketballReferenceConcurrency: resolvePositiveInteger('ENRICH_BR_CONCURRENCY', 1),
  playwrightConcurrency: resolvePositiveInteger('ENRICH_PLAYWRIGHT_CONCURRENCY', 1),
  fallbackImageConcurrency: resolvePositiveInteger('ENRICH_IMAGE_CONCURRENCY', 8),
  nbaMinDelayMs: resolvePositiveInteger('ENRICH_NBA_MIN_DELAY_MS', 250),
  nbaBatchSize: resolvePositiveInteger('ENRICH_NBA_BATCH_SIZE', 48),
  nbaBatchCooldownMs: resolvePositiveInteger('ENRICH_NBA_BATCH_COOLDOWN_MS', 4_000),
  fallbackImageMinDelayMs: resolvePositiveInteger('ENRICH_IMAGE_MIN_DELAY_MS', 120),
  fallbackImageBatchSize: resolvePositiveInteger('ENRICH_IMAGE_BATCH_SIZE', 60),
  fallbackImageBatchCooldownMs: resolvePositiveInteger('ENRICH_IMAGE_BATCH_COOLDOWN_MS', 2_000),
  nbaTimeoutMs: resolvePositiveInteger('ENRICH_NBA_TIMEOUT_MS', 20_000),
  httpTimeoutMs: resolvePositiveInteger('ENRICH_HTTP_TIMEOUT_MS', 20_000),
  playwrightTimeoutMs: resolvePositiveInteger('ENRICH_PLAYWRIGHT_TIMEOUT_MS', 30_000),
  basketballReferenceMinDelayMs: resolvePositiveInteger('ENRICH_BR_MIN_DELAY_MS', 3_000),
  maxRetries: resolvePositiveInteger('ENRICH_MAX_RETRIES', 3),
  commonPlayerInfoMaxAgeMs: resolvePositiveInteger(
    'ENRICH_COMMON_PLAYER_INFO_MAX_AGE_MS',
    14 * 24 * 60 * 60 * 1000,
  ),
  basketballReferenceMaxAgeMs: resolvePositiveInteger(
    'ENRICH_BASKETBALL_REFERENCE_MAX_AGE_MS',
    180 * 24 * 60 * 60 * 1000,
  ),
  imageManifestMaxAgeMs: resolvePositiveInteger(
    'ENRICH_IMAGE_MANIFEST_MAX_AGE_MS',
    30 * 24 * 60 * 60 * 1000,
  ),
}
