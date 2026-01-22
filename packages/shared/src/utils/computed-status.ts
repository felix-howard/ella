/**
 * Computed Status Utility
 * Calculates case status from document/verification state
 */

/** Default threshold for marking a case as stale (days) */
export const STALE_THRESHOLD_DAYS = 7

export type ComputedStatus =
  | 'INTAKE'
  | 'WAITING_DOCS'
  | 'IN_PROGRESS'
  | 'READY_FOR_ENTRY'
  | 'ENTRY_COMPLETE'
  | 'REVIEW'
  | 'FILED'

export interface ComputedStatusInput {
  hasIntakeAnswers: boolean
  missingDocsCount: number
  unverifiedDocsCount: number   // DigitalDoc.status != VERIFIED
  pendingEntryCount: number     // DigitalDoc.entryCompleted = false (where verified)
  isInReview: boolean
  isFiled: boolean
}

/**
 * Compute case status from current state
 * Priority: FILED > REVIEW > ENTRY_COMPLETE > READY_FOR_ENTRY > IN_PROGRESS > WAITING_DOCS > INTAKE
 *
 * @param input - Status computation inputs
 * @returns Computed status based on priority rules
 * @note Negative counts are treated as 0
 */
export function computeStatus(input: ComputedStatusInput): ComputedStatus {
  // Terminal states first (manual flags override everything)
  if (input.isFiled) return 'FILED'
  if (input.isInReview) return 'REVIEW'

  // No intake answers → INTAKE
  if (!input.hasIntakeAnswers) return 'INTAKE'

  // Normalize counts (treat negative as 0)
  const missingDocs = Math.max(0, input.missingDocsCount)
  const unverifiedDocs = Math.max(0, input.unverifiedDocsCount)
  const pendingEntry = Math.max(0, input.pendingEntryCount)

  // Missing docs → WAITING_DOCS
  if (missingDocs > 0) return 'WAITING_DOCS'

  // Has docs but some not verified → IN_PROGRESS
  if (unverifiedDocs > 0) return 'IN_PROGRESS'

  // All verified but entry incomplete → READY_FOR_ENTRY
  if (pendingEntry > 0) return 'READY_FOR_ENTRY'

  // All complete → ENTRY_COMPLETE
  return 'ENTRY_COMPLETE'
}

/**
 * Calculate stale days from lastActivityAt
 *
 * @param lastActivityAt - Last activity timestamp (Date or ISO string)
 * @param thresholdDays - Minimum days to be considered stale (default: 7)
 * @returns Number of days if >= threshold, null if within threshold or invalid date
 *
 * @example
 * // 10 days ago with 7-day threshold
 * calculateStaleDays(tenDaysAgo) // => 10
 *
 * @example
 * // 3 days ago with 7-day threshold
 * calculateStaleDays(threeDaysAgo) // => null
 *
 * @example
 * // Exactly at threshold
 * calculateStaleDays(sevenDaysAgo, 7) // => 7
 */
export function calculateStaleDays(
  lastActivityAt: Date | string,
  thresholdDays: number = STALE_THRESHOLD_DAYS
): number | null {
  const lastActivity = typeof lastActivityAt === 'string'
    ? new Date(lastActivityAt)
    : lastActivityAt

  // Return null for invalid dates
  if (isNaN(lastActivity.getTime())) return null

  const now = new Date()
  const diffMs = now.getTime() - lastActivity.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  return diffDays >= thresholdDays ? diffDays : null
}
