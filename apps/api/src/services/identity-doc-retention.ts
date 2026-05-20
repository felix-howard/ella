import { ActivityRiskLevel, type DocCategory, type DocType, type PrismaClient } from '@ella/db'
import { prisma } from '../lib/db'
import { config } from '../lib/config'
import { logSystemActivity } from './activity-log'

export const IDENTITY_RETENTION_POLICY = 'IDENTITY_DOCUMENT_AFTER_FILED'
export const IDENTITY_RETENTION_DELETE_REASON = 'identity_document_retention_policy'
export const IDENTITY_RETENTION_DELETE_IN_PROGRESS_REASON =
  'identity_document_retention_delete_in_progress'

export const IDENTITY_RETENTION_DOC_TYPES = [
  'SSN_CARD',
  'DRIVER_LICENSE',
  'PASSPORT',
  'ITIN_LETTER',
  'GREEN_CARD',
  'WORK_VISA',
  'NATURALIZATION_CERTIFICATE',
  'BIRTH_CERTIFICATE',
] as const satisfies readonly DocType[]

const identityDocTypeSet = new Set<DocType>(IDENTITY_RETENTION_DOC_TYPES)

type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

interface RetentionCandidate {
  classifiedType: DocType | null
  category: DocCategory | null
}

interface CaseRetentionState {
  isFiled?: boolean | null
  status?: string | null
  filedAt?: Date | null
}

export function getIdentityRetentionDays(): number {
  const days = config.retention.identityDocDeleteDays
  return Number.isFinite(days) && days > 0 ? days : 90
}

export function getRetentionDeleteAt(filedAt: Date, days = getIdentityRetentionDays()): Date {
  return new Date(filedAt.getTime() + days * 24 * 60 * 60 * 1000)
}

export function isIdentityRetentionDoc(input: RetentionCandidate): boolean {
  return Boolean(input.classifiedType && identityDocTypeSet.has(input.classifiedType))
}

export function isCaseFiled(input: CaseRetentionState): boolean {
  return Boolean(input.isFiled || input.status === 'FILED' || input.filedAt)
}

async function logRetentionScheduled(input: {
  organizationId: string | null
  clientId: string
  caseId: string
  rawImageId: string
  retentionDeleteAt: Date
  docType: DocType | null
  category: DocCategory | null
}) {
  await logSystemActivity({
    organizationId: input.organizationId,
    clientId: input.clientId,
    caseId: input.caseId,
    rawImageId: input.rawImageId,
    action: 'IDENTITY_DOCUMENT_RETENTION_SCHEDULED',
    riskLevel: ActivityRiskLevel.MEDIUM,
    metadata: {
      rawImageId: input.rawImageId,
      docType: input.docType,
      category: input.category,
      retentionPolicy: IDENTITY_RETENTION_POLICY,
      retentionDeleteAt: input.retentionDeleteAt.toISOString(),
    },
  })
}

export async function refreshIdentityRetentionForImage(
  rawImageId: string,
  db: PrismaTx = prisma
): Promise<{ scheduled: boolean; cleared: boolean }> {
  const image = await db.rawImage.findUnique({
    where: { id: rawImageId },
    select: {
      id: true,
      caseId: true,
      classifiedType: true,
      category: true,
      retentionDeleteAt: true,
      retentionDeletedAt: true,
      isStorageDeleted: true,
      taxCase: {
        select: {
          status: true,
          isFiled: true,
          filedAt: true,
          clientId: true,
          client: { select: { organizationId: true } },
        },
      },
    },
  })

  if (!image || image.retentionDeletedAt || image.isStorageDeleted) {
    return { scheduled: false, cleared: false }
  }

  const eligible = isIdentityRetentionDoc(image)
  const caseFiled = isCaseFiled(image.taxCase)

  if (!eligible) {
    await db.rawImage.update({
      where: { id: rawImageId },
      data: {
        retentionPolicy: null,
        retentionDeleteAt: null,
        retentionDeleteReason: null,
      },
    })
    return { scheduled: false, cleared: true }
  }

  if (!caseFiled) {
    await db.rawImage.update({
      where: { id: rawImageId },
      data: {
        retentionPolicy: IDENTITY_RETENTION_POLICY,
        retentionDeleteAt: null,
        retentionDeleteReason: null,
      },
    })
    return { scheduled: false, cleared: false }
  }

  const filedAt = image.taxCase.filedAt ?? new Date()
  const policyDeleteAt = getRetentionDeleteAt(filedAt)
  const retentionDeleteAt =
    image.retentionDeleteAt && image.retentionDeleteAt > policyDeleteAt
      ? image.retentionDeleteAt
      : policyDeleteAt

  await db.rawImage.update({
    where: { id: rawImageId },
    data: {
      retentionPolicy: IDENTITY_RETENTION_POLICY,
      retentionDeleteAt,
      retentionDeleteReason: IDENTITY_RETENTION_DELETE_REASON,
    },
  })

  if (!image.retentionDeleteAt) {
    await logRetentionScheduled({
      organizationId: image.taxCase.client.organizationId,
      clientId: image.taxCase.clientId,
      caseId: image.caseId,
      rawImageId: image.id,
      retentionDeleteAt,
      docType: image.classifiedType,
      category: image.category,
    })
  }

  return { scheduled: true, cleared: false }
}

