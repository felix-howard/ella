/**
 * Audit log writers for Schedule C lifecycle events.
 *
 * Reassign writes a single AuditLog row capturing both source and target case
 * context as JSON snapshots so the row is human-auditable without joins.
 *
 * Delete writers (Phase 8) snapshot the entity state into oldValue *before*
 * the row is removed. They run inside the same transaction as the cascade
 * delete and must be invoked first so the data is still queryable.
 */
import { Prisma } from '@ella/db'

export interface ReassignAuditClient {
  id: string
  name: string
  clientType: string
  businessType: string | null
}

export interface ReassignAuditCase {
  id: string
  taxYear: number
  client: ReassignAuditClient
}

export interface ReassignAuditArgs {
  scheduleCId: string
  fromCase: ReassignAuditCase
  toCase: ReassignAuditCase
  staffId: string | null
}

function snapshot(c: ReassignAuditCase) {
  return {
    taxCaseId: c.id,
    clientId: c.client.id,
    clientName: c.client.name,
    clientType: c.client.clientType,
    businessType: c.client.businessType,
    taxYear: c.taxYear,
  }
}

export async function writeReassignAuditLog(
  tx: Prisma.TransactionClient,
  args: ReassignAuditArgs,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      entityType: 'SCHEDULE_C',
      entityId: args.scheduleCId,
      field: 'taxCaseId',
      oldValue: snapshot(args.fromCase),
      newValue: snapshot(args.toCase),
      changedById: args.staffId,
    },
  })
}

// ============================================
// PHASE 8: Delete audit writers
// ============================================

export interface ScheduleCDeleteSnapshot {
  scheduleCId: string
  taxCaseId: string
  taxYear: number
  clientId: string
  clientName: string
  clientType: string
  businessType: string | null
  status: string
  expenseCount: number
  totalDollars: string  // Decimal serialized as string for JSON
}

export interface BusinessDeleteSnapshot {
  businessId: string
  businessName: string
  businessType: string | null
  einMasked: string | null
  organizationId: string | null
  clientGroupId: string | null
  scheduleCSummary: {
    count: number
    totalDollars: string
    scheduleCIds: string[]
  }
}

export interface ScheduleCDeleteAuditArgs {
  snapshot: ScheduleCDeleteSnapshot
  staffId: string | null
}

export interface BusinessDeleteAuditArgs {
  snapshot: BusinessDeleteSnapshot
  staffId: string | null
}

export async function writeScheduleCDeletedAuditLog(
  tx: Prisma.TransactionClient,
  args: ScheduleCDeleteAuditArgs,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      entityType: 'SCHEDULE_C',
      entityId: args.snapshot.scheduleCId,
      field: 'deleted',
      oldValue: args.snapshot as unknown as Prisma.InputJsonValue,
      newValue: Prisma.JsonNull,
      changedById: args.staffId,
    },
  })
}

export async function writeBusinessDeletedAuditLog(
  tx: Prisma.TransactionClient,
  args: BusinessDeleteAuditArgs,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      entityType: 'BUSINESS',
      entityId: args.snapshot.businessId,
      field: 'deleted',
      oldValue: args.snapshot as unknown as Prisma.InputJsonValue,
      newValue: Prisma.JsonNull,
      changedById: args.staffId,
    },
  })
}
