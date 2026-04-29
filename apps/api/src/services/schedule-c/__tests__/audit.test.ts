/**
 * Unit tests for writeReassignAuditLog.
 *
 * Verifies the audit row shape: snapshot-style oldValue/newValue JSON with
 * enough context to identify both source + target without joins.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import {
  writeReassignAuditLog,
  writeBusinessDeletedAuditLog,
  writeScheduleCDeletedAuditLog,
  type ReassignAuditArgs,
  type ScheduleCDeleteSnapshot,
  type BusinessDeleteSnapshot,
} from '../audit'

function makeArgs(overrides: Partial<ReassignAuditArgs> = {}): ReassignAuditArgs {
  return {
    scheduleCId: 'sc-1',
    fromCase: {
      id: 'case-source',
      taxYear: 2025,
      client: {
        id: 'client-1',
        name: 'Alice Individual',
        clientType: 'INDIVIDUAL',
        businessType: null,
      },
    },
    toCase: {
      id: 'case-target',
      taxYear: 2025,
      client: {
        id: 'client-2',
        name: 'Acme LLC',
        clientType: 'BUSINESS',
        businessType: 'SMLLC',
      },
    },
    staffId: 'staff-1',
    ...overrides,
  }
}

function makeFakeTx() {
  return {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  }
}

describe('writeReassignAuditLog', () => {
  it('writes one row with snapshot-style oldValue/newValue', async () => {
    const tx = makeFakeTx()
    await writeReassignAuditLog(tx as any, makeArgs())

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1)
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        entityType: 'SCHEDULE_C',
        entityId: 'sc-1',
        field: 'taxCaseId',
        oldValue: {
          taxCaseId: 'case-source',
          clientId: 'client-1',
          clientName: 'Alice Individual',
          clientType: 'INDIVIDUAL',
          businessType: null,
          taxYear: 2025,
        },
        newValue: {
          taxCaseId: 'case-target',
          clientId: 'client-2',
          clientName: 'Acme LLC',
          clientType: 'BUSINESS',
          businessType: 'SMLLC',
          taxYear: 2025,
        },
        changedById: 'staff-1',
      },
    })
  })

  it('passes through null staffId for system-driven reassigns', async () => {
    const tx = makeFakeTx()
    await writeReassignAuditLog(tx as any, makeArgs({ staffId: null }))

    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ changedById: null }),
      }),
    )
  })

  it('captures business → individual direction symmetrically', async () => {
    const tx = makeFakeTx()
    await writeReassignAuditLog(
      tx as any,
      makeArgs({
        fromCase: {
          id: 'case-business',
          taxYear: 2024,
          client: {
            id: 'client-biz',
            name: 'Acme LLC',
            clientType: 'BUSINESS',
            businessType: 'SOLE_PROP',
          },
        },
        toCase: {
          id: 'case-individual',
          taxYear: 2024,
          client: {
            id: 'client-ind',
            name: 'Bob Owner',
            clientType: 'INDIVIDUAL',
            businessType: null,
          },
        },
      }),
    )

    const call = tx.auditLog.create.mock.calls[0]?.[0]
    expect(call.data.oldValue.clientType).toBe('BUSINESS')
    expect(call.data.oldValue.businessType).toBe('SOLE_PROP')
    expect(call.data.newValue.clientType).toBe('INDIVIDUAL')
    expect(call.data.newValue.businessType).toBeNull()
    expect(call.data.oldValue.taxYear).toBe(2024)
    expect(call.data.newValue.taxYear).toBe(2024)
  })

  it('propagates database errors so the parent transaction rolls back', async () => {
    const tx = {
      auditLog: {
        create: vi.fn().mockRejectedValue(new Error('DB write failed')),
      },
    }

    await expect(writeReassignAuditLog(tx as any, makeArgs())).rejects.toThrow('DB write failed')
  })
})

describe('writeScheduleCDeletedAuditLog (Phase 8)', () => {
  it('writes SCHEDULE_C deleted row with full snapshot in oldValue and null newValue', async () => {
    const tx = makeFakeTx()
    const snapshot: ScheduleCDeleteSnapshot = {
      scheduleCId: 'sc-1',
      taxCaseId: 'case-1',
      taxYear: 2025,
      clientId: 'biz-1',
      clientName: 'Acme LLC',
      clientType: 'BUSINESS',
      businessType: 'SMLLC',
      status: 'SUBMITTED',
      expenseCount: 3,
      totalDollars: '500.00',
    }
    await writeScheduleCDeletedAuditLog(tx as any, { snapshot, staffId: 'staff-1' })

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1)
    const call = tx.auditLog.create.mock.calls[0]?.[0]
    expect(call.data.entityType).toBe('SCHEDULE_C')
    expect(call.data.entityId).toBe('sc-1')
    expect(call.data.field).toBe('deleted')
    expect(call.data.oldValue).toEqual(snapshot)
    expect(call.data.changedById).toBe('staff-1')
  })
})

describe('writeBusinessDeletedAuditLog (Phase 8)', () => {
  it('writes BUSINESS deleted row with snapshot containing scheduleCSummary', async () => {
    const tx = makeFakeTx()
    const snapshot: BusinessDeleteSnapshot = {
      businessId: 'biz-1',
      businessName: 'Acme LLC',
      businessType: 'SMLLC',
      einMasked: '***',
      organizationId: 'org-1',
      clientGroupId: 'group-1',
      scheduleCSummary: {
        count: 3,
        totalDollars: '500.00',
        scheduleCIds: ['sc-1'],
      },
    }
    await writeBusinessDeletedAuditLog(tx as any, { snapshot, staffId: null })

    const call = tx.auditLog.create.mock.calls[0]?.[0]
    expect(call.data.entityType).toBe('BUSINESS')
    expect(call.data.entityId).toBe('biz-1')
    expect(call.data.field).toBe('deleted')
    expect(call.data.oldValue).toEqual(snapshot)
    expect(call.data.changedById).toBeNull()
  })
})
