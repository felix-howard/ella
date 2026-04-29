/**
 * Entity-aware NDA create + preview operations.
 * - createNdaForEntity: phone-required, sanitize HTML, write row, dispatch SMS
 * - getDefaultHtmlForEntity: render template-v1 with recipient name
 * - renderPreviewPdf: in-memory PDF preview of (possibly-edited) HTML
 */
import { prisma } from '../../lib/db'
import { sanitizeNdaHtml } from '../../lib/nda/sanitize-html'
import { renderDefaultNdaHtml } from '../../lib/nda/render-default-html'
import { currentTemplate } from '../../lib/nda/template-registry'
import { generateNdaToken, expiryDate } from './token-service'
import { sendNdaInviteSms, sendNdaInviteSmsForClient } from './nda-sms'
import { generateSignedPdf } from './pdf-generator'
import {
  loadEntityWithOrg,
  formatRecipientName,
  type EntityType,
} from './entity-loader'
import {
  buildNdaUrl,
  buildDefaultTemplateVars,
  ndaScopeWhere,
  DEFAULT_DEPOSIT_AMOUNT,
} from './nda-shared'

// 1×1 transparent PNG. Used as a placeholder pngBuffer for preview renders so
// `generateSignedPdf` doesn't blow up on Buffer access; the `mode: 'preview'`
// flag suppresses the signature block before the byte is read.
const PREVIEW_PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

export async function createNdaForEntity(input: {
  entityType: EntityType
  entityId: string
  orgId: string
  staffId: string
  contentHtml?: string
}) {
  const entity = await loadEntityWithOrg({
    entityType: input.entityType,
    entityId: input.entityId,
    orgId: input.orgId,
    requirePhone: true,
  })

  // Sanitize at the service boundary so callers can't bypass it. Empty string
  // after sanitize collapses to null (matches absent-payload semantics).
  const sanitized = input.contentHtml ? sanitizeNdaHtml(input.contentHtml) : ''
  const customContentHtml = sanitized ? sanitized : null

  const token = generateNdaToken()
  const nda = await prisma.ndaAgreement.create({
    data: {
      ...ndaScopeWhere(input.entityType, entity.id),
      organizationId: input.orgId,
      createdByUserId: input.staffId,
      templateVersion: currentTemplate.version,
      customContentHtml,
      status: 'SENT',
      token,
      expiresAt: expiryDate(),
      isActive: true,
    },
  })

  const url = buildNdaUrl(token)
  // entity.phone is non-null here (requirePhone:true above)
  const recipient = { id: entity.id, firstName: entity.firstName ?? '', phone: entity.phone! }
  if (input.entityType === 'lead') {
    await sendNdaInviteSms({ lead: recipient, orgId: input.orgId, staffId: input.staffId, url })
  } else {
    await sendNdaInviteSmsForClient({
      client: recipient,
      orgId: input.orgId,
      staffId: input.staffId,
      url,
    })
  }
  return { nda, url }
}

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
  return { contentHtml: renderDefaultNdaHtml(vars) }
}

export async function renderPreviewPdf(input: {
  entityType: EntityType
  entityId: string
  orgId: string
  contentHtml?: string
}): Promise<Buffer> {
  const entity = await loadEntityWithOrg(input)
  const sanitized = input.contentHtml ? sanitizeNdaHtml(input.contentHtml) : ''
  const customContentHtml = sanitized ? sanitized : null

  return generateSignedPdf({
    ndaAgreement: {
      templateVersion: currentTemplate.version,
      depositAmount: DEFAULT_DEPOSIT_AMOUNT,
      customContentHtml,
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
