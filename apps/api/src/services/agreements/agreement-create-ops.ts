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
import { customAlphabet } from 'nanoid'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../lib/db'
import { sanitizeAgreementHtml } from '../../lib/agreements/sanitize-html'
import { findAgreementPlaceholders } from '../../lib/agreements/placeholders'
import { renderDefaultAgreementHtml } from '../../lib/agreements/render-default-html'
import {
  currentTemplate,
  defaultTemplateForType,
} from '../../lib/agreements/template-registry'
import { generateAgreementToken, expiryDate, clampExpiryDays } from './token-service'
import { sendAgreementInviteSms, sendAgreementInviteSmsForClient } from './agreement-sms'
import { generateSignedPdf } from './pdf-generator'
import { assertValidUploadedPdfKey } from './agreement-upload-ops'
import { copyR2Object } from '../storage'
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

// 1×1 transparent PNG. Used as a placeholder pngBuffer for preview renders so
// `generateSignedPdf` doesn't blow up on Buffer access; the `mode: 'preview'`
// flag suppresses the signature block before the byte is read.
const PREVIEW_PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

const generateFirmSigNonce = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10)

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

const DEFAULT_TITLES: Record<AgreementType, string> = {
  NDA: 'Non-Disclosure Agreement',
  ENGAGEMENT_LETTER: 'Engagement Letter',
  SERVICE_AGREEMENT: 'Service Agreement',
  CUSTOM: 'Agreement',
}

/**
 * Resolve the final sanitized customContentHtml + templateVersion for a new
 * Agreement row given a type, optional templateId, and optional content.
 *
 * Defense-in-depth: zod schemas at the route boundary already enforce these
 * rules, but programmatic callers (e.g. `createNdaForLead` from internal
 * services or future Inngest jobs) bypass zod, so the same rules are enforced
 * here at the service boundary too. Throws 422 on rule violations.
 *
 * Precedence: caller-supplied `contentHtml` ALWAYS wins over a `templateId`
 * snapshot — the wizard supplies both when an editor seeds from a template
 * then accepts user edits. The route schema rejects ambiguous cases earlier.
 */
async function resolveContent(input: {
  type: AgreementType
  orgId: string
  templateId?: string
  contentHtml?: string
}): Promise<{ customContentHtml: string | null; templateVersion: string; templateId: string | null }> {
  const sanitized = input.contentHtml ? sanitizeAgreementHtml(input.contentHtml) : ''
  const customContentHtml = sanitized ? sanitized : null

  // Resolve org-level template snapshot, if requested.
  let snapshottedHtml: string | null = null
  let resolvedTemplateId: string | null = null
  if (input.templateId) {
    const tpl = await prisma.agreementTemplate.findFirst({
      where: { id: input.templateId, organizationId: input.orgId, isArchived: false },
      select: { id: true, type: true, contentHtml: true },
    })
    if (!tpl) {
      throw new HTTPException(404, { message: 'Template not found' })
    }
    if (tpl.type !== input.type) {
      throw new HTTPException(422, { message: 'Template type does not match agreement type' })
    }
    resolvedTemplateId = tpl.id
    // Sanitize template HTML at snapshot time. Phase 03 (template-create) will
    // sanitize on write too, but applying it here makes this code path safe
    // independent of template-create's discipline (defense-in-depth + safe even
    // when seed data is loaded directly via SQL).
    snapshottedHtml = sanitizeAgreementHtml(tpl.contentHtml) || null
  }

  // Type-specific content rules.
  const finalHtml = customContentHtml ?? snapshottedHtml
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
  if (
    (input.type === 'ENGAGEMENT_LETTER' || input.type === 'SERVICE_AGREEMENT') &&
    !finalHtml
  ) {
    throw new HTTPException(422, {
      message: 'Agreement requires either templateId or contentHtml',
    })
  }

  // For NDA without explicit content/template, fall back to built-in v1.
  // templateVersion is always set: built-in version when no org template,
  // otherwise the built-in current version is still recorded so audit re-renders
  // through pdf-generator can resolve template structure.
  const builtInDefault = defaultTemplateForType(input.type)
  const templateVersion = builtInDefault?.version ?? currentTemplate.version

  return {
    customContentHtml: finalHtml,
    templateVersion,
    templateId: resolvedTemplateId,
  }
}

function normalizeDeposit(
  depositAmount: CreateAgreementInput['depositAmount'],
): { depositAmount: Prisma.Decimal | string | null; depositStatus: 'PENDING' | null } {
  if (depositAmount == null) return { depositAmount: null, depositStatus: null }
  // Pass through Prisma Decimal / string / number untouched — Prisma coerces.
  return {
    depositAmount: depositAmount as Prisma.Decimal | string,
    depositStatus: 'PENDING',
  }
}

/**
 * NDA-only active-engagement gate. Blocks a new NDA send when the same entity
 * already has either an outstanding NDA invite (SENT + isActive) or a SIGNED
 * NDA whose deposit is still in flight (PENDING/PAID). Other agreement types
 * (Engagement Letter, Service Agreement, Custom) bypass this check entirely
 * — they can be sent in parallel and don't carry the engagement-deposit
 * semantics that motivated the gate.
 */
