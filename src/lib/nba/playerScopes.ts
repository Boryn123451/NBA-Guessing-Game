import type { PlayerPoolScopeId } from './types'

export interface PlayerPoolScopeDefinition {
  id: PlayerPoolScopeId
  label: string
  description: string
}

export const PLAYER_POOL_SCOPE_DEFINITIONS: PlayerPoolScopeDefinition[] = [
  {
    id: 'current',
    label: 'Current players only',
    description: 'Uses the refreshed active NBA roster pool.',
  },
  {
    id: 'history',
    label: 'All NBA history',
    description:
      'Practice-only all-time pool. Difficulty-aware curation keeps Easy from surfacing random fringe history while current-season extras stay off.',
  },
]

const PLAYER_POOL_SCOPE_BY_ID = new Map(
  PLAYER_POOL_SCOPE_DEFINITIONS.map((scope) => [scope.id, scope]),
)

export const DEFAULT_PLAYER_POOL_SCOPE_ID: PlayerPoolScopeId = 'current'

export function getPlayerPoolScopeDefinition(
  scopeId: PlayerPoolScopeId,
): PlayerPoolScopeDefinition {
  return (
    PLAYER_POOL_SCOPE_BY_ID.get(scopeId) ??
    PLAYER_POOL_SCOPE_DEFINITIONS[0]
  )
}

export function sanitizePlayerPoolScopeId(value: unknown): PlayerPoolScopeId {
  return value === 'history' ? 'history' : DEFAULT_PLAYER_POOL_SCOPE_ID
}
