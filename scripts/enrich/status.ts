import { readJsonFile, writeJsonFile } from './cache'
import type {
  EnrichmentField,
  EnrichmentSource,
  EnrichmentStatus,
  EnrichmentStatusFile,
  PlayerEnrichmentState,
  SourceState,
} from './types'

function emptySourceState(): SourceState {
  return {
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureMessage: null,
    lastUrl: null,
    transport: null,
  }
}

export function createEmptyPlayerState(playerId: number): PlayerEnrichmentState {
  return {
    playerId,
    status: 'missing_fields',
    missingFields: ['birthDate', 'entryDraftYear', 'imageFallback'],
    fieldSources: {},
    sourceStates: {
      nba: emptySourceState(),
      basketballReference: emptySourceState(),
      fallbackImage: emptySourceState(),
    },
    updatedAt: new Date(0).toISOString(),
  }
}

export async function readStatusFile(filePath: string): Promise<EnrichmentStatusFile | null> {
  return readJsonFile<EnrichmentStatusFile>(filePath)
}

export async function writeStatusFile(filePath: string, statusFile: EnrichmentStatusFile): Promise<void> {
  await writeJsonFile(filePath, statusFile)
}

export function finalizeStatus(
  state: PlayerEnrichmentState,
  missingFields: EnrichmentField[],
): PlayerEnrichmentState {
  const hasFailure = Object.values(state.sourceStates).some((source) => source.lastFailureAt !== null)
  let status: EnrichmentStatus

  if (missingFields.length === 0) {
    status = 'complete'
  } else if (hasFailure) {
    status = 'failed_last_attempt'
  } else if (missingFields.length === 3) {
    status = 'missing_fields'
  } else {
    status = 'partial'
  }

  return {
    ...state,
    status,
    missingFields,
    updatedAt: new Date().toISOString(),
  }
}

export function markSourceAttempt(
  state: PlayerEnrichmentState,
  source: EnrichmentSource,
): void {
  state.sourceStates[source].lastAttemptAt = new Date().toISOString()
}

