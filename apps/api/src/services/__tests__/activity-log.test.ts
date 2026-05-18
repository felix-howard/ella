import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivityActorType, ActivityRiskLevel } from '@ella/db'

vi.mock('../../lib/db', () => ({
  prisma: {
    activityLog: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

import { prisma } from '../../lib/db'
import {
  logActivity,
  logStaffActivities,
  logStaffActivity,
  logSystemActivity,
  redactActivityMetadata,
} from '../activity-log'

describe('Activity Log', () => {
  const mockCreate = vi.mocked(prisma.activityLog.create)
  const mockCreateMany = vi.mocked(prisma.activityLog.createMany)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('redacts nested sensitive metadata keys', () => {
    const result = redactActivityMetadata({
      rawImageId: 'img_1',
      signedUrl: 'https://signed.example.com',
      nested: {
        r2Key: 'clients/private/file.pdf',
        safe: 'kept',
        taxPayerTin: '12-3456789',
      },
      pages: [
        { page: 1, ocrText: 'sensitive extracted text' },
        { page: 2, category: 'IDENTITY' },
      ],
      ssn: '123-45-6789',
      suspiciousValues: {
        genericValue: 'https://signed.example.com/file.pdf?X-Amz-Signature=abc',
        storagePath: 'cases/case_1/private-file.pdf',
        extracted: 'SSN 123-45-6789',
        bearer: 'Bearer abcdefghijklmnopqrstuvwxyz123456',
      },
    })

    expect(result).toEqual({
      rawImageId: 'img_1',
      nested: {
        safe: 'kept',
      },
      pages: [{ page: 1 }, { page: 2, category: 'IDENTITY' }],
      suspiciousValues: {
        genericValue: '[REDACTED]',
        storagePath: '[REDACTED]',
        extracted: '[REDACTED]',
        bearer: '[REDACTED]',
      },
    })
  })

  it('creates a staff activity row with request context', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'activity_1' } as never)

    await logStaffActivity({
      organizationId: 'org_1',
      clientId: 'client_1',
      caseId: 'case_1',
      rawImageId: 'img_1',
      actorStaffId: 'staff_1',
      action: 'DOCUMENT_DOWNLOAD_URL_CREATED',
      riskLevel: ActivityRiskLevel.MEDIUM,
      metadata: {
        rawImageId: 'img_1',
        docType: 'W2',
        signedUrl: 'https://do-not-store.example.com',
      },
      request: {
        ipAddress: '203.0.113.10',
        userAgent: 'Vitest',
        route: '/images/img_1/signed-url',
        method: 'GET',
      },
    })

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org_1',
        clientId: 'client_1',
        caseId: 'case_1',
        rawImageId: 'img_1',
        actorType: ActivityActorType.STAFF,
        actorStaffId: 'staff_1',
        action: 'DOCUMENT_DOWNLOAD_URL_CREATED',
        riskLevel: ActivityRiskLevel.MEDIUM,
        metadata: {
          rawImageId: 'img_1',
          docType: 'W2',
        },
        ipAddress: '203.0.113.10',
        userAgent: 'Vitest',
        route: '/images/img_1/signed-url',
        method: 'GET',
      }),
    })
  })

  it('supports system activity with strict mode', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'activity_2' } as never)

    await logSystemActivity(
      {
        organizationId: 'org_1',
        action: 'RETENTION_JOB_STARTED',
        riskLevel: ActivityRiskLevel.HIGH,
      },
      { strict: true }
    )

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org_1',
        actorType: ActivityActorType.SYSTEM,
        actorStaffId: undefined,
        action: 'RETENTION_JOB_STARTED',
        riskLevel: ActivityRiskLevel.HIGH,
      }),
    })
  })

  it('creates staff activity rows in one batch', async () => {
    mockCreateMany.mockResolvedValueOnce({ count: 2 } as never)

    await logStaffActivities([
      {
        organizationId: 'org_1',
        actorStaffId: 'staff_1',
        action: 'DOCUMENT_MARKED_VIEWED',
        metadata: { rawImageId: 'img_1' },
      },
      {
        organizationId: 'org_1',
        actorStaffId: 'staff_1',
        action: 'DOCUMENT_MARKED_VIEWED',
        metadata: { rawImageId: 'img_2' },
      },
    ])

    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ actorType: ActivityActorType.STAFF, organizationId: 'org_1' }),
        expect.objectContaining({ actorType: ActivityActorType.STAFF, organizationId: 'org_1' }),
      ],
    })
  })

  it('does not throw on non-strict logging failures', async () => {
    mockCreate.mockRejectedValueOnce(new Error('database unavailable'))

    await expect(
      logActivity({
        actorType: ActivityActorType.STAFF,
        actorStaffId: 'staff_1',
        action: 'DOCUMENT_VIEWED',
      })
    ).resolves.not.toThrow()

    expect(console.error).toHaveBeenCalledWith(
      '[ActivityLog] Failed to log activity',
      expect.objectContaining({
        action: 'DOCUMENT_VIEWED',
        actorStaffId: 'staff_1',
      })
    )
  })
})
