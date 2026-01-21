/**
 * Audit Logger Service
 * Tracks field-level changes to client profiles for compliance and tracking
 *
 * Features:
 * - Non-blocking async logging (doesn't slow down API responses)
 * - Batch insert for efficiency
 * - Supports CLIENT_PROFILE entity type
 */
import { prisma } from '../lib/db'
import { Prisma } from '@ella/db'
import type { AuditEntityType } from '@ella/db'

/** Represents a single field change */
export interface FieldChange {
  field: string
  oldValue: unknown
  newValue: unknown
}

/**
 * Log profile changes to AuditLog table (async, non-blocking)
 * @param clientId - Client ID (used as entityId)
 * @param changes - Array of field changes to log
 * @param staffId - Optional staff ID who made the change
 */
export async function logProfileChanges(
  clientId: string,
  changes: FieldChange[],
  staffId?: string
): Promise<void> {
  if (changes.length === 0) return

  try {
    const auditEntries: Prisma.AuditLogCreateManyInput[] = changes.map((change) => ({
      entityType: 'CLIENT_PROFILE' as AuditEntityType,
      entityId: clientId,
      field: change.field,
      // Prisma requires Prisma.JsonNull for explicit null, undefined for missing
      oldValue: change.oldValue !== undefined ? (change.oldValue as Prisma.InputJsonValue) : Prisma.JsonNull,
      newValue: change.newValue !== undefined ? (change.newValue as Prisma.InputJsonValue) : Prisma.JsonNull,
      changedById: staffId || undefined,
    }))

    // Batch insert audit entries (async, doesn't block API response)
    await prisma.auditLog.createMany({
      data: auditEntries,
    })

    console.log(`[AuditLog] Logged ${changes.length} changes for client ${clientId}`)
  } catch (error) {
    // Structured error logging for compliance visibility
    // Note: In production, consider sending to monitoring service (e.g., Sentry, DataDog)
    console.error('[AuditLog] CRITICAL: Failed to log changes', {
      clientId,
      changesCount: changes.length,
      staffId,
      error: error instanceof Error ? error.message : 'Unknown error',
      // Include field names for debugging (not values for privacy)
      fields: changes.map((c) => c.field),
    })
  }
}

/**
 * Compute diff between old and new intakeAnswers
 * Optimized: only compares keys present in newAnswers (partial update pattern)
 * Returns only the fields that actually changed
 */
export function computeIntakeAnswersDiff(
  oldAnswers: Record<string, unknown>,
  newAnswers: Record<string, unknown>
): FieldChange[] {
  const changes: FieldChange[] = []

  // Only iterate over keys in newAnswers (the update payload)
  // This is efficient for partial updates where only a few keys are changed
  for (const key of Object.keys(newAnswers)) {
    const oldVal = oldAnswers[key]
    const newVal = newAnswers[key]

    // Compare values - using JSON.stringify for deep equality on primitives
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({
        field: `intakeAnswers.${key}`,
        oldValue: oldVal,
        newValue: newVal,
      })
    }
  }

  return changes
}

/**
 * Compute diff for direct profile fields (like filingStatus)
 */
export function computeProfileFieldDiff(
  oldProfile: { filingStatus?: string | null },
  newProfile: { filingStatus?: string }
): FieldChange[] {
  const changes: FieldChange[] = []

  if (newProfile.filingStatus !== undefined && newProfile.filingStatus !== oldProfile.filingStatus) {
    changes.push({
      field: 'filingStatus',
      oldValue: oldProfile.filingStatus,
      newValue: newProfile.filingStatus,
    })
  }

  return changes
}
