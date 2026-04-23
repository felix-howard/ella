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
import { generateNdaToken, expiryDate, isExpired } from './token-service'
import { sendNdaInviteSms } from './nda-sms'
import { assertDepositTransition, type DepositStatus } from '../../routes/nda/helpers'

const PRESIGNED_PDF_TTL_SECONDS = 900 // 15 min

export function buildNdaUrl(token: string): string {
  return `${PORTAL_URL}/nda/${token}`
}

export async function createNdaForLead(input: {
  leadId: string
  orgId: string
  staffId: string
}) {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: input.orgId },
    select: { id: true, firstName: true, phone: true },
  })
  if (!lead) throw new HTTPException(404, { message: 'Lead not found' })

  const token = generateNdaToken()
  const nda = await prisma.ndaAgreement.create({
    data: {
      leadId: lead.id,
      organizationId: input.orgId,
      createdByUserId: input.staffId,
      templateVersion: currentTemplate.version,
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
  if (nda.status === 'SIGNED') throw new HTTPException(409, { message: 'NDA already signed' })
  if (nda.status === 'VOIDED') throw new HTTPException(409, { message: 'NDA is voided' })

  const needsRotation = !nda.isActive || isExpired(nda.expiresAt)
  let current = nda
  if (needsRotation) {
    current = await prisma.ndaAgreement.update({
      where: { id: nda.id },
      data: {
        token: generateNdaToken(),
        expiresAt: expiryDate(),
        status: 'SENT',
        isActive: true,
      },
      include: { lead: { select: { id: true, firstName: true, phone: true } } },
    })
  }

  const url = buildNdaUrl(current.token)
  await sendNdaInviteSms({
    lead: current.lead,
    orgId: input.orgId,
    staffId: input.staffId,
    url,
  })
  return { nda: current, url, rotated: needsRotation }
}
