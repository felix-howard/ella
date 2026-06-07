/**
 * Post-sign side effects: admin "client signed" SMS fan-out.
 *
 * Runs AFTER the signing transaction commits — must never throw back into the
 * signing flow. Callers fire-and-forget with their own catch; everything here
 * is additionally isolated per-recipient via Promise.allSettled.
 *
 * Recipients: ADMINs in the agreement's organization who opted in
 * (`notifyOnAgreementSigned`) and have a valid E.164 phone number.
 */
import { prisma } from '../../lib/db'
// Direct module import (not the ../sms barrel) keeps the Stripe webhook's
// import graph free of the MMS/AI handler chain.
import { sendSms, isTwilioConfigured, isValidPhoneNumber } from '../sms/twilio-client'
import {
  buildAdminAgreementSignedMessage,
  formatUsdAmount,
} from '../payments/payment-sms-templates'

/**
 * Narrow snapshot of a just-signed agreement handed to post-sign side effects
 * (admin notify + deposit payment creation). Built by the signing service from
 * the already-loaded agreement so side effects don't re-query the row.
 */
export interface PostSignAgreementContext {
  id: string
  organizationId: string
  orgName: string
  title: string
  createdByUserId: string
  /** Both FKs forwarded as-is — lead-originated agreements may carry a clientId post-conversion. */
  leadId: string | null
  clientId: string | null
  depositAmount: { toString(): string } | null
  depositStatus: string | null
  signer: {
    id: string
    firstName: string
    lastName: string | null
    kind: 'lead' | 'client'
  }
}

/** SMS every opted-in ADMIN with a phone: "{Client name} signed {agreement title}". */
export async function notifyAdminsAgreementSigned(
  ctx: PostSignAgreementContext,
): Promise<void> {
  const signerName = [ctx.signer.firstName, ctx.signer.lastName].filter(Boolean).join(' ')
  const hasDeposit =
    ctx.depositAmount !== null && Number(ctx.depositAmount.toString()) > 0
  const message = buildAdminAgreementSignedMessage({
    signerName,
    agreementTitle: ctx.title,
    amountFormatted: hasDeposit && ctx.depositAmount ? formatUsdAmount(ctx.depositAmount) : null,
  })

  await smsOptedInAdmins({
    organizationId: ctx.organizationId,
    toggle: 'notifyOnAgreementSigned',
    message,
    logContext: `agreement=${ctx.id} signed`,
  })
}

/**
 * Generic ADMIN SMS fan-out gated by a per-staff opt-in toggle. Shared by the
 * agreement-signed (phase 2) and payment-received (phase 3) notifications.
 *
 * ADMIN-only by locked product decision — MANAGER is intentionally excluded
 * from agreement-signed/payment notifications (see plan brainstorm).
 */
export async function smsOptedInAdmins(params: {
  organizationId: string
  toggle: 'notifyOnAgreementSigned' | 'notifyOnClientPayment'
  message: string
  /** Human-readable context for failure logs, e.g. `agreement=abc signed`. */
  logContext: string
}): Promise<void> {
  if (!isTwilioConfigured()) {
    console.warn(
      `[Notify] Twilio not configured — skipping admin SMS (${params.logContext})`,
    )
    return
  }

  const admins = await prisma.staff.findMany({
    where: {
      organizationId: params.organizationId,
      role: 'ADMIN',
      isActive: true,
      [params.toggle]: true,
      phoneNumber: { not: null },
    },
    select: { id: true, phoneNumber: true },
  })
  if (admins.length === 0) return

  const results = await Promise.allSettled(
    admins.map(async (admin) => {
      const phone = admin.phoneNumber
      if (!phone || !isValidPhoneNumber(phone)) {
        throw new Error(`invalid phone for staff=${admin.id}`)
      }
      const result = await sendSms({ to: phone, body: params.message })
      if (!result.success) {
        throw new Error(`staff=${admin.id}: ${result.error ?? 'unknown'}`)
      }
    }),
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(
        `[Notify] Admin SMS failed (${params.logContext}): ${String(result.reason)}`,
      )
    }
  }
}
