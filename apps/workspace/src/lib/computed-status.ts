/**
 * Computed Status Utility
 * Computes case status based on document/verification state
 * Mirrors the backend logic in packages/shared/src/utils/computed-status.ts
 */

import type { TaxCaseStatus } from './api-client'

export interface ComputedStatusInput {
  hasIntakeAnswers: boolean
  missingDocsCount: number
  extractedDocsCount: number      // DigitalDoc.status = EXTRACTED (needs verification)
  unverifiedDocsCount: number     // DigitalDoc.status != VERIFIED
  pendingEntryCount: number       // DigitalDoc.entryCompleted = false
  isInReview: boolean
  isFiled: boolean
}

/**
 * Compute the case status based on document/verification state
 * Priority: FILED > REVIEW > computed based on docs
 */
export function computeStatus(input: ComputedStatusInput): TaxCaseStatus {
  // Terminal states first (manual flags)
  if (input.isFiled) return 'FILED'
  if (input.isInReview) return 'REVIEW'

  // No intake answers → INTAKE
  if (!input.hasIntakeAnswers) return 'INTAKE'

  // Missing docs → WAITING_DOCS
  if (input.missingDocsCount > 0) return 'WAITING_DOCS'

  // Has docs but some not verified → IN_PROGRESS
  if (input.unverifiedDocsCount > 0) return 'IN_PROGRESS'

  // All verified but entry incomplete → READY_FOR_ENTRY
  if (input.pendingEntryCount > 0) return 'READY_FOR_ENTRY'

  // All complete → ENTRY_COMPLETE
  return 'ENTRY_COMPLETE'
}
