import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/db', () => ({
  prisma: {
    rawImage: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    taxCase: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('../activity-log', () => ({
  logSystemActivity: vi.fn(),
}))

import { prisma } from '../../lib/db'
import { logSystemActivity } from '../activity-log'
import {
  IDENTITY_RETENTION_DELETE_IN_PROGRESS_REASON,
  IDENTITY_RETENTION_POLICY,
  clearScheduledIdentityRetentionForCase,
  getRetentionDeleteAt,
  isIdentityRetentionDoc,
  refreshIdentityRetentionForImage,
  scheduleIdentityRetentionForFiledCase,
} from '../identity-doc-retention'

describe('identity document retention', () => {
  const mockRawImage = vi.mocked(prisma.rawImage)
  const mockTaxCase = vi.mocked(prisma.taxCase)
  const mockLogSystemActivity = vi.mocked(logSystemActivity)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('identifies explicit identity doc types and excludes income docs', () => {
    expect(isIdentityRetentionDoc({ classifiedType: 'SSN_CARD', category: null })).toBe(true)
    expect(isIdentityRetentionDoc({ classifiedType: 'PASSPORT', category: 'IDENTITY' })).toBe(true)
    expect(isIdentityRetentionDoc({ classifiedType: 'POWER_OF_ATTORNEY', category: 'IDENTITY' })).toBe(false)
    expect(isIdentityRetentionDoc({ classifiedType: null, category: 'IDENTITY' })).toBe(false)
    expect(isIdentityRetentionDoc({ classifiedType: 'W2', category: 'INCOME' })).toBe(false)
  })

  it('uses a 90 day default delete window after filed date', () => {
    const filedAt = new Date('2026-05-18T12:00:00.000Z')
    expect(getRetentionDeleteAt(filedAt).toISOString()).toBe('2026-08-16T12:00:00.000Z')
  })

  it('marks identity docs with policy before case is filed without scheduling deletion', async () => {
    mockRawImage.findUnique.mockResolvedValueOnce({
      id: 'img_1',
      caseId: 'case_1',
      classifiedType: 'DRIVER_LICENSE',
      category: 'IDENTITY',
      retentionDeleteAt: null,
      retentionDeletedAt: null,
      isStorageDeleted: false,
      taxCase: {
        status: 'IN_PROGRESS',
        isFiled: false,
        filedAt: null,
        clientId: 'client_1',
        client: { organizationId: 'org_1' },
      },
    } as never)
    mockRawImage.update.mockResolvedValueOnce({ id: 'img_1' } as never)

    await expect(refreshIdentityRetentionForImage('img_1')).resolves.toEqual({
      scheduled: false,
      cleared: false,
    })

    expect(mockRawImage.update).toHaveBeenCalledWith({
      where: { id: 'img_1' },
      data: {
        retentionPolicy: IDENTITY_RETENTION_POLICY,
        retentionDeleteAt: null,
        retentionDeleteReason: null,
      },
    })
    expect(mockLogSystemActivity).not.toHaveBeenCalled()
  })

  it('clears a previously scheduled retention date when the target case is not filed', async () => {
    mockRawImage.findUnique.mockResolvedValueOnce({
      id: 'img_1',
      caseId: 'case_1',
      classifiedType: 'DRIVER_LICENSE',
      category: 'IDENTITY',
      retentionDeleteAt: new Date('2026-08-16T12:00:00.000Z'),
      retentionDeletedAt: null,
      isStorageDeleted: false,
      taxCase: {
        status: 'IN_PROGRESS',
        isFiled: false,
        filedAt: null,
        clientId: 'client_1',
        client: { organizationId: 'org_1' },
      },
    } as never)
    mockRawImage.update.mockResolvedValueOnce({ id: 'img_1' } as never)

    await expect(refreshIdentityRetentionForImage('img_1')).resolves.toEqual({
      scheduled: false,
      cleared: false,
    })

    expect(mockRawImage.update).toHaveBeenCalledWith({
      where: { id: 'img_1' },
      data: {
        retentionPolicy: IDENTITY_RETENTION_POLICY,
        retentionDeleteAt: null,
        retentionDeleteReason: null,
      },
    })
  })

  it('schedules filed case identity docs and leaves other docs untouched', async () => {
    const filedAt = new Date('2026-05-18T12:00:00.000Z')
    mockTaxCase.findUnique.mockResolvedValueOnce({
      id: 'case_1',
      filedAt,
      status: 'FILED',
      isFiled: true,
      clientId: 'client_1',
      client: { organizationId: 'org_1' },
      rawImages: [
        {
          id: 'img_identity',
          caseId: 'case_1',
          classifiedType: 'PASSPORT',
          category: 'IDENTITY',
        },
      ],
    } as never)
    mockRawImage.update.mockResolvedValueOnce({ id: 'img_identity' } as never)

    await expect(scheduleIdentityRetentionForFiledCase('case_1')).resolves.toEqual({
      scheduled: 1,
    })

    expect(mockRawImage.update).toHaveBeenCalledWith({
      where: { id: 'img_identity' },
      data: expect.objectContaining({
        retentionPolicy: IDENTITY_RETENTION_POLICY,
        retentionDeleteAt: new Date('2026-08-16T12:00:00.000Z'),
      }),
    })
    expect(mockLogSystemActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'IDENTITY_DOCUMENT_RETENTION_SCHEDULED',
        rawImageId: 'img_identity',
      })
    )
  })

  it('does not clear in-progress retention delete claims during reopen cleanup', async () => {
    mockRawImage.updateMany.mockResolvedValueOnce({ count: 2 } as never)

    await expect(clearScheduledIdentityRetentionForCase('case_1')).resolves.toEqual({
      cleared: 2,
    })

    expect(mockRawImage.updateMany).toHaveBeenCalledWith({
      where: {
        caseId: 'case_1',
        retentionPolicy: IDENTITY_RETENTION_POLICY,
        retentionDeleteAt: { not: null },
        retentionDeletedAt: null,
        isStorageDeleted: false,
        retentionDeleteReason: { not: IDENTITY_RETENTION_DELETE_IN_PROGRESS_REASON },
      },
      data: {
        retentionDeleteAt: null,
        retentionDeleteReason: null,
      },
    })
  })
})
