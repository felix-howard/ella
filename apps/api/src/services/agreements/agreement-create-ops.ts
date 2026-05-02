/**
 * Entity-aware agreement create + preview operations.
 * - createAgreementForEntity: phone-required, sanitize HTML, write row, dispatch SMS
 * - getDefaultHtmlForEntity: render built-in NDA template-v1 with recipient name
 *   (other types have no built-in default — caller seeds from a templateId or empty editor)
 * - renderPreviewPdf: in-memory PDF preview of (possibly-edited) HTML
 *
 * Type-aware content resolution:
 *  - NDA without explicit content/template → built-in template-v1 default
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
import { prisma } from '../../lib/db'
import { sanitizeAgreementHtml } from '../../lib/agreements/sanitize-html'
import { renderDefaultAgreementHtml } from '../../lib/agreements/render-default-html'
import {
  currentTemplate,
  defaultTemplateForType,
} from '../../lib/agreements/template-registry'
import { generateAgreementToken, expiryDate } from './token-service'
import { sendAgreementInviteSms, sendAgreementInviteSmsForClient } from './agreement-sms'
import { generateSignedPdf } from './pdf-generator'
import {
  loadEntityWithOrg,
  formatRecipientName,
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
  /** Optional deposit amount. null/undefined → no deposit on this send. */
  depositAmount?: Prisma.Decimal | string | number | null
  /** Staff-only note persisted on the Agreement row. Never rendered to recipient. */
  internalNote?: string | null
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

export async function createAgreementForEntity(input: CreateAgreementInput) {
  const type = input.type ?? 'NDA'
  const title = input.title?.trim() || DEFAULT_TITLES[type]

  const entity = await loadEntityWithOrg({
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

  const { customContentHtml, templateVersion, templateId } = await resolveContent({
    type,
    orgId: input.orgId,
    templateId: input.templateId,
    contentHtml: input.contentHtml,
  })

  const deposit = normalizeDeposit(input.depositAmount)

  const trimmedNote = input.internalNote?.trim() || null

  const token = generateAgreementToken()
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
      status: 'SENT',
      token,
      expiresAt: expiryDate(),
      isActive: true,
      depositAmount: deposit.depositAmount,
      depositStatus: deposit.depositStatus,
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
}): Promise<{ contentHtml: string }> {
  const entity = await loadEntityWithOrg(input)
  const vars = buildDefaultTemplateVars({
    recipientName: formatRecipientName(entity),
    orgName: entity.organization.name,
    depositAmount: DEFAULT_DEPOSIT_AMOUNT,
    date: new Date(),
  })
  return { contentHtml: renderDefaultAgreementHtml(vars) }
}

export async function renderPreviewPdf(input: {
  entityType: EntityType
  entityId: string
  orgId: string
  contentHtml?: string
  /** Override the PDF heading. Defaults to template title when omitted. */
  title?: string
}): Promise<Buffer> {
  const entity = await loadEntityWithOrg(input)
  const sanitized = input.contentHtml ? sanitizeAgreementHtml(input.contentHtml) : ''
  const customContentHtml = sanitized ? sanitized : null
  const trimmedTitle = input.title?.trim() || null

  return generateSignedPdf({
    agreement: {
      templateVersion: currentTemplate.version,
      depositAmount: DEFAULT_DEPOSIT_AMOUNT,
      customContentHtml,
      title: trimmedTitle,
    },
    lead: { firstName: entity.firstName, lastName: entity.lastName },
    organization: { name: entity.organization.name },
    signature: {
      pngBuffer: PREVIEW_PLACEHOLDER_PNG,
      typedName: 'PREVIEW',
      ipAddress: '0.0.0.0',
      userAgent: 'PREVIEW',
      signedAt: new Date(),
    },
    mode: 'preview',
  })
}
