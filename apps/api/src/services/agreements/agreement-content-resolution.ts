import type { AgreementType, Prisma } from '@ella/db'
import { customAlphabet } from 'nanoid'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../lib/db'
import { sanitizeAgreementHtml } from '../../lib/agreements/sanitize-html'
import { findAgreementPlaceholders } from '../../lib/agreements/placeholders'
import { currentTemplate, defaultTemplateForType } from '../../lib/agreements/template-registry'
import { copyR2Object, deleteFile } from '../storage'
import { assertValidUploadedPdfKey } from './agreement-upload-ops'
import { agreementScopeWhere } from './agreement-shared'
import type { EntityType } from './entity-loader'

const generateFirmSigNonce = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10)
type AgreementReadClient = Pick<typeof prisma, 'agreement'>

function defaultTemplateVersion(type: AgreementType): string {
  return defaultTemplateForType(type)?.version ?? currentTemplate.version
}

export const DEFAULT_AGREEMENT_TITLES: Record<AgreementType, string> = {
  NDA: 'Non-Disclosure Agreement',
  ENGAGEMENT_LETTER: 'Engagement Letter',
  SERVICE_AGREEMENT: 'Service Agreement',
  CONSENT_7216: 'Consent to Use and Disclose Tax Return Information',
  CUSTOM: 'Agreement',
}

export function resolveAgreementTitle(input: {
  type: AgreementType
  title?: string | null
}): string {
  if (input.type === 'CONSENT_7216' && input.title?.trim()) {
    throw new HTTPException(422, {
      message: 'CONSENT_7216 uses the built-in consent title',
    })
  }
  return input.type === 'CONSENT_7216'
    ? DEFAULT_AGREEMENT_TITLES.CONSENT_7216
    : input.title?.trim() || DEFAULT_AGREEMENT_TITLES[input.type]
}

export function agreementUsesFirmSnapshot(input: {
  type: AgreementType
  uploadedPdfKey?: string | null
}): boolean {
  return Boolean(input.uploadedPdfKey) || input.type === 'NDA' || input.type === 'ENGAGEMENT_LETTER'
}

export async function resolveAgreementContent(input: {
  type: AgreementType
  orgId: string
  entityId: string
  templateId?: string | null
  contentHtml?: string | null
  uploadedPdfKey?: string | null
}): Promise<{
  customContentHtml: string | null
  templateVersion: string
  templateId: string | null
}> {
  if (input.type === 'CONSENT_7216' && input.uploadedPdfKey) {
    throw new HTTPException(422, {
      message: 'CONSENT_7216 uses the built-in consent document',
    })
  }
  if (input.uploadedPdfKey) {
    assertValidUploadedPdfKey(input.uploadedPdfKey, input.entityId)
    return {
      customContentHtml: null,
      templateId: null,
      templateVersion: defaultTemplateVersion(input.type),
    }
  }

  const sanitized = input.contentHtml ? sanitizeAgreementHtml(input.contentHtml) : ''
  const customContentHtml = sanitized ? sanitized : null

  let snapshottedHtml: string | null = null
  let resolvedTemplateId: string | null = null
  if (input.templateId) {
    const tpl = await prisma.agreementTemplate.findFirst({
      where: { id: input.templateId, organizationId: input.orgId, isArchived: false },
      select: { id: true, type: true, contentHtml: true },
    })
    if (!tpl) throw new HTTPException(404, { message: 'Template not found' })
    if (tpl.type !== input.type) {
      throw new HTTPException(422, { message: 'Template type does not match agreement type' })
    }
    resolvedTemplateId = tpl.id
    snapshottedHtml = sanitizeAgreementHtml(tpl.contentHtml) || null
  }

  const finalHtml = customContentHtml ?? snapshottedHtml
  if (input.type === 'CONSENT_7216') {
    if (input.templateId || finalHtml) {
      throw new HTTPException(422, {
        message: 'CONSENT_7216 uses the built-in consent document',
      })
    }
    return {
      customContentHtml: null,
      templateVersion: defaultTemplateVersion(input.type),
      templateId: null,
    }
  }

  if (input.type === 'ENGAGEMENT_LETTER') {
    const placeholders = findAgreementPlaceholders(finalHtml)
    if (placeholders.length > 0) {
      throw new HTTPException(422, {
        message: `Engagement Letter has unresolved placeholders: ${placeholders.join(', ')}`,
      })
    }
  }
  if (input.type === 'CUSTOM' && !finalHtml) {
    throw new HTTPException(422, { message: 'CUSTOM agreement requires content' })
  }
  if ((input.type === 'ENGAGEMENT_LETTER' || input.type === 'SERVICE_AGREEMENT') && !finalHtml) {
    throw new HTTPException(422, {
      message: 'Agreement requires either templateId or contentHtml',
    })
  }

  return {
    customContentHtml: finalHtml,
    templateVersion: defaultTemplateVersion(input.type),
    templateId: resolvedTemplateId,
  }
}

