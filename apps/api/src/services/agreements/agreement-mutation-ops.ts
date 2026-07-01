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
import { ActivityRiskLevel, type AgreementStatus, type Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { generateAgreementToken, expiryDate, isExpired, clampExpiryDays } from './token-service'
import {
  sendAgreementInviteSmsBestEffort,
  sendAgreementInviteSmsForClientBestEffort,
} from './agreement-sms'
import { assertDepositTransition, type DepositStatus } from '../../routes/agreements/helpers'
import { type EntityType } from './entity-loader'
import { buildAgreementUrl, agreementScopeWhere } from './agreement-shared'
import { assertNoActiveNdaEngagement, lockAgreementEntity } from './agreement-content-resolution'
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_CATEGORIES,
  ACTIVITY_TARGET_TYPES,
} from '../activity-actions'
import { logStaffActivity, type AuditRequestContext } from '../activity-log'
import {
  agreementResponseInclude,
  serializeAgreementResponse,
} from './agreement-response-serializer'
import { activateAgreementQuotePaymentPortal } from '../payments/agreement-quote-service'

const LINK_MUTATION_STATUSES: AgreementStatus[] = ['SENT', 'EXPIRED']
const VOIDABLE_AGREEMENT_STATUSES: AgreementStatus[] = ['SENT', 'EXPIRED']

function assertAgreementAllowsLinkRefresh(status: AgreementStatus) {
  if (status === 'DRAFT') {
    throw new HTTPException(409, { message: 'Draft agreement must be sent from the draft workflow' })
  }
  if (status === 'SIGNED') {
    throw new HTTPException(409, { message: 'Agreement already signed' })
  }
  if (status === 'VOIDED') {
    throw new HTTPException(409, { message: 'Agreement is voided' })
  }
}

function linkMutationWhere(input: {
  entityType: EntityType
  entityId: string
  agreementId: string
  orgId: string
}) {
  return {
    id: input.agreementId,
    ...agreementScopeWhere(input.entityType, input.entityId),
    organizationId: input.orgId,
    status: { in: LINK_MUTATION_STATUSES },
  }
}

function assertAgreementAllowsVoid(status: AgreementStatus) {
  if (status === 'DRAFT') {
    throw new HTTPException(409, { message: 'Draft agreement must use the discard draft flow' })
  }
  if (status === 'SIGNED') {
    throw new HTTPException(409, { message: 'Signed agreement cannot be voided' })
  }
  if (status === 'VOIDED') {
    throw new HTTPException(409, { message: 'Agreement is already voided' })
  }
}

async function guardLinkRefresh(
  tx: Prisma.TransactionClient,
  input: { entityType: EntityType; entityId: string; agreementId: string; orgId: string },
  agreementType: string,
) {
  await lockAgreementEntity(tx, {
    entityType: input.entityType,
    entityId: input.entityId,
    orgId: input.orgId,
  })
  if (agreementType !== 'NDA') return
  await assertNoActiveNdaEngagement(
    {
      entityType: input.entityType,
      entityId: input.entityId,
      orgId: input.orgId,
      excludeAgreementId: input.agreementId,
    },
    tx,
  )
}

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
    select: { id: true, status: true, depositStatus: true, depositPaidAt: true },
  })
  if (!agreement) throw new HTTPException(404, { message: 'Agreement not found' })
  if (agreement.status === 'DRAFT') {
    throw new HTTPException(409, { message: 'Draft agreement must be sent before deposit updates' })
  }

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
  assertAgreementAllowsLinkRefresh(agreement.status)

  const recipient = {
    id: recipientRaw.id,
    firstName: recipientRaw.firstName ?? '',
    phone: recipientRaw.phone,
  }
  let current = agreement
  let rotated = false
  const needsRotation = !agreement.isActive || isExpired(agreement.expiresAt)
  if (needsRotation) {
    const result = await prisma.$transaction(async (tx) => {
      await guardLinkRefresh(tx, input, agreement.type)
      const latest = await tx.agreement.findFirst({
        where: {
          id: agreement.id,
          ...agreementScopeWhere(input.entityType, input.entityId),
          organizationId: input.orgId,
        },
        include: {
          lead: recipientSelect,
          client: recipientSelect,
          organization: { select: { name: true } },
        },
      })
      if (!latest) throw new HTTPException(404, { message: 'Agreement not found' })
      assertAgreementAllowsLinkRefresh(latest.status)
      if (latest.isActive && !isExpired(latest.expiresAt)) {
        return { agreement: latest, rotated: false }
      }

      const updateResult = await tx.agreement.updateMany({
        where: linkMutationWhere(input),
        data: {
          token: generateAgreementToken(),
          expiresAt: expiryDate(latest.expiryDays),
          status: 'SENT',
          isActive: true,
        },
      })
      if (updateResult.count !== 1) {
        throw new HTTPException(409, { message: 'Agreement is no longer available for resend' })
      }
      const rotated = await tx.agreement.findFirst({
        where: {
          id: agreement.id,
          ...agreementScopeWhere(input.entityType, input.entityId),
          organizationId: input.orgId,
        },
        include: {
          lead: recipientSelect,
          client: recipientSelect,
          organization: { select: { name: true } },
        },
      })
      if (!rotated) throw new HTTPException(404, { message: 'Agreement not found' })
      return { agreement: rotated, rotated: true }
    })
    current = result.agreement
    rotated = result.rotated
  }

  const url = buildAgreementUrl(current.token)
  const orgName = current.organization.name
  if (input.entityType === 'lead') {
    await sendAgreementInviteSmsBestEffort({
      lead: recipient,
      orgId: input.orgId,
      staffId: input.staffId,
      url,
      title: current.title,
      orgName,
    })
  } else {
    await sendAgreementInviteSmsForClientBestEffort({
      client: recipient,
      orgId: input.orgId,
      staffId: input.staffId,
      url,
      title: current.title,
      orgName,
    })
  }
  return { agreement: current, url, rotated }
}

