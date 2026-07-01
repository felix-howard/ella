import type { AgreementPaymentPortalMode, Prisma } from '@ella/db'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../lib/db'
import type { CheckoutPricingInput } from '../../routes/billing/schemas'
import { calculateCheckoutQuote, CheckoutQuoteError } from '../stripe/quote-calculator'
import { buildCalculatorQuoteInputSnapshot, toPrismaJson } from './quote-send-shared'
import {
  AGREEMENT_PAYMENT_MODES,
  assertCalculatorAgreementEligible,
  assertRecipientInOrganization,
  type AgreementQuoteDb,
  type CalculatorAgreementQuoteInput,
  type CreateFrozenCalculatorAgreementQuoteContext,
  type CreateFrozenCalculatorAgreementQuoteInput,
  type RecipientScopedAgreementQuoteDb,
} from './agreement-quote-types'

export async function createFrozenCalculatorAgreementQuote(
  input: CreateFrozenCalculatorAgreementQuoteInput,
  context: CreateFrozenCalculatorAgreementQuoteContext,
  db: RecipientScopedAgreementQuoteDb = prisma,
): Promise<{ quoteId: string }> {
  await assertRecipientInOrganization(input.recipient, context.organizationId, db)
  const data = buildFrozenQuoteCreateData(input, context)
  await db.paymentQuote.create({ data })
  return { quoteId: data.id }
}

export async function saveFrozenCalculatorAgreementQuoteForAgreement(
  input: {
    agreementId: string
    quote: CalculatorAgreementQuoteInput
    recipient: CreateFrozenCalculatorAgreementQuoteInput['recipient']
  },
  context: CreateFrozenCalculatorAgreementQuoteContext,
  db: AgreementQuoteDb = prisma,
): Promise<{ quoteId: string; paymentPortalMode: AgreementPaymentPortalMode }> {
  const agreement = await db.agreement.findFirst({
    where: {
      id: input.agreementId,
      organizationId: context.organizationId,
      status: { in: ['DRAFT', 'SENT'] },
    },
    select: {
      id: true,
      type: true,
      source: true,
      status: true,
      paymentQuoteId: true,
    },
  })
  if (!agreement) throw new HTTPException(404, { message: 'Draft agreement not found' })
  assertCalculatorAgreementEligible(agreement)

  const paymentPortalMode = await resolveAgreementPaymentPortalMode(
    context.organizationId,
    input.quote.paymentPortalMode,
    db,
  )
  const createData = buildFrozenQuoteCreateData(
    { ...input.quote, recipient: input.recipient },
    context,
  )

  if (agreement.paymentQuoteId) {
    const updated = await db.paymentQuote.updateMany({
      where: {
        id: agreement.paymentQuoteId,
        organizationId: context.organizationId,
        status: 'agreement_draft',
      },
      data: buildFrozenQuoteUpdateData(createData),
    })
    if (updated.count !== 1) {
      throw new HTTPException(409, { message: 'Agreement quote can no longer be updated' })
    }
    await db.agreement.updateMany({
      where: { id: agreement.id, organizationId: context.organizationId, status: agreement.status },
      data: { paymentPortalMode },
    })
    return { quoteId: agreement.paymentQuoteId, paymentPortalMode }
  }

  await db.paymentQuote.create({ data: createData })
  await db.agreement.updateMany({
    where: { id: agreement.id, organizationId: context.organizationId, status: agreement.status },
    data: { paymentQuoteId: createData.id, paymentPortalMode },
  })
  return { quoteId: createData.id, paymentPortalMode }
}

export async function markAgreementQuotePendingSignature(
  input: {
    agreementId: string
    organizationId: string
    paymentPortalMode?: AgreementPaymentPortalMode
  },
  db: AgreementQuoteDb = prisma,
): Promise<void> {
  const agreement = await db.agreement.findFirst({
    where: { id: input.agreementId, organizationId: input.organizationId },
    select: {
      id: true,
      source: true,
      type: true,
      paymentQuoteId: true,
      paymentPortalMode: true,
    },
  })
  if (!agreement?.paymentQuoteId) return
  assertCalculatorAgreementEligible(agreement)

  const paymentPortalMode = await resolveAgreementPaymentPortalMode(
    input.organizationId,
    input.paymentPortalMode === 'NONE' ? undefined : input.paymentPortalMode,
    db,
    agreement.paymentPortalMode,
  )

  await db.agreement.updateMany({
    where: { id: agreement.id, organizationId: input.organizationId },
    data: { paymentPortalMode },
  })
  await db.paymentQuote.updateMany({
    where: {
      id: agreement.paymentQuoteId,
      organizationId: input.organizationId,
      status: 'agreement_draft',
    },
    data: { status: 'agreement_pending_signature' },
  })
}

function buildFrozenQuoteCreateData(
  input: CreateFrozenCalculatorAgreementQuoteInput,
  context: CreateFrozenCalculatorAgreementQuoteContext,
): Prisma.PaymentQuoteCreateInput & { id: string } {
  assertNoCalculatorBusinessTaxPrepay(input.pricingInput)
  const quote = calculateCheckoutQuote(input.pricingInput)
  return {
    id: quote.quoteId,
    organization: { connect: { id: context.organizationId } },
    ...(input.recipient.type === 'client'
      ? { client: { connect: { id: input.recipient.id } } }
      : { lead: { connect: { id: input.recipient.id } } }),
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    businessName: input.businessName,
    inputSnapshot: toPrismaJson(buildCalculatorQuoteInputSnapshot(input)),
    resultSnapshot: toPrismaJson(quote),
    monthlyTotalCents: Math.round(quote.monthlyTotal * 100),
    setupTotalCents: Math.round(quote.setupTotal * 100),
    source: 'calculator',
    billingInterval: null,
    status: 'agreement_draft',
    createdByStaff: { connect: { id: context.staffId } },
  }
}

function buildFrozenQuoteUpdateData(
  data: Prisma.PaymentQuoteCreateInput,
): Prisma.PaymentQuoteUpdateManyMutationInput {
  return {
    customerEmail: data.customerEmail,
    customerName: data.customerName,
    businessName: data.businessName,
    inputSnapshot: data.inputSnapshot,
    resultSnapshot: data.resultSnapshot,
    monthlyTotalCents: data.monthlyTotalCents,
    setupTotalCents: data.setupTotalCents,
    source: 'calculator',
    billingInterval: null,
    status: 'agreement_draft',
    payToken: null,
    sentAt: null,
  }
}

async function resolveAgreementPaymentPortalMode(
  organizationId: string,
  requestedMode: AgreementPaymentPortalMode | undefined,
  db: AgreementQuoteDb,
  existingMode?: AgreementPaymentPortalMode,
): Promise<AgreementPaymentPortalMode> {
  if (requestedMode && AGREEMENT_PAYMENT_MODES.has(requestedMode)) return requestedMode
  if (existingMode && AGREEMENT_PAYMENT_MODES.has(existingMode)) return existingMode
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { calculatorAgreementPaymentMode: true },
  })
  return org?.calculatorAgreementPaymentMode ?? 'AUTO_SEND'
}

function assertNoCalculatorBusinessTaxPrepay(pricingInput: CheckoutPricingInput): void {
  if (pricingInput.oneTime.businessTaxReturn <= 0) return
  throw new CheckoutQuoteError('Business tax return yearly pre-pay must be created through Custom link')
}
