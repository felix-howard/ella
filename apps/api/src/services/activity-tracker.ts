/**
 * Activity Tracker Service
 * Updates lastActivityAt timestamp on TaxCase
 */

import { prisma } from '../lib/db'

/**
 * Update last activity timestamp for a case
 * Call this when:
 * - Client uploads document
 * - Client sends message
 * - Staff verifies document
 * - Staff completes data entry
 *
 * @param caseId - The TaxCase ID to update
 * @returns true if updated, false if case not found or error occurred
 */
export async function updateLastActivity(caseId: string): Promise<boolean> {
  try {
    await prisma.taxCase.update({
      where: { id: caseId },
      data: { lastActivityAt: new Date() }
    })
    return true
  } catch (error) {
    // Log error but don't throw - activity tracking shouldn't block primary operations
    console.error(`[ActivityTracker] Failed to update lastActivityAt for case ${caseId}:`, error)
    return false
  }
}
