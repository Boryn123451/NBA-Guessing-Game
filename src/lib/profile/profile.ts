import type { LocalProfile } from '../nba/types'

const FALLBACK_DISPLAY_NAME = 'Local Scout'

function buildProfileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function sanitizeDisplayName(value: unknown): string {
  if (typeof value !== 'string') {
    return FALLBACK_DISPLAY_NAME
  }

  const nextValue = value.trim().replace(/\s+/g, ' ').slice(0, 24)
  return nextValue.length > 0 ? nextValue : FALLBACK_DISPLAY_NAME
}

export function createLocalProfile(nowIso = new Date().toISOString()): LocalProfile {
  const suffix = nowIso.replace(/\D/g, '').slice(-4)

  return {
    profileId: buildProfileId(),
    displayName: `Scout ${suffix || '0001'}`,
    createdAt: nowIso,
    reputationPoints: 0,
  }
}

