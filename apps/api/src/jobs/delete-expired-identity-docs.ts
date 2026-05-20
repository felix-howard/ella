import { ActivityRiskLevel } from '@ella/db'
import { inngest } from '../lib/inngest'
import { prisma } from '../lib/db'
import { deleteFile } from '../services/storage'
import {
  IDENTITY_RETENTION_DELETE_REASON,
  IDENTITY_RETENTION_DELETE_IN_PROGRESS_REASON,
  IDENTITY_RETENTION_DOC_TYPES,
  IDENTITY_RETENTION_POLICY,
  isCaseFiled,
  isIdentityRetentionDoc,
  refreshIdentityRetentionForImage,
} from '../services/identity-doc-retention'
import { logSystemActivity } from '../services/activity-log'
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, ACTIVITY_TARGET_TYPES } from '../services/activity-actions'

const BATCH_SIZE = 100

export async function deleteExpiredIdentityDocs(now = new Date()): Promise<{
  scanned: number
  deleted: number
  failed: number
}> {
  const dueImages = await prisma.rawImage.findMany({
    where: {
      retentionPolicy: IDENTITY_RETENTION_POLICY,
      retentionDeleteAt: { lte: now },
      retentionDeletedAt: null,
      isStorageDeleted: false,
    },
    take: BATCH_SIZE,
    orderBy: { retentionDeleteAt: 'asc' },
    select: {
      id: true,
      caseId: true,
      r2Key: true,
      mimeType: true,
      status: true,
      classifiedType: true,
      category: true,
      retentionDeleteAt: true,
      taxCase: {
        select: {
          clientId: true,
          status: true,
          isFiled: true,
          filedAt: true,
          client: { select: { organizationId: true } },
        },
      },
    },
  })

  let deleted = 0
  let failed = 0

  for (const image of dueImages) {
    if (!isIdentityRetentionDoc(image) || !isCaseFiled(image.taxCase)) {
      await refreshIdentityRetentionForImage(image.id)
      continue
    }

    const claimed = await prisma.rawImage.updateMany({
      where: {
        id: image.id,
        retentionPolicy: IDENTITY_RETENTION_POLICY,
        retentionDeleteAt: { lte: now },
        retentionDeletedAt: null,
        retentionDeleteReason: IDENTITY_RETENTION_DELETE_REASON,
        isStorageDeleted: false,
        classifiedType: { in: [...IDENTITY_RETENTION_DOC_TYPES] },
        taxCase: {
          is: {
            OR: [
              { isFiled: true },
              { status: 'FILED' },
              { filedAt: { not: null } },
            ],
          },
        },
      },
      data: {
        retentionDeleteReason: IDENTITY_RETENTION_DELETE_IN_PROGRESS_REASON,
      },
    })

    if (claimed.count === 0) {
      await refreshIdentityRetentionForImage(image.id)
      continue
    }

    const claimedImage = await prisma.rawImage.findFirst({
      where: {
        id: image.id,
        retentionDeletedAt: null,
        isStorageDeleted: false,
        retentionDeleteReason: IDENTITY_RETENTION_DELETE_IN_PROGRESS_REASON,
      },
      select: {
        r2Key: true,
        classifiedType: true,
        category: true,
        taxCase: {
          select: {
            status: true,
            isFiled: true,
            filedAt: true,
          },
        },
      },
    })

    if (!claimedImage) {
      continue
    }

    if (!isIdentityRetentionDoc(claimedImage) || !isCaseFiled(claimedImage.taxCase)) {
      await prisma.rawImage.updateMany({
        where: {
          id: image.id,
          retentionDeletedAt: null,
          isStorageDeleted: false,
          retentionDeleteReason: IDENTITY_RETENTION_DELETE_IN_PROGRESS_REASON,
        },
        data: { retentionDeleteReason: IDENTITY_RETENTION_DELETE_REASON },
      })
      await refreshIdentityRetentionForImage(image.id)
      continue
    }

    const finalGate = await prisma.rawImage.updateMany({
      where: {
        id: image.id,
        retentionPolicy: IDENTITY_RETENTION_POLICY,
        retentionDeleteAt: { lte: now },
        retentionDeletedAt: null,
        retentionDeleteReason: IDENTITY_RETENTION_DELETE_IN_PROGRESS_REASON,
        isStorageDeleted: false,
        classifiedType: { in: [...IDENTITY_RETENTION_DOC_TYPES] },
        taxCase: {
          is: {
            OR: [
              { isFiled: true },
              { status: 'FILED' },
              { filedAt: { not: null } },
            ],
          },
        },
      },
      data: {
        retentionDeleteReason: IDENTITY_RETENTION_DELETE_IN_PROGRESS_REASON,
      },
    })

    if (finalGate.count === 0) {
      await refreshIdentityRetentionForImage(image.id)
      continue
    }

    const deletedFromStorage = await deleteFile(claimedImage.r2Key, { logKey: false })

    if (!deletedFromStorage) {
      await prisma.rawImage.updateMany({
        where: {
          id: image.id,
          retentionDeletedAt: null,
          isStorageDeleted: false,
          retentionDeleteReason: IDENTITY_RETENTION_DELETE_IN_PROGRESS_REASON,
        },
        data: { retentionDeleteReason: IDENTITY_RETENTION_DELETE_REASON },
      })
      failed++
      await logSystemActivity({
        organizationId: image.taxCase.client.organizationId,
        clientId: image.taxCase.clientId,
        caseId: image.caseId,
        rawImageId: image.id,
        category: ACTIVITY_CATEGORIES.DOCUMENT,
        targetType: ACTIVITY_TARGET_TYPES.RAW_IMAGE,
        targetId: image.id,
        summary: 'Failed to delete expired identity document',
        action: ACTIVITY_ACTIONS.DOCUMENT.RETENTION_DELETE_FAILED,
        riskLevel: ActivityRiskLevel.HIGH,
        metadata: {
          rawImageId: image.id,
          docType: image.classifiedType,
          category: image.category,
          mimeType: image.mimeType,
          status: image.status,
          retentionDeleteAt: image.retentionDeleteAt?.toISOString(),
        },
      })
      continue
    }

    const marked = await prisma.rawImage.updateMany({
      where: {
        id: image.id,
        retentionDeletedAt: null,
        isStorageDeleted: false,
        retentionDeleteReason: IDENTITY_RETENTION_DELETE_IN_PROGRESS_REASON,
      },
      data: {
        retentionDeletedAt: now,
        storageDeletedAt: now,
        isStorageDeleted: true,
        retentionDeleteReason: IDENTITY_RETENTION_DELETE_REASON,
      },
    })

    if (marked.count === 0) {
      continue
    }

    deleted++
    await logSystemActivity({
      organizationId: image.taxCase.client.organizationId,
      clientId: image.taxCase.clientId,
      caseId: image.caseId,
      rawImageId: image.id,
      category: ACTIVITY_CATEGORIES.DOCUMENT,
      targetType: ACTIVITY_TARGET_TYPES.RAW_IMAGE,
      targetId: image.id,
      summary: 'Deleted expired identity document',
      action: ACTIVITY_ACTIONS.DOCUMENT.RETENTION_DELETED,
      riskLevel: ActivityRiskLevel.HIGH,
      metadata: {
        rawImageId: image.id,
        docType: image.classifiedType,
        category: image.category,
        mimeType: image.mimeType,
        status: image.status,
        retentionDeletedAt: now.toISOString(),
      },
    })
  }

  return {
    scanned: dueImages.length,
    deleted,
    failed,
  }
}

export const deleteExpiredIdentityDocsJob = inngest.createFunction(
  { id: 'delete-expired-identity-docs' },
  { cron: '0 7 * * *' },
  async ({ step }) => {
    return step.run('delete-expired-identity-docs', async () => deleteExpiredIdentityDocs())
  }
)
