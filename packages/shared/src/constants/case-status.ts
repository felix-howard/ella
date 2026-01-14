/**
 * Tax Case Status Transitions
 * Single source of truth for valid status transitions used by API and frontend
 */

// Tax Case Status type
export type TaxCaseStatus =
  | 'INTAKE'
  | 'WAITING_DOCS'
  | 'IN_PROGRESS'
  | 'READY_FOR_ENTRY'
  | 'ENTRY_COMPLETE'
  | 'REVIEW'
  | 'FILED'

/**
 * Valid status transitions for tax cases
 * Each status can only transition to specific valid next states
 */
export const VALID_STATUS_TRANSITIONS: Record<TaxCaseStatus, TaxCaseStatus[]> = {
  INTAKE: ['WAITING_DOCS'],
  WAITING_DOCS: ['IN_PROGRESS', 'INTAKE'],
  IN_PROGRESS: ['READY_FOR_ENTRY', 'WAITING_DOCS'],
  READY_FOR_ENTRY: ['ENTRY_COMPLETE', 'IN_PROGRESS'],
  ENTRY_COMPLETE: ['REVIEW', 'READY_FOR_ENTRY'],
  REVIEW: ['FILED', 'ENTRY_COMPLETE'],
  FILED: ['REVIEW'], // Allow reopening for corrections
}

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  currentStatus: TaxCaseStatus,
  newStatus: TaxCaseStatus
): boolean {
  if (currentStatus === newStatus) return true
  const validNext = VALID_STATUS_TRANSITIONS[currentStatus]
  return validNext?.includes(newStatus) ?? false
}

/**
 * Get valid next statuses for a given status
 * Returns current status + all valid transitions
 */
export function getValidNextStatuses(currentStatus: TaxCaseStatus): TaxCaseStatus[] {
  const transitions = VALID_STATUS_TRANSITIONS[currentStatus] || []
  return [currentStatus, ...transitions]
}
