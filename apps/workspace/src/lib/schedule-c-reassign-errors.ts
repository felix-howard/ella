/**
 * Shared helper for translating Schedule C reassign API errors. Used by both
 * the manual-reassign picker and the link-existing modal so a new error code
 * only needs to be added in one place.
 */
import { ApiError } from './api-client'

export const REASSIGN_ERROR_CODES = new Set([
  'SCHEDULE_C_NOT_FOUND',
  'TARGET_CASE_NOT_FOUND',
  'ORG_MISMATCH',
  'SAME_CASE',
  'TARGET_CASE_HAS_SCHEDULE_C',
  'CROSS_GROUP_NOT_ALLOWED',
  'TAX_YEAR_MISMATCH',
])

export function localizedReassignError(
  err: unknown,
  t: (k: string) => string,
  fallbackKey: string,
): string {
  if (err instanceof ApiError && REASSIGN_ERROR_CODES.has(err.code)) {
    return t(`scheduleC.reassignError.${err.code}`)
  }
  if (err instanceof Error) return err.message
  return t(fallbackKey)
}
