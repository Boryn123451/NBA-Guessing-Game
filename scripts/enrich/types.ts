import type { PlayerPoolData, PlayerRecord } from '../../src/lib/nba/types'

export type EnrichmentField = 'birthDate' | 'entryDraftYear' | 'imageFallback'
export type EnrichmentSource = 'nba' | 'basketballReference' | 'fallbackImage'
export type EnrichmentTransport = 'api' | 'http' | 'playwright'
export type EnrichmentMode = 'full' | 'repair' | 'repair-missing' | 'repair-playwright'
export type EnrichmentStatus = 'complete' | 'partial' | 'missing_fields' | 'failed_last_attempt'

export interface ProviderFieldResult {
  birthDate?: string | null
  entryDraftYear?: number | null
  entryDraftYearSource?: PlayerRecord['entryDraftYearSource']
  imageFallbackUrl?: string | null
}

export interface ProviderResult extends ProviderFieldResult {
  source: EnrichmentSource
  transport: EnrichmentTransport
  url?: string
  fetchedAt: string
  fromCache: boolean
}

export interface SourceState {
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastFailureMessage: string | null
  lastUrl: string | null
  transport: EnrichmentTransport | null
}

export interface PlayerEnrichmentState {
  playerId: number
  status: EnrichmentStatus
  missingFields: EnrichmentField[]
  fieldSources: Partial<Record<EnrichmentField, EnrichmentSource>>
  sourceStates: Record<EnrichmentSource, SourceState>
  updatedAt: string
}

export interface EnrichmentStatusFile {
  schemaVersion: 1
  updatedAt: string
  players: Record<string, PlayerEnrichmentState>
}

export interface EnrichmentReport {
  generatedAt: string
  completePlayers: number
  partialPlayers: number
  unresolvedPlayers: number
  missingFieldCounts: Record<EnrichmentField, number>
  scrapings: {
    nba: number
    basketballReferenceHttp: number
    basketballReferencePlaywright: number
    fallbackImages: number
  }
  failures: Array<{
    playerId: number
    source: EnrichmentSource
    url: string | null
    reason: string | null
  }>
}

export interface LoadedPools {
  current: PlayerPoolData | null
  history: PlayerPoolData | null
  currentPlayers: PlayerRecord[]
  historyPlayers: PlayerRecord[]
}