export function normalizeAgreementDeposit(depositAmount: Prisma.Decimal | string | number | null | undefined): {
  depositAmount: Prisma.Decimal | string | null
  depositStatus: 'PENDING' | null
} {
  if (depositAmount == null) return { depositAmount: null, depositStatus: null }
  return {
    depositAmount: depositAmount as Prisma.Decimal | string,
    depositStatus: 'PENDING',
  }
}

export async function assertNoActiveNdaEngagement(input: {
  entityType: EntityType
  entityId: string
  orgId: string
  excludeAgreementId?: string
}, db: AgreementReadClient = prisma): Promise<void> {
  const blocking = await db.agreement.findFirst({
    where: {
      ...(input.excludeAgreementId ? { id: { not: input.excludeAgreementId } } : {}),
      ...agreementScopeWhere(input.entityType, input.entityId),
      organizationId: input.orgId,
      type: 'NDA',
      OR: [
        { status: 'SENT', isActive: true },
        { status: 'SIGNED', depositStatus: { in: ['PENDING', 'PAID'] } },
      ],
    },
    select: { id: true, status: true, depositStatus: true },
  })
  if (!blocking) return
  const reason =
    blocking.status === 'SENT'
      ? 'An NDA invite is already outstanding'
      : 'An active NDA engagement already exists'
  throw new HTTPException(409, { message: reason })
}

export async function lockAgreementEntity(
  tx: Prisma.TransactionClient,
  input: { entityType: EntityType; entityId: string; orgId: string },
): Promise<void> {
  const lockKey = `agreement:${input.orgId}:${input.entityType}:${input.entityId}`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`
}

export async function cleanupFirmSignatureSnapshot(
  snapshot: { firmSignaturePngKey?: string | null } | null | undefined,
): Promise<void> {
  if (!snapshot?.firmSignaturePngKey) return
  await deleteFile(snapshot.firmSignaturePngKey).catch(() => {})
}

export async function snapshotFirmSide(input: {
  staffId: string
  orgId: string
  type: AgreementType
  orgGoverningOk: boolean
  orgAddressOk: boolean
  orgContactOk: boolean
}): Promise<{
  firmSignerName: string
  firmSignerTitle: string
  firmSignerEmail: string
  firmSignaturePngKey: string
  firmSignedAt: Date
}> {
  const staff = await prisma.staff.findUnique({
    where: { id: input.staffId },
    select: {
      id: true,
      organizationId: true,
      isActive: true,
      name: true,
      email: true,
      title: true,
      signaturePngKey: true,
    },
  })
  if (!staff || staff.organizationId !== input.orgId) {
    throw new HTTPException(422, { message: 'Draft creator firm profile was not found' })
  }
  if (staff.isActive === false) {
    throw new HTTPException(422, { message: 'Draft creator firm profile is inactive' })
  }

  const missing: string[] = []
  if (!staff.title?.trim()) missing.push('CPA profile title')
  if (!staff.signaturePngKey) missing.push('CPA signature')
  if (!input.orgAddressOk) missing.push('firm address')
  if (input.type === 'NDA' && !input.orgGoverningOk) missing.push('governing law')
  if (input.type === 'ENGAGEMENT_LETTER' && !input.orgContactOk) missing.push('firm contact')
  if (missing.length > 0) {
    throw new HTTPException(422, {
      message: `${DEFAULT_AGREEMENT_TITLES[input.type]} cannot be sent: missing ${missing.join(', ')}. Complete Settings > Profile + Settings > General first.`,
    })
  }

  const firmSigKey = `agreement-firm-sigs/${staff.id}/${generateFirmSigNonce()}.png`
  await copyR2Object({ from: staff.signaturePngKey!, to: firmSigKey })

  return {
    firmSignerName: staff.name,
    firmSignerTitle: staff.title!.trim(),
    firmSignerEmail: staff.email,
    firmSignaturePngKey: firmSigKey,
    firmSignedAt: new Date(),
  }
}
