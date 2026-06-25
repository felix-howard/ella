/**
 * Entity-aware agreement create + preview operations.
 * - createAgreementForEntity: phone-required, sanitize HTML, write row, dispatch SMS
 * - getDefaultHtmlForEntity: render built-in NDA or Engagement Letter HTML with
 *   known firm/client fields pre-filled.
 * - renderPreviewPdf: in-memory PDF preview of (possibly-edited) HTML
 *
 * Type-aware content resolution:
 *  - NDA without explicit content/template → built-in NDA default
 *  - CUSTOM → customContentHtml is REQUIRED
 *  - ENGAGEMENT_LETTER / SERVICE_AGREEMENT → templateId snapshot OR
 *    customContentHtml; if neither supplied, validation rejects
 *
 * Deposit:
 *  - depositAmount supplied → status seeded to PENDING (legacy NDA semantics)
 *  - depositAmount null → no deposit fields set; row carries no deposit lifecycle
 */
import type { Prisma, AgreementType } from '@ella/db'
import { HTTPException } from 'hono/http-exception'
import { sanitizeAgreementHtml } from '../../lib/agreements/sanitize-html'
import { findAgreementPlaceholders } from '../../lib/agreements/placeholders'
import { renderDefaultAgreementHtml } from '../../lib/agreements/render-default-html'
import { currentTemplate, defaultTemplateForType } from '../../lib/agreements/template-registry'
import { generateAgreementToken, expiryDate, clampExpiryDays } from './token-service'
import {
  sendAgreementInviteSmsBestEffort,
  sendAgreementInviteSmsForClientBestEffort,
} from './agreement-sms'
import { generateSignedPdf } from './pdf-generator'
import {
  loadEntityWithOrg,
  loadEntityForV2Snapshot,
  formatRecipientName,
  composeAddressLine,
  composeContactLine,
  resolveClientNameOrBusiness,
  type EntityType,
} from './entity-loader'
import {
  buildAgreementUrl,
  buildDefaultTemplateVars,
  agreementScopeWhere,
  DEFAULT_DEPOSIT_AMOUNT,
} from './agreement-shared'
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
import { prisma } from '../../lib/db'

// 1×1 transparent PNG. Used as a placeholder pngBuffer for preview renders so
// `generateSignedPdf` doesn't blow up on Buffer access; the `mode: 'preview'`
// flag suppresses the signature block before the byte is read.
const PREVIEW_PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
)

interface CreateAgreementInput {
  entityType: EntityType
  entityId: string
  orgId: string
  staffId: string
  /** Defaults to NDA for backward compatibility. */
  type?: AgreementType
  /** Display title shown to recipient + in PDF header. Defaults to type-based label. */
  title?: string
  /** Snapshot a sanitized custom HTML body. Required for CUSTOM if no templateId. */
  contentHtml?: string
  /** Reference an org-level AgreementTemplate. Snapshotted on create. */
  templateId?: string
  /**
   * R2 key of a staff-uploaded source PDF. When set, the agreement body IS the
   * uploaded PDF: no HTML/template content is resolved, and signing appends a
   * generated signature page instead of rendering from templateVersion.
   */
  uploadedPdfKey?: string
  /** Optional deposit amount. null/undefined → no deposit on this send. */
  depositAmount?: Prisma.Decimal | string | number | null
  /** Staff-only note persisted on the Agreement row. Never rendered to recipient. */
  internalNote?: string | null
  /** Link validity in days. Clamped to [MIN_EXPIRY_DAYS, MAX_EXPIRY_DAYS]. Defaults to 30. */
  expiryDays?: number | null
}

