/**
 * Tests for SMS template builders.
 * Pure deterministic string builders with no mocks — verify exact copy strings.
 */
import { describe, expect, it } from 'vitest'
import {
  buildDepositPayLinkMessage,
  buildDepositReceiptMessage,
  buildAdminAgreementSignedMessage,
  buildAdminPaymentReceivedMessage,
  buildQuotePayLinkMessage,
  buildQuoteReceiptMessage,
  buildAdminQuotePaidMessage,
  buildAdminPaymentFailedMessage,
  formatUsdAmount,
  DEPOSIT_PAY_LINK_TEMPLATE_NAME,
  DEPOSIT_RECEIPT_TEMPLATE_NAME,
  QUOTE_PAY_LINK_TEMPLATE_NAME,
  QUOTE_RECEIPT_TEMPLATE_NAME,
} from '../payment-sms-templates'

describe('formatUsdAmount', () => {
  it('formats numeric string as USD', () => {
    expect(formatUsdAmount({ toString: () => '300' })).toBe('$300.00')
    expect(formatUsdAmount({ toString: () => '300.50' })).toBe('$300.50')
    expect(formatUsdAmount({ toString: () => '0' })).toBe('$0.00')
  })

  it('formats integer as USD', () => {
    expect(formatUsdAmount({ toString: () => '1000' })).toBe('$1000.00')
  })

  it('handles high precision input (truncates to 2 decimals)', () => {
    expect(formatUsdAmount({ toString: () => '100.999' })).toBe('$101.00')
  })

  it('falls back to string when NaN', () => {
    expect(formatUsdAmount({ toString: () => 'invalid' })).toBe('$invalid')
  })
})

describe('template name constants', () => {
  it('exports unique template names', () => {
    const names = [
      DEPOSIT_PAY_LINK_TEMPLATE_NAME,
      DEPOSIT_RECEIPT_TEMPLATE_NAME,
      QUOTE_PAY_LINK_TEMPLATE_NAME,
      QUOTE_RECEIPT_TEMPLATE_NAME,
    ]

    expect(new Set(names).size).toBe(4)
  })

  it('exports expected template names', () => {
    expect(DEPOSIT_PAY_LINK_TEMPLATE_NAME).toBe('deposit_pay_link')
    expect(DEPOSIT_RECEIPT_TEMPLATE_NAME).toBe('deposit_receipt')
    expect(QUOTE_PAY_LINK_TEMPLATE_NAME).toBe('quote_pay_link')
    expect(QUOTE_RECEIPT_TEMPLATE_NAME).toBe('quote_receipt')
  })
})

describe('deposit pay-link message', () => {
  it('builds message with client name, amount, and pay link', () => {
    const message = buildDepositPayLinkMessage({
      firstName: 'Anna',
      amountFormatted: '$300.00',
      url: 'http://portal.test/pay/tok_abc',
    })

    expect(message).toContain('Anna')
    expect(message).toContain('$300.00')
    expect(message).toContain('http://portal.test/pay/tok_abc')
  })

  it('includes retainer language', () => {
    const message = buildDepositPayLinkMessage({
      firstName: 'John',
      amountFormatted: '$1000.00',
      url: 'http://pay.test',
    })

    expect(message).toContain('retainer')
  })

  it('matches exact copy format', () => {
    const message = buildDepositPayLinkMessage({
      firstName: 'Test',
      amountFormatted: '$500.00',
      url: 'http://url.test',
    })

    expect(message).toMatch(/Hi Test, thanks for signing!/)
    expect(message).toMatch(/Please pay your \$500\.00 retainer/)
  })
})

