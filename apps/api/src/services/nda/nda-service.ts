/**
 * NDA business logic — staff creates/lists/resends NDAs, resolves the deposit,
 * and hands out presigned PDF URLs. Public signing lives in `nda-signing-service.ts`.
 * SMS concerns live in `nda-sms.ts`.
 */
import { HTTPException } from 'hono/http-exception'
import type { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { PORTAL_URL } from '../../lib/constants'
import { getSignedDownloadUrl } from '../storage'
import { currentTemplate } from '../../lib/nda/template-registry'
import { sanitizeNdaHtml } from '../../lib/nda/sanitize-html'
import { renderDefaultNdaHtml } from '../../lib/nda/render-default-html'
import type { TemplateVars } from '../../lib/nda/types'
import { generateNdaToken, expiryDate, isExpired } from './token-service'
import { sendNdaInviteSms } from './nda-sms'
import { generateSignedPdf } from './pdf-generator'
import { assertDepositTransition, type DepositStatus } from '../../routes/nda/helpers'

const PRESIGNED_PDF_TTL_SECONDS = 900 // 15 min

// 1×1 transparent PNG. Used as a placeholder pngBuffer for preview renders so
// `generateSignedPdf` doesn't blow up on Buffer access; the `mode: 'preview'`
// flag suppresses the signature block before the byte ever gets used.
const PREVIEW_PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

function formatLeadFullName(lead: { firstName: string | null; lastName: string | null }): string {
  const parts = [lead.firstName, lead.lastName]
    .filter((p): p is string => !!p && p.trim().length > 0)
  return parts.join(' ').trim() || 'Unnamed Lead'
}

function buildDefaultTemplateVars(input: {
  lead: { firstName: string | null; lastName: string | null }
  orgName: string
  depositAmount: Prisma.Decimal | { toString(): string }
  date: Date
}): TemplateVars {
  return {
    leadFullName: formatLeadFullName(input.lead),
    orgName: input.orgName,
    depositAmount: `$${input.depositAmount.toString()}`,
    date: input.date.toISOString().slice(0, 10),
    templateVersion: currentTemplate.version,
  }
}

/**
 * Loads the lead + its org's name. Centralised so the default-html and
 * preview-pdf paths share the same scoping rule (lead must belong to org).
 * `phone` is intentionally not selected — these flows don't send SMS.
 */
async function loadLeadWithOrg(leadId: string, orgId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      organization: { select: { name: true } },
    },
  })
  if (!lead) throw new HTTPException(404, { message: 'Lead not found' })
  return lead
}

export function buildNdaUrl(token: string): string {
  return `${PORTAL_URL}/nda/${token}`
}