export async function createAgreementForEntity(input: CreateAgreementInput) {
  const type = input.type ?? 'NDA'
  if (type === 'CONSENT_7216' && input.uploadedPdfKey) {
    throw new HTTPException(422, {
      message: 'CONSENT_7216 uses the built-in consent document',
    })
  }
  const isUploadedPdf = Boolean(input.uploadedPdfKey)
  const title = resolveAgreementTitle({ type, title: input.title })
  // Uploaded PDFs always carry a firm counter-signature on the appended page, so
  // they use the v2 snapshot loader regardless of agreement type.
  const usesFirmSnapshot = agreementUsesFirmSnapshot({ type, uploadedPdfKey: input.uploadedPdfKey })

  // NDA + Engagement Letter use the v2 snapshot loader (firm + business client
  // fields). Other types use the legacy narrow loader.
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

  const { customContentHtml, templateVersion, templateId } = await resolveAgreementContent({
    type,
    orgId: input.orgId,
    entityId: entity.id,
    templateId: input.templateId,
    contentHtml: input.contentHtml,
    uploadedPdfKey: input.uploadedPdfKey,
  })

  const deposit =
    type === 'CONSENT_7216'
      ? { depositAmount: null, depositStatus: null }
      : normalizeAgreementDeposit(input.depositAmount)

  const trimmedNote = input.internalNote?.trim() || null

  // Firm-side snapshot: NDA + Engagement Letter. Pre-validates org + staff are set up, then
  // copies the staff signature into a per-agreement R2 object.
  let firmSnapshot: Awaited<ReturnType<typeof snapshotFirmSide>> | null = null
  if (usesFirmSnapshot) {
    const v2 = entity as Awaited<ReturnType<typeof loadEntityForV2Snapshot>>
    // Uploaded PDFs don't render the firm header block (governing law / firm
    // address / contact live inside the customer's own PDF), so those org-detail
    // requirements are relaxed. The firm signature + title are still required —
    // they render on the appended signature page.
    firmSnapshot = await snapshotFirmSide({
      staffId: input.staffId,
      orgId: input.orgId,
      type,
      orgAddressOk:
        isUploadedPdf ||
        Boolean(
          v2.organization.address?.trim() &&
          v2.organization.city?.trim() &&
          v2.organization.state?.trim() &&
          v2.organization.zip?.trim()
        ),
      orgGoverningOk:
        isUploadedPdf ||
        Boolean(v2.organization.governingState?.trim() && v2.organization.governingCounty?.trim()),
      orgContactOk:
        isUploadedPdf ||
        Boolean(v2.organization.firmPhone?.trim() && v2.organization.firmEmail?.trim()),
    })
  }

  const token = generateAgreementToken()
  const expiryDays = clampExpiryDays(input.expiryDays)
  let agreement: Awaited<ReturnType<typeof prisma.agreement.create>>
  try {
    agreement = await prisma.$transaction(async (tx) => {
      await lockAgreementEntity(tx, {
        entityType: input.entityType,
        entityId: entity.id,
        orgId: input.orgId,
      })
      if (type === 'NDA') {
        await assertNoActiveNdaEngagement(
          {
            entityType: input.entityType,
            entityId: entity.id,
            orgId: input.orgId,
          },
          tx,
        )
      }
      return tx.agreement.create({
        data: {
          ...agreementScopeWhere(input.entityType, entity.id),
          organizationId: input.orgId,
          createdByUserId: input.staffId,
          type,
          title,
          internalNote: trimmedNote,
          templateId,
          templateVersion,
          customContentHtml,
          uploadedPdfKey: input.uploadedPdfKey ?? null,
          status: 'SENT',
          token,
          expiresAt: expiryDate(expiryDays),
          expiryDays,
          isActive: true,
          depositAmount: deposit.depositAmount,
          depositStatus: deposit.depositStatus,
          ...(firmSnapshot ?? {}),
        },
      })
    })
  } catch (error) {
    await cleanupFirmSignatureSnapshot(firmSnapshot)
    throw error
  }

  const url = buildAgreementUrl(token)
  // entity.phone is non-null here (requirePhone:true above)
  const recipient = { id: entity.id, firstName: entity.firstName ?? '', phone: entity.phone! }
  const orgName = entity.organization.name
  if (input.entityType === 'lead') {
    await sendAgreementInviteSmsBestEffort({
      lead: recipient,
      orgId: input.orgId,
      staffId: input.staffId,
      url,
      title,
      orgName,
    })
  } else {
    await sendAgreementInviteSmsForClientBestEffort({
      client: recipient,
      orgId: input.orgId,
      staffId: input.staffId,
      url,
      title,
      orgName,
    })
  }
  return { agreement, url }
}

/** Legacy alias retained for transitional callers + tests. */
export const createNdaForEntity = createAgreementForEntity

