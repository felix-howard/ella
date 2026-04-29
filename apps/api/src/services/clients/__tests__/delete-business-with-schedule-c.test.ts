/**
 * Unit tests for deleteBusinessWithScheduleC.
 *
 * Verifies:
 *  - happy path: BUSINESS client owning a Schedule C produces both audit
 *    rows (SCHEDULE_C + BUSINESS), explicit MagicLink delete, then
 *    cascade-delete of the Client.
 *  - rejection: missing client / cross-org / non-BUSINESS clientType.
 *  - aggregation: expense count + dollar total reflect non-zero fields only.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@ella/db'
import {
  deleteBusinessWithScheduleC,
  DeleteBusinessError,
} from '../delete-business-with-schedule-c'

function emptyExpense(overrides: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    id: 'sc-1',
    taxCaseId: 'case-1',
    status: 'SUBMITTED',
    version: 1,
    businessName: null,
    businessDesc: null,
    grossReceipts: null,
    returns: null,
    costOfGoods: null,
    otherIncome: null,
    advertising: null,
    carExpense: null,
    commissions: null,
    contractLabor: null,
    depletion: null,
    depreciation: null,
    employeeBenefits: null,
    insurance: null,
    interestMortgage: null,
    interestOther: null,
    legalServices: null,
    officeExpense: null,
    pensionPlans: null,
    rentEquipment: null,
    rentProperty: null,
    repairs: null,
    supplies: null,
    taxesAndLicenses: null,
    travel: null,
    meals: null,
    utilities: null,
    wages: null,
    otherExpenses: null,
    otherExpensesNotes: null,
    customExpenses: null,
    vehicleMiles: null,
    vehicleCommuteMiles: null,
    vehicleOtherMiles: null,
    vehicleDateInService: null,
    vehicleUsedForCommute: false,
    vehicleAnotherAvailable: false,
    vehicleEvidenceWritten: false,
    versionHistory: null,
    submittedAt: null,
    lockedAt: null,
    lockedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
  return base
}

interface FakeTxState {
  client: any
}

function buildFakeTx(state: FakeTxState) {
  return {
    client: {
      findUnique: vi.fn().mockResolvedValue(state.client),
      delete: vi.fn().mockResolvedValue({ id: state.client?.id ?? 'biz-1' }),
    },
    magicLink: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-row' }),
    },
  }
}

function setupPrisma(state: FakeTxState) {
  const tx = buildFakeTx(state)
  const prisma: any = {
    $transaction: vi.fn().mockImplementation(async (cb: any) => cb(tx)),
  }
  return { prisma, tx }
}

function makeClient(overrides: Partial<any> = {}) {
  return {
    id: 'biz-1',
    name: 'Acme LLC',
    clientType: 'BUSINESS',
    businessType: 'SMLLC',
    organizationId: 'org-1',
    clientGroupId: 'group-1',
    einEncrypted: null,
    taxCases: [
      {
        id: 'case-1',
        taxYear: 2025,
        scheduleCExpense: emptyExpense({
          id: 'sc-1',
          taxCaseId: 'case-1',
          advertising: new Prisma.Decimal('100.00'),
          supplies: new Prisma.Decimal('50.00'),
        }),
        magicLinks: [{ id: 'ml-1' }],
      },
    ],
    ...overrides,
  }
}

describe('deleteBusinessWithScheduleC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes SCHEDULE_C + BUSINESS audit rows then deletes magicLinks then client', async () => {
    const { prisma, tx } = setupPrisma({ client: makeClient() })

    const result = await deleteBusinessWithScheduleC(prisma, {
      clientId: 'biz-1',
      staffId: 'staff-1',
      organizationId: 'org-1',
    })

    // Audit: 1 SCHEDULE_C + 1 BUSINESS row
    expect(tx.auditLog.create).toHaveBeenCalledTimes(2)
    const calls = tx.auditLog.create.mock.calls
    expect(calls[0][0].data.entityType).toBe('SCHEDULE_C')
    expect(calls[0][0].data.field).toBe('deleted')
    expect(calls[0][0].data.entityId).toBe('sc-1')
    expect(calls[1][0].data.entityType).toBe('BUSINESS')
    expect(calls[1][0].data.field).toBe('deleted')
    expect(calls[1][0].data.entityId).toBe('biz-1')

    // Explicit magic link delete with case ids
    expect(tx.magicLink.deleteMany).toHaveBeenCalledWith({
      where: { caseId: { in: ['case-1'] } },
    })

    // Cascade delete of client
    expect(tx.client.delete).toHaveBeenCalledWith({ where: { id: 'biz-1' } })

    expect(result).toEqual({
      businessId: 'biz-1',
      scheduleCExpenseIds: ['sc-1'],
      expenseCount: 2, // advertising + supplies = 2 non-zero categories
      totalDollars: '150.00',
    })
  })

  it('counts custom expenses with positive amounts', async () => {
    const client = makeClient({
      taxCases: [
        {
          id: 'case-1',
          taxYear: 2025,
          scheduleCExpense: emptyExpense({
            id: 'sc-1',
            taxCaseId: 'case-1',
            advertising: new Prisma.Decimal('200.00'),
            customExpenses: [
              { name: 'Software', amount: 30 },
              { name: 'Stale row', amount: 0 },
            ],
          }),
          magicLinks: [],
        },
      ],
    })
    const { prisma } = setupPrisma({ client })
    const result = await deleteBusinessWithScheduleC(prisma, {
      clientId: 'biz-1',
      staffId: null,
      organizationId: 'org-1',
    })
    expect(result.expenseCount).toBe(2) // advertising + 1 positive custom
    expect(result.totalDollars).toBe('230.00')
  })

  it('rejects when client not found', async () => {
    const { prisma } = setupPrisma({ client: null })
    await expect(
      deleteBusinessWithScheduleC(prisma, {
        clientId: 'missing',
        staffId: null,
        organizationId: 'org-1',
      }),
    ).rejects.toMatchObject({ code: 'CLIENT_NOT_FOUND' })
  })

  it('rejects when client belongs to different org', async () => {
    const { prisma } = setupPrisma({
      client: makeClient({ organizationId: 'org-other' }),
    })
    await expect(
      deleteBusinessWithScheduleC(prisma, {
        clientId: 'biz-1',
        staffId: null,
        organizationId: 'org-1',
      }),
    ).rejects.toMatchObject({ code: 'CLIENT_NOT_FOUND' })
  })

  it('rejects when client is not a BUSINESS', async () => {
    const { prisma } = setupPrisma({
      client: makeClient({ clientType: 'INDIVIDUAL' }),
    })
    await expect(
      deleteBusinessWithScheduleC(prisma, {
        clientId: 'biz-1',
        staffId: null,
        organizationId: 'org-1',
      }),
    ).rejects.toMatchObject({ code: 'NOT_A_BUSINESS' })
  })

  it('handles BUSINESS without any Schedule C (no SC audit rows, but BUSINESS row + delete)', async () => {
    const client = makeClient({
      taxCases: [
        { id: 'case-1', taxYear: 2025, scheduleCExpense: null, magicLinks: [] },
      ],
    })
    const { prisma, tx } = setupPrisma({ client })
    const result = await deleteBusinessWithScheduleC(prisma, {
      clientId: 'biz-1',
      staffId: null,
      organizationId: 'org-1',
    })
    // 0 SC audit rows + 1 BUSINESS audit row
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1)
    expect(tx.auditLog.create.mock.calls[0][0].data.entityType).toBe('BUSINESS')
    expect(result.expenseCount).toBe(0)
    expect(result.totalDollars).toBe('0.00')
    expect(result.scheduleCExpenseIds).toEqual([])
  })

  it('throws DeleteBusinessError instances (so callers can branch on code)', async () => {
    const { prisma } = setupPrisma({ client: null })
    try {
      await deleteBusinessWithScheduleC(prisma, {
        clientId: 'missing',
        staffId: null,
        organizationId: 'org-1',
      })
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(DeleteBusinessError)
    }
  })
})
