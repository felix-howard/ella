import type { AgreementSource, AgreementType, Prisma } from '@ella/db'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../lib/db'
import { hasRequiredFirmContact } from '../../lib/firm-contact'
import { generateAgreementToken, expiryDate, clampExpiryDays } from './token-service'
import {
  sendAgreementInviteSmsBestEffort,
  sendAgreementInviteSmsForClientBestEffort,
} from './agreement-sms'
import {
  loadEntityForV2Snapshot,
  loadEntityWithOrg,
  type EntityType,
} from './entity-loader'
import { agreementScopeWhere, buildAgreementUrl } from './agreement-shared'
import {
  agreementResponseInclude,
  serializeAgreementResponse,
} from './agreement-response-serializer'
import {
  assertNoActiveNdaEngagement,
  agreementUsesFirmSnapshot,
  cleanupFirmSignatureSnapshot,
  lockAgreementEntity,
  normalizeAgreementDeposit,
  resolveAgreementContent,
  resolveAgreementTitle,
  snapshotFirmSide,
} from './agreement-content-resolution'

interface DraftEditableInput {
  type?: AgreementType
  title?: string
  contentHtml?: string
  templateId?: string
  uploadedPdfKey?: string
  depositAmount?: Prisma.Decimal | string | number | null
  internalNote?: string | null
  expiryDays?: number | null
}

interface DraftBaseInput extends DraftEditableInput {
  entityType: EntityType
  entityId: string
  orgId: string
  staffId: string
}

export interface SaveAgreementDraftInput extends DraftBaseInput {
  source?: AgreementSource
  sourceSnapshot?: Record<string, unknown>
  expectedUpdatedAt?: string
}

export interface SendAgreementDraftInput extends DraftBaseInput {
  agreementId: string
  expectedUpdatedAt: string
}

function expectedUpdatedAtDate(value?: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new HTTPException(422, { message: 'expectedUpdatedAt must be a valid ISO date' })
  }
  return date
}

function assertFresh(record: { updatedAt: Date }, expected?: string, required = false): Date | undefined {
  if (required && !expected) {
    throw new HTTPException(422, { message: 'expectedUpdatedAt is required' })
  }
  const expectedDate = expectedUpdatedAtDate(expected)
  if (expectedDate && record.updatedAt.getTime() !== expectedDate.getTime()) {
    throw new HTTPException(409, { message: 'Draft was updated by someone else' })
  }
  return expectedDate
}

function draftScopeWhere(input: {
  entityType: EntityType
  entityId: string
  agreementId: string
  orgId: string
}) {
  return {
    id: input.agreementId,
    ...agreementScopeWhere(input.entityType, input.entityId),
    organizationId: input.orgId,
    status: 'DRAFT' as const,
  }
}

async function loadDraftInScope(input: {
  entityType: EntityType
  entityId: string
  agreementId: string
  orgId: string
}) {
  const draft = await prisma.agreement.findFirst({
    where: draftScopeWhere(input),
  })
  if (!draft) throw new HTTPException(404, { message: 'Draft agreement not found' })
  return draft
}

function mergeDraftValues(
  draft: Awaited<ReturnType<typeof loadDraftInScope>>,
  input: DraftEditableInput,
) {
  const type = input.type ?? draft.type
  const contentSourceTouched =
    input.contentHtml !== undefined ||
    input.templateId !== undefined ||
    input.uploadedPdfKey !== undefined
  return {
    type,
    title:
      input.title !== undefined || type !== draft.type
        ? resolveAgreementTitle({ type, title: input.title })
        : draft.title,
    contentHtml: contentSourceTouched
      ? input.contentHtml
      : (draft.customContentHtml ?? undefined),
    templateId: contentSourceTouched ? input.templateId : (draft.templateId ?? undefined),
    uploadedPdfKey: contentSourceTouched ? input.uploadedPdfKey : (draft.uploadedPdfKey ?? undefined),
    depositAmount:
      input.depositAmount !== undefined ? input.depositAmount : (draft.depositAmount ?? null),
    internalNote:
      input.internalNote !== undefined ? input.internalNote?.trim() || null : draft.internalNote,
    expiryDays: input.expiryDays !== undefined ? input.expiryDays : draft.expiryDays,
  }
}

async function resolveDraftContentAndDeposit(input: {
  type: AgreementType
  orgId: string
  entityId: string
  templateId?: string
  contentHtml?: string
  uploadedPdfKey?: string
  depositAmount?: Prisma.Decimal | string | number | null
}) {
  const resolved = await resolveAgreementContent({
    type: input.type,
    orgId: input.orgId,
    entityId: input.entityId,
    templateId: input.templateId,
    contentHtml: input.contentHtml,
    uploadedPdfKey: input.uploadedPdfKey,
  })
  const deposit =
    input.type === 'CONSENT_7216'
      ? { depositAmount: null, depositStatus: null }
      : normalizeAgreementDeposit(input.depositAmount)
  return { resolved, deposit }
}