/** Legacy alias retained for transitional callers + tests. */
export const resendNdaForEntity = resendAgreementForEntity

export async function voidAgreementForEntity(input: {
  entityType: EntityType
  entityId: string
  agreementId: string
  orgId: string
  staffId: string
  reason: string
  request?: AuditRequestContext
}) {
  const reason = input.reason.trim()
  const agreement = await prisma.agreement.findFirst({
    where: {
      id: input.agreementId,
      ...agreementScopeWhere(input.entityType, input.entityId),
      organizationId: input.orgId,
    },
    select: { id: true, status: true, title: true, type: true },
  })
  if (!agreement) throw new HTTPException(404, { message: 'Agreement not found' })
  assertAgreementAllowsVoid(agreement.status)

  const voidedAt = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.agreement.updateMany({
      where: {
        id: input.agreementId,
        ...agreementScopeWhere(input.entityType, input.entityId),
        organizationId: input.orgId,
        status: { in: VOIDABLE_AGREEMENT_STATUSES },
      },
      data: {
        status: 'VOIDED',
        isActive: false,
        voidedAt,
        voidedByUserId: input.staffId,
        voidReason: reason,
      },
    })

    if (result.count !== 1) {
      const latest = await tx.agreement.findFirst({
        where: {
          id: input.agreementId,
          ...agreementScopeWhere(input.entityType, input.entityId),
          organizationId: input.orgId,
        },
        select: { status: true },
      })
      if (!latest) throw new HTTPException(404, { message: 'Agreement not found' })
      assertAgreementAllowsVoid(latest.status)
      throw new HTTPException(409, { message: 'Agreement is no longer available for voiding' })
    }

    return tx.agreement.findFirst({
      where: {
        id: input.agreementId,
        ...agreementScopeWhere(input.entityType, input.entityId),
        organizationId: input.orgId,
      },
      include: agreementResponseInclude,
    })
  })
  if (!updated) throw new HTTPException(404, { message: 'Agreement not found' })

  await logStaffActivity({
    organizationId: input.orgId,
    actorStaffId: input.staffId,
    action: ACTIVITY_ACTIONS.AGREEMENT.VOIDED,
    category: ACTIVITY_CATEGORIES.AGREEMENT,
    targetType: ACTIVITY_TARGET_TYPES.AGREEMENT,
    targetId: updated.id,
    targetLabel: updated.title,
    summary: `Revoked agreement ${updated.title}`,
    riskLevel: ActivityRiskLevel.MEDIUM,
    metadata: {
      agreementId: updated.id,
      agreementType: updated.type,
      entityType: input.entityType,
      entityId: input.entityId,
      previousStatus: agreement.status,
      nextStatus: 'VOIDED',
      reasonProvided: reason.length > 0,
      reasonLength: reason.length,
    },
    request: input.request,
  })

  return serializeAgreementResponse(updated)
}

/**
 * Push the link's expiry forward without rotating the token or sending SMS.
 * Optionally updates `expiryDays` so future resends keep the new duration.
 * Refuses on terminal statuses (SIGNED, VOIDED) — extending a closed agreement
 * has no useful semantics.
 */
export async function extendAgreementForEntity(input: {
  entityType: EntityType
  entityId: string
  agreementId: string
  orgId: string
  /** New validity window from now. Clamped; defaults to the agreement's stored expiryDays. */
  days?: number | null
}) {
  const agreement = await prisma.agreement.findFirst({
    where: {
      id: input.agreementId,
      ...agreementScopeWhere(input.entityType, input.entityId),
      organizationId: input.orgId,
    },
    select: { id: true, status: true, type: true, expiryDays: true },
  })
  if (!agreement) throw new HTTPException(404, { message: 'Agreement not found' })
  assertAgreementAllowsLinkRefresh(agreement.status)

  const days = clampExpiryDays(input.days ?? agreement.expiryDays)
  const updated = await prisma.$transaction(async (tx) => {
    await guardLinkRefresh(tx, input, agreement.type)
    const updateResult = await tx.agreement.updateMany({
      where: linkMutationWhere(input),
      data: {
        expiresAt: expiryDate(days),
        expiryDays: days,
        isActive: true,
        status: 'SENT',
      },
    })
    if (updateResult.count !== 1) {
      throw new HTTPException(409, { message: 'Agreement is no longer available for extension' })
    }
    return tx.agreement.findFirst({
      where: {
        id: agreement.id,
        ...agreementScopeWhere(input.entityType, input.entityId),
        organizationId: input.orgId,
      },
    })
  })
  if (!updated) throw new HTTPException(404, { message: 'Agreement not found' })
  return updated
}

export async function sendAgreementPaymentPortalForEntity(input: {
  entityType: EntityType
  entityId: string
  agreementId: string
  orgId: string
  staffId: string
}) {
  return activateAgreementQuotePaymentPortal({
    agreementId: input.agreementId,
    orgId: input.orgId,
    staffId: input.staffId,
    entityType: input.entityType,
    entityId: input.entityId,
    requireStaffReviewMode: true,
  })
}
