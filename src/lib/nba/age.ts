import { DateTime } from 'luxon'

export function normalizeBirthDateValue(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  const isoMatch = normalized.match(/(\d{4}-\d{2}-\d{2})/)

  if (isoMatch) {
    return isoMatch[1]
  }

  const parsed = DateTime.fromISO(normalized, { zone: 'utc' })
  return parsed.isValid ? parsed.toISODate() : null
}

export function calculateAgeFromBirthDate(
  birthDateValue: string | null,
  referenceDate: string,
): number | null {
  const birthDate = normalizeBirthDateValue(birthDateValue)

  if (!birthDate) {
    return null
  }

  const normalizedReferenceDate = normalizeBirthDateValue(referenceDate) ?? referenceDate
  const birth = DateTime.fromISO(birthDate, { zone: 'utc' }).startOf('day')
  const current = DateTime.fromISO(normalizedReferenceDate, { zone: 'utc' }).startOf('day')

  if (!birth.isValid || !current.isValid || current < birth) {
    return null
  }

  let age = current.year - birth.year

  if (current.month < birth.month || (current.month === birth.month && current.day < birth.day)) {
    age -= 1
  }

  return age
}

export function normalizePlayerAge(
  birthDateValue: string | null,
  fallbackAge: number | null,
  referenceDate: string,
): number | null {
  const derivedAge = calculateAgeFromBirthDate(birthDateValue, referenceDate)

  if (derivedAge !== null) {
    return derivedAge
  }

  return typeof fallbackAge === 'number' && Number.isFinite(fallbackAge)
    ? Math.trunc(fallbackAge)
    : null
}