async function loadSerializedAgreementResponse(
  agreementId: string,
  missingMessage: string,
  db: Pick<typeof prisma, 'agreement'> = prisma,
) {
  const agreement = await db.agreement.findFirst({
    where: { id: agreementId },
    include: agreementResponseInclude,
  })
  if (!agreement) throw new HTTPException(404, { message: missingMessage })
  return serializeAgreementResponse(agreement)
}

export async function createAgreementDraftForEntity(input: SaveAgreementDraftInput) {
  const type = input.type ?? 'NDA'
  const entity = await loadEntityWithOrg({
    entityType: input.entityType,
    entityId: input.entityId,
    orgId: input.orgId,
  })
  if (type === 'NDA') {
    await assertNoActiveNdaEngagement({
      entityType: input.entityType,
      entityId: entity.id,
      orgId: input.orgId,
    })
  }

  const { resolved, deposit } = await resolveDraftContentAndDeposit({
    type,
    orgId: input.orgId,
    entityId: entity.id,
    templateId: input.templateId,
    contentHtml: input.contentHtml,
    uploadedPdfKey: input.uploadedPdfKey,
    depositAmount: input.depositAmount,
  })

  const agreement = await prisma.agreement.create({
    data: {
      ...agreementScopeWhere(input.entityType, entity.id),
      organizationId: input.orgId,
      createdByUserId: input.staffId,
      lastEditedByUserId: input.staffId,
      type,
      title: resolveAgreementTitle({ type, title: input.title }),
      internalNote: input.internalNote?.trim() || null,
      source: input.source ?? 'MANUAL',
      sourceSnapshot: input.sourceSnapshot as Prisma.InputJsonValue | undefined,
      templateId: resolved.templateId,
      templateVersion: resolved.templateVersion,
      customContentHtml: resolved.customContentHtml,
      uploadedPdfKey: input.uploadedPdfKey ?? null,
      status: 'DRAFT',
      token: generateAgreementToken(),
      expiresAt: null,
      expiryDays: clampExpiryDays(input.expiryDays),
      isActive: false,
      depositAmount: deposit.depositAmount,
      depositStatus: null,
    },
    include: agreementResponseInclude,
  })
  return serializeAgreementResponse(agreement)
}

export async function updateAgreementDraftForEntity(
  input: SaveAgreementDraftInput & { agreementId: string; expectedUpdatedAt: string },
) {
  const draft = await loadDraftInScope(input)
  const expectedDate = assertFresh(draft, input.expectedUpdatedAt, true)!
  const merged = mergeDraftValues(draft, input)
  const { resolved, deposit } = await resolveDraftContentAndDeposit({
    type: merged.type,
    orgId: input.orgId,
    entityId: input.entityId,
    templateId: merged.templateId,
    contentHtml: merged.contentHtml,
    uploadedPdfKey: merged.uploadedPdfKey,
    depositAmount: merged.depositAmount,
  })

  const updated = await prisma.agreement.updateMany({
    where: { ...draftScopeWhere(input), ...(expectedDate ? { updatedAt: expectedDate } : {}) },
    data: {
      type: merged.type,
      title: merged.title,
      internalNote: merged.internalNote,
      ...(input.source ? { source: input.source } : {}),
      ...(input.sourceSnapshot !== undefined
        ? { sourceSnapshot: input.sourceSnapshot as Prisma.InputJsonValue }
        : {}),
      templateId: resolved.templateId,
      templateVersion: resolved.templateVersion,
      customContentHtml: resolved.customContentHtml,
      uploadedPdfKey: merged.uploadedPdfKey ?? null,
      expiryDays: clampExpiryDays(merged.expiryDays),
      expiresAt: null,
      isActive: false,
      lastEditedByUserId: input.staffId,
      depositAmount: deposit.depositAmount,
      depositStatus: null,
    },
  })
  if (updated.count !== 1) throw new HTTPException(409, { message: 'Draft was updated by someone else' })

  return loadSerializedAgreementResponse(draft.id, 'Draft agreement not found')
}

export async function discardAgreementDraftForEntity(input: {
  entityType: EntityType
  entityId: string
  agreementId: string
  orgId: string
  expectedUpdatedAt: string
}) {
  const draft = await loadDraftInScope(input)
  const expectedDate = assertFresh(draft, input.expectedUpdatedAt, true)!
  const deleted = await prisma.agreement.deleteMany({
    where: { ...draftScopeWhere(input), updatedAt: expectedDate },
  })
  if (deleted.count !== 1) {
    throw new HTTPException(409, { message: 'Draft was updated by someone else' })
  }
  return { id: draft.id, status: 'DISCARDED' as const }
}