describe('deposit receipt message', () => {
  it('builds message with client name and amount', () => {
    const message = buildDepositReceiptMessage({
      firstName: 'Bao',
      amountFormatted: '$1000.00',
    })

    expect(message).toContain('Bao')
    expect(message).toContain('$1000.00')
  })

  it('includes retainer language', () => {
    const message = buildDepositReceiptMessage({
      firstName: 'Anna',
      amountFormatted: '$300.00',
    })

    expect(message).toContain('retainer')
    expect(message).toContain('payment')
  })

  it('matches exact copy format', () => {
    const message = buildDepositReceiptMessage({
      firstName: 'Test',
      amountFormatted: '$250.00',
    })

    expect(message).toBe('Hi Test, we received your $250.00 retainer payment. Thank you!')
  })
})

describe('admin agreement signed message', () => {
  it('builds message with signer name and agreement title', () => {
    const message = buildAdminAgreementSignedMessage({
      signerName: 'John Client',
      agreementTitle: '2026 Engagement Letter',
      amountFormatted: null,
    })

    expect(message).toContain('John Client')
    expect(message).toContain('2026 Engagement Letter')
  })

  it('includes deposit amount when provided', () => {
    const message = buildAdminAgreementSignedMessage({
      signerName: 'Anna',
      agreementTitle: 'Service Agreement',
      amountFormatted: '$300.00',
    })

    expect(message).toContain('$300.00')
    expect(message).toContain('deposit')
  })

  it('omits deposit suffix when amount is null', () => {
    const message = buildAdminAgreementSignedMessage({
      signerName: 'Test',
      agreementTitle: 'Agreement',
      amountFormatted: null,
    })

    expect(message).not.toContain('deposit')
    expect(message).toBe('Test signed Agreement')
  })

  it('marks deposit as pending in the suffix', () => {
    const message = buildAdminAgreementSignedMessage({
      signerName: 'User',
      agreementTitle: 'Letter',
      amountFormatted: '$500.00',
    })

    expect(message).toContain('pending')
  })
})

describe('admin payment received message', () => {
  it('builds message with payer name and amount', () => {
    const message = buildAdminPaymentReceivedMessage({
      payerName: 'John Client',
      amountFormatted: '$300.00',
      agreementTitle: null,
    })

    expect(message).toContain('John Client')
    expect(message).toContain('$300.00')
  })

  it('includes agreement title in suffix when provided', () => {
    const message = buildAdminPaymentReceivedMessage({
      payerName: 'Anna',
      amountFormatted: '$500.00',
      agreementTitle: '2026 Engagement Letter',
    })

    expect(message).toContain('2026 Engagement Letter')
    expect(message).toContain('for')
  })

  it('omits agreement title suffix when null', () => {
    const message = buildAdminPaymentReceivedMessage({
      payerName: 'Test',
      amountFormatted: '$100.00',
      agreementTitle: null,
    })

    expect(message).toBe('Test paid $100.00')
  })

  it('matches exact copy format with agreement', () => {
    const message = buildAdminPaymentReceivedMessage({
      payerName: 'John',
      amountFormatted: '$250.00',
      agreementTitle: 'Contract',
    })

    expect(message).toBe('John paid $250.00 for Contract')
  })
})

