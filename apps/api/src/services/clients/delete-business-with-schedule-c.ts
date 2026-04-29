/**
 * Delete a BUSINESS client that owns one or more Schedule C expense rows.
 *
 * Phase 8 of the Schedule C business-entity redesign. Wraps the delete in a
 * single transaction so the audit snapshot is captured before the cascade
 * destroys the rows.
 *
 * Order is load-then-audit-then-delete so the AuditLog entries persist even
 * if the underlying rows are gone (the entityId is preserved as a tombstone).
 */
import type { PrismaClient, ScheduleCExpense } from '@ella/db'
import { Prisma } from '@ella/db'
import {
  writeBusinessDeletedAuditLog,
  writeScheduleCDeletedAuditLog,
  type BusinessDeleteSnapshot,
  type ScheduleCDeleteSnapshot,
} from '../schedule-c/audit'
import { calculateTotalExpenses } from '../schedule-c/expense-calculator'

export type DeleteBusinessErrorCode =
  | 'CLIENT_NOT_FOUND'
  | 'NOT_A_BUSINESS'

export class DeleteBusinessError extends Error {
  constructor(public readonly code: DeleteBusinessErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'DeleteBusinessError'
  }
}

export interface DeleteBusinessInput {
  clientId: string
  staffId: string | null
  organizationId: string
}

export interface DeleteBusinessResult {
  businessId: string
  scheduleCExpenseIds: string[]
  expenseCount: number
  totalDollars: string
}

interface ScheduleCWithCase {
  id: string
  status: string
  taxCaseId: string
  expense: ScheduleCExpense
  taxYear: number
}

function buildScheduleCSnapshot(
  sc: ScheduleCWithCase,
  client: {
    id: string
    name: string
    clientType: string
    businessType: string | null
  },
  expenseCount: number,
  totalDollars: Prisma.Decimal,
): ScheduleCDeleteSnapshot {
  return {
    scheduleCId: sc.id,
    taxCaseId: sc.taxCaseId,
    taxYear: sc.taxYear,
    clientId: client.id,
    clientName: client.name,
    clientType: client.clientType,
    businessType: client.businessType,
    status: sc.status,
    expenseCount,
    totalDollars: totalDollars.toFixed(2),
  }
}

/**
 * Counts the number of expense category fields with a non-zero value.
 * Mirrors the IRS Schedule C Part II line-by-line presentation; the modal
 * shows this as "N expenses" for the CPA to confirm magnitude before delete.
 */
const EXPENSE_FIELDS = [
  'advertising', 'carExpense', 'commissions', 'contractLabor', 'depletion',
  'depreciation', 'employeeBenefits', 'insurance', 'interestMortgage',
  'interestOther', 'legalServices', 'officeExpense', 'pensionPlans',
  'rentEquipment', 'rentProperty', 'repairs', 'supplies', 'taxesAndLicenses',
  'travel', 'meals', 'utilities', 'wages', 'otherExpenses',
] as const

function countNonZeroExpenses(expense: ScheduleCExpense): number {
  let count = 0
  for (const field of EXPENSE_FIELDS) {
    const value = expense[field as keyof ScheduleCExpense]
    if (value && value instanceof Prisma.Decimal && !value.isZero()) count++
  }
  // Custom expenses (JSON array) — count rows with positive amount
  if (expense.customExpenses) {
    const items = expense.customExpenses as Array<{ name: string; amount: number }>
    for (const item of items) {
      if (item.amount > 0) count++
    }
  }
  return count
}

export async function deleteBusinessWithScheduleC(
  prisma: PrismaClient,
  input: DeleteBusinessInput,
): Promise<DeleteBusinessResult> {
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findUnique({
      where: { id: input.clientId },
      include: {
        taxCases: {
          include: {
            scheduleCExpense: true,
            magicLinks: { select: { id: true } },
          },
        },
      },
    })

    if (!client || client.organizationId !== input.organizationId) {
      throw new DeleteBusinessError('CLIENT_NOT_FOUND')
    }

    if (client.clientType !== 'BUSINESS') {
      throw new DeleteBusinessError('NOT_A_BUSINESS')
    }

    const scheduleCExpenses = client.taxCases
      .map((tc) => tc.scheduleCExpense ? { case: tc, sc: tc.scheduleCExpense } : null)
      .filter((x): x is { case: typeof client.taxCases[number]; sc: ScheduleCExpense } => x !== null)

    // Aggregate totals for audit + return payload
    let aggregateCount = 0
    let aggregateDollars = new Prisma.Decimal(0)
    const scheduleCIds: string[] = []

    for (const { sc } of scheduleCExpenses) {
      const count = countNonZeroExpenses(sc)
      const total = calculateTotalExpenses(sc)
      aggregateCount += count
      aggregateDollars = aggregateDollars.plus(total)
      scheduleCIds.push(sc.id)
    }

    // Audit first (snapshot pattern) — one row per SC + one BUSINESS row
    for (const { case: tc, sc } of scheduleCExpenses) {
      const count = countNonZeroExpenses(sc)
      const total = calculateTotalExpenses(sc)
      await writeScheduleCDeletedAuditLog(tx, {
        snapshot: buildScheduleCSnapshot(
          { id: sc.id, status: sc.status, taxCaseId: sc.taxCaseId, expense: sc, taxYear: tc.taxYear },
          {
            id: client.id,
            name: client.name,
            clientType: client.clientType,
            businessType: client.businessType,
          },
          count,
          total,
        ),
        staffId: input.staffId,
      })
    }

    const businessSnapshot: BusinessDeleteSnapshot = {
      businessId: client.id,
      businessName: client.name,
      businessType: client.businessType,
      einMasked: client.einEncrypted ? '***' : null,
      organizationId: client.organizationId,
      clientGroupId: client.clientGroupId,
      scheduleCSummary: {
        count: aggregateCount,
        totalDollars: aggregateDollars.toFixed(2),
        scheduleCIds,
      },
    }

    await writeBusinessDeletedAuditLog(tx, {
      snapshot: businessSnapshot,
      staffId: input.staffId,
    })

    // Explicit MagicLink delete (belt-and-suspenders — TaxCase cascade also handles it)
    const caseIds = client.taxCases.map((tc) => tc.id)
    if (caseIds.length > 0) {
      await tx.magicLink.deleteMany({ where: { caseId: { in: caseIds } } })
    }

    // Cascade delete: Client → TaxCase → ScheduleCExpense
    await tx.client.delete({ where: { id: client.id } })

    return {
      businessId: client.id,
      scheduleCExpenseIds: scheduleCIds,
      expenseCount: aggregateCount,
      totalDollars: aggregateDollars.toFixed(2),
    }
  })
}
