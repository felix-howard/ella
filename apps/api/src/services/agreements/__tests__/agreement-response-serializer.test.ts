import { describe, expect, it } from 'vitest'
import {
  agreementPaymentQuoteSummarySelect,
  serializeAgreementResponse,
  type AgreementWithResponseRelations,
} from '../agreement-response-serializer'

describe('agreement response serializer', () => {
  it('does not select payment quote bearer tokens for generic agreement responses', () => {
    expect(agreementPaymentQuoteSummarySelect).not.toHaveProperty('payToken')
  })

  it('strips agreement tokens and payment quote URLs from generic responses', () => {
    const response = serializeAgreementResponse({
      id: 'agreement_1',
      token: 'sign_token',
      paymentQuote: {
        id: 'quote_1',
        status: 'sent',
        payToken: 'quote_pay_token',
        sentAt: null,
        monthlyTotalCents: 25000,
        setupTotalCents: 50000,
      },
    } as unknown as AgreementWithResponseRelations)

    expect(response).not.toHaveProperty('token')
    expect(response.paymentQuote).toEqual({
      id: 'quote_1',
      status: 'sent',
      sentAt: null,
      monthlyTotalCents: 25000,
      setupTotalCents: 50000,
    })
    expect(response.paymentQuote).not.toHaveProperty('payUrl')
    expect(response.paymentQuote).not.toHaveProperty('payToken')
  })
})
