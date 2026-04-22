import { DateTime } from 'luxon'

import type { GameMode } from './types'

export interface PostseasonRule {
  includePostseason: boolean
  locked: boolean
  label: string
  helpText: string
}

export function shouldDailyIncludePostseason(dateKey: string): boolean {
  const date = DateTime.fromISO(dateKey, { zone: 'utc' })

  if (!date.isValid) {
    return false
  }

  return date.month >= 4 && date.month <= 6
}

export function resolvePostseasonRule(
  mode: GameMode,
  dateKey: string,
  practiceIncludePostseason: boolean,
): PostseasonRule {
  if (mode === 'daily') {
    const includePostseason = shouldDailyIncludePostseason(dateKey)

    return {
      includePostseason,
      locked: true,
      label: includePostseason ? 'Postseason locked on' : 'Postseason locked off',
      helpText: includePostseason
        ? 'Today\'s Daily board includes postseason context by rule.'
        : 'Today\'s Daily board stays regular-season only by rule.',
    }
  }

  return {
    includePostseason: practiceIncludePostseason,
    locked: false,
    label: practiceIncludePostseason ? 'Postseason on' : 'Postseason off',
    helpText: 'Practice can include or exclude postseason context without affecting Daily.',
  }
}