async function assertNoActiveNdaEngagement(input: {
  entityType: EntityType
  entityId: string
  orgId: string
}): Promise<void> {
  const blocking = await prisma.agreement.findFirst({
    where: {
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

/**
 * Snapshot the CPA's stored signature into a per-agreement R2 copy.
 * Pattern B: store a *copy*, not a reference, so future signature edits don't
 * retro-mutate already-sent NDAs. R2 key is generated up-front so callers can
 * persist it on the row before the actual server-side copy runs (we copy
 * pre-insert; if insert fails the orphan is swept by R2 lifecycle rules).
 *
 * Returns the snapshot fields ready to splat onto Agreement.create.data.
 * Throws 422 when the firm/CPA setup is incomplete — Phase 4 wires the UI
 * pre-flight; this is the server-side last line of defense.
 */
async function snapshotFirmSide(input: {
  staffId: string
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
      name: true,
      email: true,
      title: true,
      signaturePngKey: true,
    },
  })
  if (!staff) {
    throw new HTTPException(404, { message: 'Staff record not found' })
  }
  const missing: string[] = []
  if (!staff.title?.trim()) missing.push('CPA profile title')
  if (!staff.signaturePngKey) missing.push('CPA signature')
  if (!input.orgAddressOk) missing.push('firm address')
  if (input.type === 'NDA' && !input.orgGoverningOk) missing.push('governing law')
  if (input.type === 'ENGAGEMENT_LETTER' && !input.orgContactOk) missing.push('firm contact')
  if (missing.length > 0) {
    throw new HTTPException(422, {
      message: `${DEFAULT_TITLES[input.type]} cannot be sent: missing ${missing.join(', ')}. Complete Settings → Profile + Settings → General first.`,
    })
  }

  // Generate unique destination key. Done before copy so any failure leaves
  // no DB row pointing at a half-written object.
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

export async function createAgreementForEntity(input: CreateAgreementInput) {
  const type = input.type ?? 'NDA'
  const title = input.title?.trim() || DEFAULT_TITLES[type]
  const isUploadedPdf = Boolean(input.uploadedPdfKey)
  // Uploaded PDFs always carry a firm counter-signature on the appended page, so
  // they use the v2 snapshot loader regardless of agreement type.
  const usesFirmSnapshot = isUploadedPdf || type === 'NDA' || type === 'ENGAGEMENT_LETTER'

  // NDA + Engagement Letter use the v2 snapshot loader (firm + business client
  // fields). Other types use the legacy narrow loader.
  const entity =
    usesFirmSnapshot
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

  // Active-engagement gate is NDA-only. Other types are parallel-sendable.
  if (type === 'NDA') {
    await assertNoActiveNdaEngagement({
      entityType: input.entityType,
      entityId: entity.id,
      orgId: input.orgId,
    })
  }

  // Uploaded-PDF path bypasses HTML/template content resolution entirely — the
  // PDF is the body. templateVersion is still recorded (built-in default for the
  // type) so any code that calls getTemplate(version) stays safe, though signing
  // takes the merge path and never renders from it.
  let customContentHtml: string | null
  let templateVersion: string
  let templateId: string | null
  if (isUploadedPdf) {
    assertValidUploadedPdfKey(input.uploadedPdfKey!, entity.id)
    customContentHtml = null
    templateId = null
    templateVersion = defaultTemplateForType(type)?.version ?? currentTemplate.version
  } else {
    const resolved = await resolveContent({
      type,
      orgId: input.orgId,
      templateId: input.templateId,
      contentHtml: input.contentHtml,
    })
    customContentHtml = resolved.customContentHtml
    templateVersion = resolved.templateVersion
    templateId = resolved.templateId
  }

  const deposit = normalizeDeposit(input.depositAmount)

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
      type,
      orgAddressOk:
        isUploadedPdf ||
        Boolean(
          v2.organization.address?.trim() &&
            v2.organization.city?.trim() &&
            v2.organization.state?.trim() &&
            v2.organization.zip?.trim(),
        ),
      orgGoverningOk:
        isUploadedPdf ||
        Boolean(
          v2.organization.governingState?.trim() && v2.organization.governingCounty?.trim(),
        ),
      orgContactOk:
        isUploadedPdf ||
        Boolean(v2.organization.firmPhone?.trim() && v2.organization.firmEmail?.trim()),
    })
  }

  const token = generateAgreementToken()
  const expiryDays = clampExpiryDays(input.expiryDays)
  const agreement = await prisma.agreement.create({
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

  const url = buildAgreementUrl(token)
  // entity.phone is non-null here (requirePhone:true above)
  const recipient = { id: entity.id, firstName: entity.firstName ?? '', phone: entity.phone! }
  const orgName = entity.organization.name
  if (input.entityType === 'lead') {
    await sendAgreementInviteSms({
      lead: recipient,
      orgId: input.orgId,
      staffId: input.staffId,
      url,
      title,
      orgName,
    })
  } else {
    await sendAgreementInviteSmsForClient({
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
  const template = defaultTemplateForType(input.type ?? 'NDA') ?? currentTemplate

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
      type: input.type ?? 'NDA',
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
