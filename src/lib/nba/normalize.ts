import type { PositionToken } from './types'

const POSITION_ORDER: Record<PositionToken, number> = {
  G: 0,
  F: 1,
  C: 2,
}

export function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function splitPlayerName(displayName: string): {
  firstName: string
  lastName: string
} {
  const [firstName = displayName, ...rest] = displayName.trim().split(/\s+/)

  return {
    firstName,
    lastName: rest.join(' ') || firstName,
  }
}

export function positionTokensFromLabel(position: string): PositionToken[] {
  const tokens = position
    .toUpperCase()
    .replace(/\//g, '-')
    .split('-')
    .map((token) => token.trim())
    .filter((token): token is PositionToken => token === 'G' || token === 'F' || token === 'C')

  return [...new Set(tokens)].toSorted((left, right) => POSITION_ORDER[left] - POSITION_ORDER[right])
}

export function canonicalizePosition(position: string): string {
  const tokens = positionTokensFromLabel(position)
  return tokens.length > 0 ? tokens.join('-') : 'N/A'
}

export function parseHeightToInches(height: string | null | undefined): number | null {
  if (!height) {
    return null
  }

  const match = /^(\d+)-(\d+)$/.exec(height.trim())

  if (!match) {
    return null
  }

  const feet = Number(match[1])
  const inches = Number(match[2])

  if (!Number.isFinite(feet) || !Number.isFinite(inches)) {
    return null
  }

  return feet * 12 + inches
}

export function inchesToCentimeters(inches: number | null): number | null {
  if (inches === null) {
    return null
  }

  return Math.round(inches * 2.54)
}

export function buildSearchText(parts: Array<string | number | null | undefined>): string {
  return normalizeSearchValue(parts.filter(Boolean).join(' '))
}
