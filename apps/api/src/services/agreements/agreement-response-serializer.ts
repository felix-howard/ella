import type { Prisma } from '@ella/db'

export const agreementStaffSummarySelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.StaffSelect

export const agreementPaymentQuoteSummarySelect = {
  id: true,
  status: true,
  sentAt: true,
  monthlyTotalCents: true,
  setupTotalCents: true,
} satisfies Prisma.PaymentQuoteSelect

export const agreementResponseInclude = {
  createdBy: { select: agreementStaffSummarySelect },
  lastEditedBy: { select: agreementStaffSummarySelect },
  sentBy: { select: agreementStaffSummarySelect },
  voidedBy: { select: agreementStaffSummarySelect },
  paymentQuote: { select: agreementPaymentQuoteSummarySelect },
} satisfies Prisma.AgreementInclude

export type AgreementStaffSummary = Prisma.StaffGetPayload<{
  select: typeof agreementStaffSummarySelect
}>

export type AgreementWithResponseRelations = Prisma.AgreementGetPayload<{
  include: typeof agreementResponseInclude
}>

export interface AgreementPaymentQuoteSummary {
  id: string
  status: string
  sentAt: Date | null
  monthlyTotalCents: number
  setupTotalCents: number
}

export type AgreementResponse = Omit<AgreementWithResponseRelations, 'paymentQuote' | 'token'> & {
  paymentQuote?: AgreementPaymentQuoteSummary | null
  token?: string
  url?: string
}

export function stripAgreementToken<T extends { token?: unknown }>(agreement: T): Omit<T, 'token'> {
  const { token: _token, ...response } = agreement
  void _token
  return response
}

export function serializeAgreementResponse(agreement: AgreementWithResponseRelations): AgreementResponse {
  const { paymentQuote, ...agreementWithoutQuote } = stripAgreementToken(agreement)

  return {
    ...agreementWithoutQuote,
    paymentQuote: paymentQuote ? serializeAgreementPaymentQuote(paymentQuote) : null,
  }
}

function serializeAgreementPaymentQuote(
  paymentQuote: NonNullable<AgreementWithResponseRelations['paymentQuote']>
): AgreementPaymentQuoteSummary {
  return {
    id: paymentQuote.id,
    status: paymentQuote.status,
    sentAt: paymentQuote.sentAt,
    monthlyTotalCents: paymentQuote.monthlyTotalCents,
    setupTotalCents: paymentQuote.setupTotalCents,
  }
}