export async function getDefaultHtmlForEntity(input: {
  entityType: EntityType
  entityId: string
  orgId: string
  type?: AgreementType
}): Promise<{ contentHtml: string }> {
  const type = input.type ?? 'NDA'
  const template = defaultTemplateForType(type)
  if (!template) {
    throw new HTTPException(422, { message: 'No built-in default for agreement type' })
  }
  const entity = await loadEntityForV2Snapshot(input)
  const firmAddress = composeAddressLine({
    address: entity.organization.address,
    city: entity.organization.city,
    state: entity.organization.state,
    zip: entity.organization.zip,
  })
  const clientAddress = entity.client
    ? composeAddressLine({
        address: entity.client.businessAddress,
        city: entity.client.businessCity,
        state: entity.client.businessState,
        zip: entity.client.businessZip,
      })
    : null
  const clientNameOrBusiness = resolveClientNameOrBusiness({
    firstName: entity.firstName,
    lastName: entity.lastName,
    client: entity.client,
    leadBusinessName: entity.leadBusinessName,
  })
  const clientContact = composeContactLine({ phone: entity.phone, email: entity.email })
  const vars = buildDefaultTemplateVars({
    recipientName: formatRecipientName(entity),
    organization: {
      name: entity.organization.name,
      governingState: entity.organization.governingState,
      governingCounty: entity.organization.governingCounty,
      firmAddress,
      firmPhone: entity.organization.firmPhone,
      firmEmail: entity.organization.firmEmail,
      firmWebsite: entity.organization.firmWebsite,
    },
    depositAmount: DEFAULT_DEPOSIT_AMOUNT,
    date: new Date(),
    clientNameOrBusiness,
    clientContact,
    clientAddress,
  })
  return { contentHtml: renderDefaultAgreementHtml(vars, template) }
}

export async function renderPreviewPdf(input: {
  entityType: EntityType
  entityId: string
  orgId: string
  contentHtml?: string
  type?: AgreementType
  /** Override the PDF heading. Defaults to template title when omitted. */
  title?: string
}): Promise<Buffer> {
  const type = input.type ?? 'NDA'
  if (type === 'CONSENT_7216' && (input.title?.trim() || input.contentHtml?.trim())) {
    throw new HTTPException(422, {
      message: 'CONSENT_7216 uses the built-in consent document and title',
    })
  }
  // v2 NDA preview: load full snapshot so header shows real firm + client
  // address. Signatures stay as placeholders (mode='preview' suppresses them).
  const v2Entity = await loadEntityForV2Snapshot(input)
  const sanitized = input.contentHtml ? sanitizeAgreementHtml(input.contentHtml) : ''
  const customContentHtml = sanitized ? sanitized : null
  if (input.type === 'ENGAGEMENT_LETTER') {
    const placeholders = findAgreementPlaceholders(customContentHtml)
    if (placeholders.length > 0) {
      throw new HTTPException(422, {
        message: `Engagement Letter has unresolved placeholders: ${placeholders.join(', ')}`,
      })
    }
  }
  const trimmedTitle = input.title?.trim() || null
  const template = defaultTemplateForType(type) ?? currentTemplate

  const firmAddress = composeAddressLine({
    address: v2Entity.organization.address,
    city: v2Entity.organization.city,
    state: v2Entity.organization.state,
    zip: v2Entity.organization.zip,
  })

  const clientAddress = v2Entity.client
    ? composeAddressLine({
        address: v2Entity.client.businessAddress,
        city: v2Entity.client.businessCity,
        state: v2Entity.client.businessState,
        zip: v2Entity.client.businessZip,
      })
    : null

  const clientNameOrBusiness = resolveClientNameOrBusiness({
    firstName: v2Entity.firstName,
    lastName: v2Entity.lastName,
    client: v2Entity.client,
    leadBusinessName: v2Entity.leadBusinessName,
  })
  const firmContact = composeContactLine({
    phone: v2Entity.organization.firmPhone,
    email: v2Entity.organization.firmEmail,
    website: v2Entity.organization.firmWebsite,
  })

  return generateSignedPdf({
    agreement: {
      type,
      templateVersion: template.version,
      depositAmount: DEFAULT_DEPOSIT_AMOUNT,
      customContentHtml,
      title: trimmedTitle,
    },
    lead: { firstName: v2Entity.firstName, lastName: v2Entity.lastName },
    organization: {
      name: v2Entity.organization.name,
      governingState: v2Entity.organization.governingState,
      governingCounty: v2Entity.organization.governingCounty,
    },
    signature: {
      pngBuffer: PREVIEW_PLACEHOLDER_PNG,
      typedName: 'PREVIEW',
      ipAddress: '0.0.0.0',
      userAgent: 'PREVIEW',
      signedAt: new Date(),
    },
    mode: 'preview',
    firmSnapshot: firmAddress
      ? {
          name: v2Entity.organization.name,
          address: firmAddress,
          contact: firmContact ?? undefined,
          // Signer fields stay empty — preview mode renders placeholders.
          signerName: '',
          signerTitle: '',
        }
      : undefined,
    clientSnapshot: {
      nameOrBusiness: clientNameOrBusiness,
      address: clientAddress ?? '[Address]',
      clientType: v2Entity.client?.clientType ?? 'INDIVIDUAL',
    },
  })
}