export async function createNdaForLead(input: {
  leadId: string
  orgId: string
  staffId: string
  contentHtml?: string
}) {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: input.orgId },
    select: { id: true, firstName: true, phone: true },
  })
  if (!lead) throw new HTTPException(404, { message: 'Lead not found' })

  // Sanitize at the service boundary so callers can't bypass it. Empty string
  // after sanitize collapses to null (matches absent-payload semantics).
  const sanitized = input.contentHtml ? sanitizeNdaHtml(input.contentHtml) : ''
  const customContentHtml = sanitized ? sanitized : null

  const token = generateNdaToken()
  const nda = await prisma.ndaAgreement.create({
    data: {
      leadId: lead.id,
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
  await sendNdaInviteSms({ lead, orgId: input.orgId, staffId: input.staffId, url })
  return { nda, url }
}

/**
 * Returns the default v1 NDA content rendered to HTML — used to pre-fill the
 * Tiptap editor when staff opens the customization modal.
 */
export async function getDefaultHtmlForLead(
  leadId: string,
  orgId: string,
): Promise<{ contentHtml: string }> {
  const lead = await loadLeadWithOrg(leadId, orgId)
  // Default deposit mirrors `NdaAgreement.depositAmount` schema default (300.00).
  // Per-org overrides happen at create-time, but the editor seed is generic.
  const vars = buildDefaultTemplateVars({
    lead,
    orgName: lead.organization.name,
    depositAmount: '300.00',
    date: new Date(),
  })
  return { contentHtml: renderDefaultNdaHtml(vars) }
}

/**
 * Renders an in-memory PDF preview of the NDA body. Caller passes the
 * (possibly-edited) HTML; we sanitize then hand off to the same generator the
 * signing path uses, but in `mode: 'preview'` so the signature block + audit
 * footer are suppressed and the footer is replaced with a PREVIEW marker.
 */
export async function renderPreviewPdf(input: {
  leadId: string
  orgId: string
  contentHtml?: string
}): Promise<Buffer> {
  const lead = await loadLeadWithOrg(input.leadId, input.orgId)
  const sanitized = input.contentHtml ? sanitizeNdaHtml(input.contentHtml) : ''
  const customContentHtml = sanitized ? sanitized : null

  return generateSignedPdf({
    ndaAgreement: {
      templateVersion: currentTemplate.version,
      depositAmount: '300.00',
      customContentHtml,
    },
    lead: { firstName: lead.firstName, lastName: lead.lastName },
    organization: { name: lead.organization.name },
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

export async function listNdasForLead(leadId: string, orgId: string) {
  const exists = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
    select: { id: true },
  })
  if (!exists) throw new HTTPException(404, { message: 'Lead not found' })

  const items = await prisma.ndaAgreement.findMany({
    where: { leadId, organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  })
  return items.map((nda) => ({ ...nda, url: buildNdaUrl(nda.token) }))
}

export async function updateDeposit(input: {
  ndaId: string
  leadId: string
  orgId: string
  status: DepositStatus
  note: string | null
  paidAt: Date | null
}) {
  const nda = await prisma.ndaAgreement.findFirst({
    where: { id: input.ndaId, leadId: input.leadId, organizationId: input.orgId },
    select: { id: true, depositStatus: true, depositPaidAt: true },
  })
  if (!nda) throw new HTTPException(404, { message: 'NDA not found' })

  assertDepositTransition(nda.depositStatus as DepositStatus, input.status)

  const data: Prisma.NdaAgreementUpdateInput = {
    depositStatus: input.status,
    depositNote: input.note ?? null,
  }
  if (input.status === 'PAID') {
    data.depositPaidAt = input.paidAt ?? nda.depositPaidAt ?? new Date()
  }
  if (input.status === 'REFUNDED' || input.status === 'FORFEITED') {
    data.depositResolvedAt = new Date()
  }

  return prisma.ndaAgreement.update({ where: { id: nda.id }, data })
}

export async function getPresignedPdfUrl(input: {
  ndaId: string
  leadId: string
  orgId: string
}): Promise<string> {
  const nda = await prisma.ndaAgreement.findFirst({
    where: { id: input.ndaId, leadId: input.leadId, organizationId: input.orgId },
    select: { signedPdfKey: true, status: true },
  })
  if (!nda) throw new HTTPException(404, { message: 'NDA not found' })
  if (nda.status !== 'SIGNED' || !nda.signedPdfKey) {
    throw new HTTPException(409, { message: 'NDA is not signed yet' })
  }
  const url = await getSignedDownloadUrl(nda.signedPdfKey, PRESIGNED_PDF_TTL_SECONDS)
  if (!url) throw new HTTPException(500, { message: 'Failed to generate download URL' })
  return url
}

export async function resendNda(input: {
  ndaId: string
  leadId: string
  orgId: string
  staffId: string
}) {
  const nda = await prisma.ndaAgreement.findFirst({
    where: { id: input.ndaId, leadId: input.leadId, organizationId: input.orgId },
    include: { lead: { select: { id: true, firstName: true, phone: true } } },
  })
  if (!nda) throw new HTTPException(404, { message: 'NDA not found' })
  // `lead` is nullable since leadId became SetNull-on-delete; resend needs a live lead.
  if (!nda.lead) throw new HTTPException(404, { message: 'Lead not found' })
  if (nda.status === 'SIGNED') throw new HTTPException(409, { message: 'NDA already signed' })
  if (nda.status === 'VOIDED') throw new HTTPException(409, { message: 'NDA is voided' })

  // Snapshot `lead` from the initial guard so we don't have to re-narrow after the rotation update.
  const lead = nda.lead
  const needsRotation = !nda.isActive || isExpired(nda.expiresAt)
  let current = nda
  if (needsRotation) {
    current = (await prisma.ndaAgreement.update({
      where: { id: nda.id },
      data: {
        token: generateNdaToken(),
        expiresAt: expiryDate(),
        status: 'SENT',
        isActive: true,
      },
      include: { lead: { select: { id: true, firstName: true, phone: true } } },
    })) as typeof nda
  }

  const url = buildNdaUrl(current.token)
  await sendNdaInviteSms({
    lead,
    orgId: input.orgId,
    staffId: input.staffId,
    url,
  })
  return { nda: current, url, rotated: needsRotation }
}