export async function scheduleIdentityRetentionForFiledCase(
  caseId: string,
  db: PrismaTx = prisma
): Promise<{ scheduled: number }> {
  const taxCase = await db.taxCase.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      filedAt: true,
      status: true,
      isFiled: true,
      clientId: true,
      client: { select: { organizationId: true } },
      rawImages: {
        where: {
          retentionDeletedAt: null,
          isStorageDeleted: false,
          retentionDeleteAt: null,
          classifiedType: { in: [...IDENTITY_RETENTION_DOC_TYPES] },
        },
        select: {
          id: true,
          caseId: true,
          classifiedType: true,
          category: true,
        },
      },
    },
  })

  if (!taxCase || !isCaseFiled(taxCase)) {
    return { scheduled: 0 }
  }

  const filedAt = taxCase.filedAt ?? new Date()
  const retentionDeleteAt = getRetentionDeleteAt(filedAt)
  let scheduled = 0

  for (const image of taxCase.rawImages) {
    await db.rawImage.update({
      where: { id: image.id },
      data: {
        retentionPolicy: IDENTITY_RETENTION_POLICY,
        retentionDeleteAt,
        retentionDeleteReason: IDENTITY_RETENTION_DELETE_REASON,
      },
    })
    scheduled++

    await logRetentionScheduled({
      organizationId: taxCase.client.organizationId,
      clientId: taxCase.clientId,
      caseId: image.caseId,
      rawImageId: image.id,
      retentionDeleteAt,
      docType: image.classifiedType,
      category: image.category,
    })
  }

  return { scheduled }
}

export async function clearScheduledIdentityRetentionForCase(
  caseId: string,
  db: PrismaTx = prisma
): Promise<{ cleared: number }> {
  const result = await db.rawImage.updateMany({
    where: {
      caseId,
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

  return { cleared: result.count }
}

export async function extendScheduledIdentityRetentionForCase(
  caseId: string,
  days: 30 | 60 | 90,
  db: PrismaTx = prisma,
  now = new Date()
): Promise<{
  scheduled: number
  extended: number
  extendedUntil: Date
  nextDeletionAt: Date | null
  latestDeletionAt: Date | null
}> {
  const extendedUntil = getRetentionDeleteAt(now, days)
  const scheduledImages = await db.rawImage.findMany({
    where: {
      caseId,
      retentionPolicy: IDENTITY_RETENTION_POLICY,
      retentionDeleteAt: { not: null },
      retentionDeletedAt: null,
      isStorageDeleted: false,
      retentionDeleteReason: { not: IDENTITY_RETENTION_DELETE_IN_PROGRESS_REASON },
    },
    select: {
      id: true,
      retentionDeleteAt: true,
    },
  })

  const imageIdsToExtend = scheduledImages
    .filter((image) => image.retentionDeleteAt && image.retentionDeleteAt < extendedUntil)
    .map((image) => image.id)

  let extended = 0
  if (imageIdsToExtend.length > 0) {
    const result = await db.rawImage.updateMany({
      where: {
        id: { in: imageIdsToExtend },
        caseId,
        retentionPolicy: IDENTITY_RETENTION_POLICY,
        retentionDeleteAt: { lt: extendedUntil },
        retentionDeletedAt: null,
        isStorageDeleted: false,
        retentionDeleteReason: { not: IDENTITY_RETENTION_DELETE_IN_PROGRESS_REASON },
      },
      data: {
        retentionDeleteAt: extendedUntil,
        retentionDeleteReason: IDENTITY_RETENTION_DELETE_REASON,
      },
    })
    extended = result.count
  }

  const currentScheduledImages = await db.rawImage.findMany({
    where: {
      caseId,
      retentionPolicy: IDENTITY_RETENTION_POLICY,
      retentionDeleteAt: { not: null },
      retentionDeletedAt: null,
      isStorageDeleted: false,
      retentionDeleteReason: { not: IDENTITY_RETENTION_DELETE_IN_PROGRESS_REASON },
    },
    select: {
      retentionDeleteAt: true,
    },
  })

  const effectiveDeleteDates = currentScheduledImages
    .map((image) => image.retentionDeleteAt)
    .filter((date): date is Date => Boolean(date))

  const getBoundaryDate = (mode: 'min' | 'max') => {
    if (effectiveDeleteDates.length === 0) return null
    const times = effectiveDeleteDates.map((date) => date.getTime())
    return new Date(mode === 'min' ? Math.min(...times) : Math.max(...times))
  }

  return {
    scheduled: currentScheduledImages.length,
    extended,
    extendedUntil,
    nextDeletionAt: getBoundaryDate('min'),
    latestDeletionAt: getBoundaryDate('max'),
  }
}
