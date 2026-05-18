import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/inngest', () => ({
  inngest: {
    createFunction: vi.fn((config, trigger, handler) => ({
      config,
      trigger,
      handler,
    })),
  },
}))

vi.mock('../../lib/db', () => ({
  prisma: {
    rawImage: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('../../services/storage', () => ({
  deleteFile: vi.fn(),
}))

vi.mock('../../services/activity-log', () => ({
  logSystemActivity: vi.fn(),
}))

vi.mock('../../services/identity-doc-retention', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return {
    ...actual,
    refreshIdentityRetentionForImage: vi.fn(),
  }
})

import { prisma } from '../../lib/db'
import { deleteFile } from '../../services/storage'
import { logSystemActivity } from '../../services/activity-log'
import { refreshIdentityRetentionForImage } from '../../services/identity-doc-retention'
import { deleteExpiredIdentityDocs, deleteExpiredIdentityDocsJob } from '../delete-expired-identity-docs'

describe('delete expired identity docs job', () => {
  const mockRawImage = vi.mocked(prisma.rawImage)
  const mockDeleteFile = vi.mocked(deleteFile)
  const mockLogSystemActivity = vi.mocked(logSystemActivity)
  const mockRefreshRetention = vi.mocked(refreshIdentityRetentionForImage)
  const now = new Date('2026-08-16T12:00:00.000Z')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers as a daily cron Inngest job', () => {
    const job = deleteExpiredIdentityDocsJob as unknown as { trigger: unknown }
    expect(job.trigger).toEqual({ cron: '0 7 * * *' })
  })

  it('deletes due storage object and keeps RawImage metadata row', async () => {
    mockRawImage.findMany.mockResolvedValueOnce([
      {
        id: 'img_1',
        caseId: 'case_1',
        r2Key: 'cases/case_1/raw/id-card.jpg',
        mimeType: 'image/jpeg',
        status: 'LINKED',
        classifiedType: 'DRIVER_LICENSE',
        category: 'IDENTITY',
        retentionDeleteAt: now,
        taxCase: {
          clientId: 'client_1',
          status: 'FILED',
          isFiled: true,
          filedAt: new Date('2026-05-18T12:00:00.000Z'),
          client: { organizationId: 'org_1' },
        },
      },
    ] as never)
    mockDeleteFile.mockResolvedValueOnce(true)
    mockRawImage.updateMany
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 1 } as never)
    mockRawImage.findFirst.mockResolvedValueOnce({
      r2Key: 'cases/case_1/raw/id-card.jpg',
      classifiedType: 'DRIVER_LICENSE',
      category: 'IDENTITY',
      taxCase: {
        status: 'FILED',
        isFiled: true,
        filedAt: new Date('2026-05-18T12:00:00.000Z'),
      },
    } as never)

    await expect(deleteExpiredIdentityDocs(now)).resolves.toEqual({
      scanned: 1,
      deleted: 1,
      failed: 0,
    })

    expect(mockDeleteFile).toHaveBeenCalledWith('cases/case_1/raw/id-card.jpg', {
      logKey: false,
    })
    expect(mockRawImage.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'img_1',
        retentionDeletedAt: null,
        isStorageDeleted: false,
      }),
      data: expect.objectContaining({
        retentionDeletedAt: now,
        storageDeletedAt: now,
        isStorageDeleted: true,
      }),
    })
    expect(mockLogSystemActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'IDENTITY_DOCUMENT_RETENTION_DELETED',
        rawImageId: 'img_1',
      })
    )
  })

  it('is idempotent when a rerun finds no due rows', async () => {
    mockRawImage.findMany.mockResolvedValueOnce([])

    await expect(deleteExpiredIdentityDocs(now)).resolves.toEqual({
      scanned: 0,
      deleted: 0,
      failed: 0,
    })

    expect(mockDeleteFile).not.toHaveBeenCalled()
    expect(mockRawImage.updateMany).not.toHaveBeenCalled()
    expect(mockLogSystemActivity).not.toHaveBeenCalled()
  })

  it('skips and refreshes stale due rows when the current case is not filed', async () => {
    mockRawImage.findMany.mockResolvedValueOnce([
      {
        id: 'img_1',
        caseId: 'case_1',
        r2Key: 'cases/case_1/raw/id-card.jpg',
        mimeType: 'image/jpeg',
        status: 'LINKED',
        classifiedType: 'DRIVER_LICENSE',
        category: 'IDENTITY',
        retentionDeleteAt: now,
        taxCase: {
          clientId: 'client_1',
          status: 'IN_PROGRESS',
          isFiled: false,
          filedAt: null,
          client: { organizationId: 'org_1' },
        },
      },
    ] as never)
    mockRefreshRetention.mockResolvedValueOnce({ scheduled: false, cleared: false })

    await expect(deleteExpiredIdentityDocs(now)).resolves.toEqual({
      scanned: 1,
      deleted: 0,
      failed: 0,
    })

    expect(mockRefreshRetention).toHaveBeenCalledWith('img_1')
    expect(mockDeleteFile).not.toHaveBeenCalled()
    expect(mockRawImage.updateMany).not.toHaveBeenCalled()
  })

  it('does not delete storage when the atomic claim no longer matches current eligibility', async () => {
    mockRawImage.findMany.mockResolvedValueOnce([
      {
        id: 'img_1',
        caseId: 'case_1',
        r2Key: 'cases/case_1/raw/id-card.jpg',
        mimeType: 'image/jpeg',
        status: 'LINKED',
        classifiedType: 'DRIVER_LICENSE',
        category: 'IDENTITY',
        retentionDeleteAt: now,
        taxCase: {
          clientId: 'client_1',
          status: 'FILED',
          isFiled: true,
          filedAt: new Date('2026-05-18T12:00:00.000Z'),
          client: { organizationId: 'org_1' },
        },
      },
    ] as never)
    mockRawImage.updateMany.mockResolvedValueOnce({ count: 0 } as never)
    mockRefreshRetention.mockResolvedValueOnce({ scheduled: false, cleared: false })

    await expect(deleteExpiredIdentityDocs(now)).resolves.toEqual({
      scanned: 1,
      deleted: 0,
      failed: 0,
    })

    expect(mockDeleteFile).not.toHaveBeenCalled()
    expect(mockRefreshRetention).toHaveBeenCalledWith('img_1')
  })

  it('does not delete storage when a claimed row cannot be re-read', async () => {
    mockRawImage.findMany.mockResolvedValueOnce([
      {
        id: 'img_1',
        caseId: 'case_1',
        r2Key: 'cases/case_1/raw/id-card.jpg',
        mimeType: 'image/jpeg',
        status: 'LINKED',
        classifiedType: 'DRIVER_LICENSE',
        category: 'IDENTITY',
        retentionDeleteAt: now,
        taxCase: {
          clientId: 'client_1',
          status: 'FILED',
          isFiled: true,
          filedAt: new Date('2026-05-18T12:00:00.000Z'),
          client: { organizationId: 'org_1' },
        },
      },
    ] as never)
    mockRawImage.updateMany.mockResolvedValueOnce({ count: 1 } as never)
    mockRawImage.findFirst.mockResolvedValueOnce(null)

    await expect(deleteExpiredIdentityDocs(now)).resolves.toEqual({
      scanned: 1,
      deleted: 0,
      failed: 0,
    })

    expect(mockDeleteFile).not.toHaveBeenCalled()
  })

  it('does not delete storage when a claimed row is reopened before deletion', async () => {
    mockRawImage.findMany.mockResolvedValueOnce([
      {
        id: 'img_1',
        caseId: 'case_1',
        r2Key: 'cases/case_1/raw/id-card.jpg',
        mimeType: 'image/jpeg',
        status: 'LINKED',
        classifiedType: 'DRIVER_LICENSE',
        category: 'IDENTITY',
        retentionDeleteAt: now,
        taxCase: {
          clientId: 'client_1',
          status: 'FILED',
          isFiled: true,
          filedAt: new Date('2026-05-18T12:00:00.000Z'),
          client: { organizationId: 'org_1' },
        },
      },
    ] as never)
    mockRawImage.updateMany
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 1 } as never)
    mockRawImage.findFirst.mockResolvedValueOnce({
      r2Key: 'cases/case_1/raw/id-card.jpg',
      classifiedType: 'DRIVER_LICENSE',
      category: 'IDENTITY',
      taxCase: {
        status: 'IN_PROGRESS',
        isFiled: false,
        filedAt: null,
      },
    } as never)
    mockRefreshRetention.mockResolvedValueOnce({ scheduled: false, cleared: true })

    await expect(deleteExpiredIdentityDocs(now)).resolves.toEqual({
      scanned: 1,
      deleted: 0,
      failed: 0,
    })

    expect(mockDeleteFile).not.toHaveBeenCalled()
    expect(mockRawImage.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'img_1',
        retentionDeletedAt: null,
        isStorageDeleted: false,
        retentionDeleteReason: 'identity_document_retention_delete_in_progress',
      },
      data: { retentionDeleteReason: 'identity_document_retention_policy' },
    })
    expect(mockRefreshRetention).toHaveBeenCalledWith('img_1')
  })

  it('does not delete storage when final eligibility gate fails before deletion', async () => {
    mockRawImage.findMany.mockResolvedValueOnce([
      {
        id: 'img_1',
        caseId: 'case_1',
        r2Key: 'cases/case_1/raw/id-card.jpg',
        mimeType: 'image/jpeg',
        status: 'LINKED',
        classifiedType: 'DRIVER_LICENSE',
        category: 'IDENTITY',
        retentionDeleteAt: now,
        taxCase: {
          clientId: 'client_1',
          status: 'FILED',
          isFiled: true,
          filedAt: new Date('2026-05-18T12:00:00.000Z'),
          client: { organizationId: 'org_1' },
        },
      },
    ] as never)
    mockRawImage.updateMany
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 0 } as never)
    mockRawImage.findFirst.mockResolvedValueOnce({
      r2Key: 'cases/case_1/raw/id-card.jpg',
      classifiedType: 'DRIVER_LICENSE',
      category: 'IDENTITY',
      taxCase: {
        status: 'FILED',
        isFiled: true,
        filedAt: new Date('2026-05-18T12:00:00.000Z'),
      },
    } as never)
    mockRefreshRetention.mockResolvedValueOnce({ scheduled: false, cleared: true })

    await expect(deleteExpiredIdentityDocs(now)).resolves.toEqual({
      scanned: 1,
      deleted: 0,
      failed: 0,
    })

    expect(mockDeleteFile).not.toHaveBeenCalled()
    expect(mockRefreshRetention).toHaveBeenCalledWith('img_1')
  })
})