describe('quote pay-link message', () => {
  it('builds message with client name, org name, and pay link', () => {
    const message = buildQuotePayLinkMessage({
      firstName: 'John',
      orgName: 'Acme Tax',
      url: 'http://portal.test/quote/tok_xyz',
    })

    expect(message).toContain('John')
    expect(message).toContain('Acme Tax')
    expect(message).toContain('http://portal.test/quote/tok_xyz')
  })

  it('includes quote and review language', () => {
    const message = buildQuotePayLinkMessage({
      firstName: 'Anna',
      orgName: 'Corp',
      url: 'http://url.test',
    })

    expect(message).toContain('quote')
    expect(message).toContain('Review')
    expect(message).toContain('pay')
  })

  it('matches exact copy format', () => {
    const message = buildQuotePayLinkMessage({
      firstName: 'Test',
      orgName: 'Company',
      url: 'http://example.test',
    })

    expect(message).toMatch(/Hi Test, here's your quote from Company\./)
    expect(message).toMatch(/Review and pay here: http:\/\/example\.test/)
  })

  it('differs from deposit pay-link copy', () => {
    const depositMsg = buildDepositPayLinkMessage({
      firstName: 'John',
      amountFormatted: '$300.00',
      url: 'http://url.test',
    })

    const quoteMsg = buildQuotePayLinkMessage({
      firstName: 'John',
      orgName: 'Acme',
      url: 'http://url.test',
    })

    expect(depositMsg).not.toBe(quoteMsg)
  })
})

describe('quote receipt message', () => {
  it('builds message with client name and amount', () => {
    const message = buildQuoteReceiptMessage({
      firstName: 'Anna',
      amountFormatted: '$500.00',
    })

    expect(message).toContain('Anna')
    expect(message).toContain('$500.00')
  })

  it('matches exact copy format', () => {
    const message = buildQuoteReceiptMessage({
      firstName: 'Test',
      amountFormatted: '$1000.00',
    })

    expect(message).toBe('Hi Test, we received your $1000.00 payment. Thank you!')
  })

  it('differs from deposit receipt copy', () => {
    const depositMsg = buildDepositReceiptMessage({
      firstName: 'John',
      amountFormatted: '$300.00',
    })

    const quoteMsg = buildQuoteReceiptMessage({
      firstName: 'John',
      amountFormatted: '$300.00',
    })

    expect(depositMsg).not.toBe(quoteMsg)
    expect(depositMsg).toContain('retainer')
    expect(quoteMsg).not.toContain('retainer')
  })
})

describe('admin quote paid message', () => {
  it('builds message with payer name and amount', () => {
    const message = buildAdminQuotePaidMessage({
      payerName: 'John Client',
      amountFormatted: '$300.00',
    })

    expect(message).toContain('John Client')
    expect(message).toContain('$300.00')
  })

  it('marks as quote in parenthetical', () => {
    const message = buildAdminQuotePaidMessage({
      payerName: 'Anna',
      amountFormatted: '$500.00',
    })

    expect(message).toContain('(quote)')
  })

  it('matches exact copy format', () => {
    const message = buildAdminQuotePaidMessage({
      payerName: 'Test',
      amountFormatted: '$750.00',
    })

    expect(message).toBe('Test paid $750.00 (quote)')
  })

  it('differs from admin payment received for regular payment', () => {
    const quoteMsg = buildAdminQuotePaidMessage({
      payerName: 'John',
      amountFormatted: '$300.00',
    })

    const regularMsg = buildAdminPaymentReceivedMessage({
      payerName: 'John',
      amountFormatted: '$300.00',
      agreementTitle: null,
    })

    expect(quoteMsg).not.toBe(regularMsg)
    expect(quoteMsg).toContain('quote')
    expect(regularMsg).not.toContain('quote')
  })
})

describe('admin payment failed message', () => {
  it('builds message with payer name and amount', () => {
    const message = buildAdminPaymentFailedMessage({
      payerName: 'John Client',
      amountFormatted: '$300.00',
    })

    expect(message).toContain('John Client')
    expect(message).toContain('$300.00')
  })

  it('includes failure and follow-up language', () => {
    const message = buildAdminPaymentFailedMessage({
      payerName: 'Anna',
      amountFormatted: '$500.00',
    })

    expect(message).toContain('Payment failed')
    expect(message).toContain("couldn't collect")
    expect(message).toContain('Follow up')
    expect(message).toContain('card')
  })

  it('matches exact copy format', () => {
    const message = buildAdminPaymentFailedMessage({
      payerName: 'Test User',
      amountFormatted: '$1000.00',
    })

    expect(message).toMatch(/Payment failed: couldn't collect \$1000\.00 from Test User\./)
    expect(message).toMatch(/Follow up to update their card\./)
  })
})
