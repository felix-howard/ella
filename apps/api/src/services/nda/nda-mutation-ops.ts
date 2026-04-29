/**
 * Entity-aware NDA mutations: deposit transitions and resend (token rotation
 * on expiry). Both branch on entityType for FK scoping; resend resolves the
 * recipient from whichever FK (lead xor client) is populated on the row.
 */
import { HTTPException } from 'hono/http-exception'
import type { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { generateNdaToken, expiryDate, isExpired } from './token-service'
import { sendNdaInviteSms, sendNdaInviteSmsForClient } from './nda-sms'
import { assertDepositTransition, type DepositStatus } from '../../routes/nda/helpers'
import { type EntityType } from './entity-loader'
import { buildNdaUrl, ndaScopeWhere } from './nda-shared'

export async function updateDepositForEntity(input: {
  entityType: EntityType
  entityId: string
  ndaId: string
  orgId: string
  status: DepositStatus
  note: string | null
  paidAt: Date | null
}) {
  const nda = await prisma.ndaAgreement.findFirst({
    where: {
      id: input.ndaId,
      ...ndaScopeWhere(input.entityType, input.entityId),
      organizationId: input.orgId,
    },
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

export async function resendNdaForEntity(input: {
  entityType: EntityType
  entityId: string
  ndaId: string
  orgId: string
  staffId: string
}) {
  // Include both lead and client so the recipient can be resolved against the
  // FK matching `entityType`. SetNull-on-delete may orphan a row (FK column
  // set but relation is null) — orphans yield 404 below.
  const recipientSelect = { select: { id: true, firstName: true, phone: true } }
  const nda = await prisma.ndaAgreement.findFirst({
    where: {
      id: input.ndaId,
      ...ndaScopeWhere(input.entityType, input.entityId),
      organizationId: input.orgId,
    },
    include: { lead: recipientSelect, client: recipientSelect },
  })
  if (!nda) throw new HTTPException(404, { message: 'NDA not found' })

  const recipientRaw = input.entityType === 'lead' ? nda.lead : nda.client
  if (!recipientRaw) {
    throw new HTTPException(404, {
      message: `${input.entityType === 'lead' ? 'Lead' : 'Client'} not found`,
    })
  }
  if (!recipientRaw.phone?.trim()) {
    throw new HTTPException(422, { message: 'Phone required' })
  }
  if (nda.status === 'SIGNED') throw new HTTPException(409, { message: 'NDA already signed' })
  if (nda.status === 'VOIDED') throw new HTTPException(409, { message: 'NDA is voided' })

  const recipient = {
    id: recipientRaw.id,
    firstName: recipientRaw.firstName ?? '',
    phone: recipientRaw.phone,
  }
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
      include: { lead: recipientSelect, client: recipientSelect },
    })) as typeof nda
  }

  const url = buildNdaUrl(current.token)
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
  return { nda: current, url, rotated: needsRotation }
}
