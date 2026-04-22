import { describe, expect, it } from 'vitest'

import { resolvePostseasonRule, shouldDailyIncludePostseason } from './postseason'

describe('postseason rules', () => {
  it('locks Daily boards to the calendar-driven postseason rule', () => {
    expect(shouldDailyIncludePostseason('2026-05-15')).toBe(true)
    expect(shouldDailyIncludePostseason('2026-02-15')).toBe(false)

    expect(resolvePostseasonRule('daily', '2026-05-15', false)).toMatchObject({
      includePostseason: true,
      locked: true,
    })
    expect(resolvePostseasonRule('daily', '2026-02-15', true)).toMatchObject({
      includePostseason: false,
      locked: true,
    })
  })

  it('keeps Practice boards user-controlled', () => {
    expect(resolvePostseasonRule('practice', '2026-05-15', true)).toMatchObject({
      includePostseason: true,
      locked: false,
    })
    expect(resolvePostseasonRule('practice', '2026-05-15', false)).toMatchObject({
      includePostseason: false,
      locked: false,
    })
  })
})
