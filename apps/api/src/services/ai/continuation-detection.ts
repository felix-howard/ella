/**
 * Continuation Page Detection Helpers (Phase 5)
 * Detects parent form references and generates descriptive names for continuation pages
 *
 * Key patterns detected:
 * - "Line 19 (2210)" → FORM_2210 continuation
 * - "Schedule E continuation" → SCHEDULE_E continuation
 * - "See attached" → Generic attachment marker
 */

import type { ContinuationMarker } from './prompts/classify'

/**
 * Detect parent form from continuation marker
 * Returns parent form DocType if detected, null otherwise
 *
 * Resolution order:
 * 1. Explicit parentForm in marker (AI extracted "Line 19 (2210)" → FORM_2210)
 * 2. Pattern matching on lineNumber for common references
 */
export function detectParentForm(
  continuationMarker: ContinuationMarker | null | undefined
): string | null {
  if (!continuationMarker) return null

  // Case 1: Explicit parent form from AI extraction
  if (continuationMarker.parentForm) {
    return continuationMarker.parentForm
  }

  // Case 2: Pattern matching on type + lineNumber
  if (continuationMarker.type === 'line-reference' && continuationMarker.lineNumber) {
    const line = continuationMarker.lineNumber

    // Common line reference patterns (IRS form-specific)
    if (line === '19') return 'FORM_2210'   // Line 19 → Form 2210 underpayment
    if (line === '8' || line === '8a') return 'SCHEDULE_1'  // Additional income
    if (line === '21') return 'SCHEDULE_E'  // Rental income summary
    if (line === '31') return 'SCHEDULE_C'  // Net profit/loss
  }

  // Case 3: Attachment type without specific parent
  if (continuationMarker.type === 'attachment' || continuationMarker.type === 'see-attached') {
    // Generic attachment - needs visual inspection to determine parent
    return null
  }

  return null
}

/**
 * Generate descriptive display name for continuation page
 * Format: {year}_{LineX_ParentForm|ParentForm_Continuation}_{taxpayer}
 *
 * Examples:
 * - "2024_Line19_FORM_2210_NguyenVanAnh"
 * - "2024_SCHEDULE_E_Continuation_TranThiHong"
 */
export function generateContinuationDisplayName(
  parentForm: string,
  lineNumber: string | null,
  taxpayerName: string | null,
  taxYear: number | null
): string {
  const parts: string[] = []

  // Year prefix (if available)
  if (taxYear) {
    parts.push(taxYear.toString())
  }

  // Parent form reference with line number if available
  if (lineNumber) {
    parts.push(`Line${lineNumber}_${parentForm}`)
  } else {
    parts.push(`${parentForm}_Continuation`)
  }

  // Taxpayer name (normalized for filename safety)
  if (taxpayerName) {
    const normalized = taxpayerName
      .trim()
      .replace(/\s+/g, '')           // Remove spaces
      .replace(/[^a-zA-Z0-9]/g, '')  // Remove special chars
      .substring(0, 20)               // Max 20 chars
    if (normalized) {
      parts.push(normalized)
    }
  }

  return parts.join('_')
}

/**
 * Check if a document should be treated as a continuation page
 * Returns true if continuationMarker has actionable type
 */
export function isContinuationPage(
  continuationMarker: ContinuationMarker | null | undefined
): boolean {
  if (!continuationMarker) return false
  return continuationMarker.type !== null
}

/**
 * Get continuation page category upgrade
 * Continuation pages of tax forms should be categorized as TAX_FORM, not OTHER
 */
export function getContinuationCategory(parentForm: string | null): string {
  if (!parentForm) return 'OTHER'

  // Tax forms and schedules
  if (
    parentForm.startsWith('FORM_') ||
    parentForm.startsWith('SCHEDULE_')
  ) {
    return 'TAX_FORM'
  }

  return 'OTHER'
}
