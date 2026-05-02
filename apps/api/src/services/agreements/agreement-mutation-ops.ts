/**
 * Entity-aware agreement mutations: deposit transitions and resend (token
 * rotation on expiry). Both branch on entityType for FK scoping; resend
 * resolves the recipient from whichever FK (lead xor client) is populated on
 * the row.
 *
 * Deposit transitions only apply when the agreement carries a deposit
 * (depositStatus is non-null). Otherwise, callers receive 409.
 */
import { HTTPException } from 'hono/http-exception'
import type { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { generateAgreementToken, expiryDate, isExpired } from './token-service'
import { sendAgreementInviteSms, sendAgreementInviteSmsForClient } from './agreement-sms'
import { assertDepositTransition, type DepositStatus } from '../../routes/agreements/helpers'
import { type EntityType } from './entity-loader'
import { buildAgreementUrl, agreementScopeWhere } from './agreement-shared'

export async function updateDepositForEntity(input: {
  entityType: EntityType
  entityId: string
  agreementId: string
  orgId: string
  status: DepositStatus
  note: string | null
  paidAt: Date | null
}) {
  const agreement = await prisma.agreement.findFirst({
    where: {
      id: input.agreementId,
      ...agreementScopeWhere(input.entityType, input.entityId),
      organizationId: input.orgId,
    },
    select: { id: true, depositStatus: true, depositPaidAt: true },
  })
  if (!agreement) throw new HTTPException(404, { message: 'Agreement not found' })

  // Deposit fields are now nullable per-send. Refuse mutations on no-deposit rows.
  if (agreement.depositStatus == null) {
    throw new HTTPException(409, { message: 'Agreement has no deposit configured' })
  }

  assertDepositTransition(agreement.depositStatus as DepositStatus, input.status)

  const data: Prisma.AgreementUpdateInput = {
    depositStatus: input.status,
    depositNote: input.note ?? null,
  }
  if (input.status === 'PAID') {
    data.depositPaidAt = input.paidAt ?? agreement.depositPaidAt ?? new Date()
  }
  if (input.status === 'REFUNDED' || input.status === 'FORFEITED') {
    data.depositResolvedAt = new Date()
  }

  return prisma.agreement.update({ where: { id: agreement.id }, data })
}

export async function resendAgreementForEntity(input: {
  entityType: EntityType
  entityId: string
  agreementId: string
  orgId: string
  staffId: string
}) {
  // Include both lead and client so the recipient can be resolved against the
  // FK matching `entityType`. SetNull-on-delete may orphan a row (FK column
  // set but relation is null) — orphans yield 404 below.
  const recipientSelect = { select: { id: true, firstName: true, phone: true } }
  const agreement = await prisma.agreement.findFirst({
    where: {
      id: input.agreementId,
      ...agreementScopeWhere(input.entityType, input.entityId),
      organizationId: input.orgId,
    },
    include: {
      lead: recipientSelect,
      client: recipientSelect,
      organization: { select: { name: true } },
    },
  })
  if (!agreement) throw new HTTPException(404, { message: 'Agreement not found' })

  const recipientRaw = input.entityType === 'lead' ? agreement.lead : agreement.client
  if (!recipientRaw) {
    throw new HTTPException(404, {
      message: `${input.entityType === 'lead' ? 'Lead' : 'Client'} not found`,
    })
  }
  if (!recipientRaw.phone?.trim()) {
    throw new HTTPException(422, { message: 'Phone required' })
  }
  if (agreement.status === 'SIGNED') {
    throw new HTTPException(409, { message: 'Agreement already signed' })
  }
  if (agreement.status === 'VOIDED') {
    throw new HTTPException(409, { message: 'Agreement is voided' })
  }

  const recipient = {
    id: recipientRaw.id,
    firstName: recipientRaw.firstName ?? '',
    phone: recipientRaw.phone,
  }
  const needsRotation = !agreement.isActive || isExpired(agreement.expiresAt)
  let current = agreement
  if (needsRotation) {
    current = (await prisma.agreement.update({
      where: { id: agreement.id },
      data: {
        token: generateAgreementToken(),
        expiresAt: expiryDate(),
        status: 'SENT',
        isActive: true,
      },
      include: {
        lead: recipientSelect,
        client: recipientSelect,
        organization: { select: { name: true } },
      },
    })) as typeof agreement
  }

  const url = buildAgreementUrl(current.token)
  const orgName = agreement.organization.name
  if (input.entityType === 'lead') {
    await sendAgreementInviteSms({
      lead: recipient,
      orgId: input.orgId,
      staffId: input.staffId,
      url,
      title: agreement.title,
      orgName,
    })
  } else {
    await sendAgreementInviteSmsForClient({
      client: recipient,
      orgId: input.orgId,
      staffId: input.staffId,
      url,
      title: agreement.title,
      orgName,
    })
  }
  return { agreement: current, url, rotated: needsRotation }
}

/** Legacy alias retained for transitional callers + tests. */
export const resendNdaForEntity = resendAgreementForEntity