export async function sendAgreementDraftForEntity(input: SendAgreementDraftInput) {
  const draft = await loadDraftInScope(input)
  const expectedDate = assertFresh(draft, input.expectedUpdatedAt, true)!
  const merged = mergeDraftValues(draft, input)
  const usesFirmSnapshot = agreementUsesFirmSnapshot({
    type: merged.type,
    uploadedPdfKey: merged.uploadedPdfKey,
  })
  const entity = usesFirmSnapshot
    ? await loadEntityForV2Snapshot({
        entityType: input.entityType,
        entityId: input.entityId,
        orgId: input.orgId,
        requirePhone: true,
      })
    : await loadEntityWithOrg({
        entityType: input.entityType,
        entityId: input.entityId,
        orgId: input.orgId,
        requirePhone: true,
      })

  const { resolved, deposit } = await resolveDraftContentAndDeposit({
    type: merged.type,
    orgId: input.orgId,
    entityId: entity.id,
    templateId: merged.templateId,
    contentHtml: merged.contentHtml,
    uploadedPdfKey: merged.uploadedPdfKey,
    depositAmount: merged.depositAmount,
  })
  const isUploadedPdf = Boolean(merged.uploadedPdfKey)
  const v2Entity = usesFirmSnapshot
    ? (entity as Awaited<ReturnType<typeof loadEntityForV2Snapshot>>)
    : null
  const firmSnapshot = usesFirmSnapshot
    ? await snapshotFirmSide({
        staffId: draft.createdByUserId,
        orgId: input.orgId,
        type: merged.type,
        orgAddressOk:
          isUploadedPdf ||
          Boolean(
            v2Entity?.organization.address?.trim() &&
              v2Entity.organization.city?.trim() &&
              v2Entity.organization.state?.trim() &&
              v2Entity.organization.zip?.trim(),
          ),
        orgGoverningOk:
          isUploadedPdf ||
          Boolean(
            v2Entity?.organization.governingState?.trim() &&
              v2Entity.organization.governingCounty?.trim(),
          ),
        orgContactOk:
          isUploadedPdf ||
          Boolean(v2Entity && hasRequiredFirmContact(v2Entity.organization)),
      })
    : null

  const token = generateAgreementToken()
  const expiryDays = clampExpiryDays(merged.expiryDays)
  let agreement: Awaited<ReturnType<typeof loadSerializedAgreementResponse>>
  try {
    agreement = await prisma.$transaction(async (tx) => {
      await lockAgreementEntity(tx, {
        entityType: input.entityType,
        entityId: entity.id,
        orgId: input.orgId,
      })
      if (merged.type === 'NDA') {
        await assertNoActiveNdaEngagement(
          {
            entityType: input.entityType,
            entityId: entity.id,
            orgId: input.orgId,
            excludeAgreementId: draft.id,
          },
          tx,
        )
      }
      const updated = await tx.agreement.updateMany({
        where: { ...draftScopeWhere(input), updatedAt: expectedDate },
        data: {
          type: merged.type,
          title: merged.title,
          internalNote: merged.internalNote,
          templateId: resolved.templateId,
          templateVersion: resolved.templateVersion,
          customContentHtml: resolved.customContentHtml,
          uploadedPdfKey: merged.uploadedPdfKey ?? null,
          status: 'SENT',
          token,
          expiresAt: expiryDate(expiryDays),
          expiryDays,
          isActive: true,
          lastEditedByUserId: input.staffId,
          sentByUserId: input.staffId,
          depositAmount: deposit.depositAmount,
          depositStatus: deposit.depositStatus,
          ...(firmSnapshot ?? {}),
        },
      })
      if (updated.count !== 1) {
        throw new HTTPException(409, { message: 'Draft was updated by someone else' })
      }
      return loadSerializedAgreementResponse(draft.id, 'Agreement not found', tx)
    })
  } catch (error) {
    await cleanupFirmSignatureSnapshot(firmSnapshot)
    throw error
  }

  const url = buildAgreementUrl(token)
  const recipient = { id: entity.id, firstName: entity.firstName ?? '', phone: entity.phone! }
  if (input.entityType === 'lead') {
    await sendAgreementInviteSmsBestEffort({
      lead: recipient,
      orgId: input.orgId,
      staffId: input.staffId,
      url,
      title: merged.title,
      orgName: entity.organization.name,
    })
  } else {
    await sendAgreementInviteSmsForClientBestEffort({
      client: recipient,
      orgId: input.orgId,
      staffId: input.staffId,
      url,
      title: merged.title,
      orgName: entity.organization.name,
    })
  }

  return {
    agreement,
    url,
  }
}
