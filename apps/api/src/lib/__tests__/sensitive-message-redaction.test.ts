import { describe, expect, it } from 'vitest'
import type { AuthUser } from '../../services/auth'
import { DEPOSIT_PAY_LINK_TEMPLATE_NAME, DEPOSIT_RECEIPT_TEMPLATE_NAME, QUOTE_PAY_LINK_TEMPLATE_NAME, QUOTE_RECEIPT_TEMPLATE_NAME } from '../../services/payments/payment-sms-templates'
import { AGREEMENT_INVITE_TEMPLATE_NAME } from '../../services/sms/templates/agreement-invite'
import {
  canViewSensitiveMessageContent,
  getSensitiveMessagePlaceholder,
  getSensitiveMessageRedactionKind,
  serializeSensitiveMessageText,
  type RedactedMessageKind,
} from '../sensitive-message-redaction'

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'clerk_user_1',
    staffId: 'staff_1',
    email: 'test@test.com',
    name: 'Test User',
    role: 'STAFF',
    organizationId: 'org_1',
    clerkOrgId: 'org_clerk_1',
    orgRole: 'org:member',
    ...overrides,
  }
}

function outbound(overrides: { content?: string | null; templateUsed?: string | null; direction?: string | null } = {}) {
  return {
    direction: 'OUTBOUND',
    content: 'ordinary message',
    templateUsed: null,
    ...overrides,
  }
}

describe('canViewSensitiveMessageContent', () => {
  it('allows Clerk org admins and app ADMIN users', () => {
    expect(canViewSensitiveMessageContent(makeUser({ orgRole: 'org:admin', role: 'STAFF' }))).toBe(true)
    expect(canViewSensitiveMessageContent(makeUser({ orgRole: 'org:member', role: 'ADMIN' }))).toBe(true)
  })

  it('blocks MANAGER, STAFF, and CPA users', () => {
    expect(canViewSensitiveMessageContent(makeUser({ role: 'MANAGER' }))).toBe(false)
    expect(canViewSensitiveMessageContent(makeUser({ role: 'STAFF' }))).toBe(false)
    expect(canViewSensitiveMessageContent(makeUser({ role: 'CPA' }))).toBe(false)
  })
})

describe('getSensitiveMessageRedactionKind', () => {
  it.each([
    [QUOTE_PAY_LINK_TEMPLATE_NAME, 'payment_link'],
    [DEPOSIT_PAY_LINK_TEMPLATE_NAME, 'payment_link'],
    [QUOTE_RECEIPT_TEMPLATE_NAME, 'payment_confirmation'],
    [DEPOSIT_RECEIPT_TEMPLATE_NAME, 'payment_confirmation'],
    [AGREEMENT_INVITE_TEMPLATE_NAME, 'agreement_link'],
  ] as Array<[string, RedactedMessageKind]>)(
    'classifies %s template as %s',
    (templateUsed, expected) => {
      expect(getSensitiveMessageRedactionKind(outbound({ templateUsed }))).toBe(expected)
    },
  )

  it('does not redact inbound messages even with sensitive template or URL', () => {
    expect(getSensitiveMessageRedactionKind(outbound({
      direction: 'INBOUND',
      templateUsed: 'quote_pay_link',
      content: 'https://my.ella.tax/pay/tok_1',
    }))).toBeNull()
  })

  it('classifies allowed portal pay, quote, and agreement URLs by path', () => {
    expect(getSensitiveMessageRedactionKind(outbound({
      content: 'Pay here: https://my.ella.tax/pay/tok_1',
    }))).toBe('payment_link')
    expect(getSensitiveMessageRedactionKind(outbound({
      content: 'Quote: http://localhost:5173/quote/tok_2',
    }))).toBe('payment_link')
    expect(getSensitiveMessageRedactionKind(outbound({
      content: 'Sign: https://my.ella.tax/agreements/tok_3',
    }))).toBe('agreement_link')
    expect(getSensitiveMessageRedactionKind(outbound({
      content: 'Legacy host: https://portal.ellatax.com/pay/tok_4',
    }))).toBe('payment_link')
  })

  it('respects a valid custom PORTAL_URL host', () => {
    const originalPortalUrl = process.env.PORTAL_URL
    process.env.PORTAL_URL = 'https://portal.test'
    try {
      expect(getSensitiveMessageRedactionKind(outbound({ content: 'https://portal.test/pay/tok' }))).toBe('payment_link')
      expect(getSensitiveMessageRedactionKind(outbound({ content: 'https://portal.test/quote/tok' }))).toBe('payment_link')
      expect(getSensitiveMessageRedactionKind(outbound({ content: 'https://portal.test/agreements/tok' }))).toBe('agreement_link')
      expect(getSensitiveMessageRedactionKind(outbound({ content: 'https://other.test/pay/tok' }))).toBeNull()
    } finally {
      if (originalPortalUrl === undefined) delete process.env.PORTAL_URL
      else process.env.PORTAL_URL = originalPortalUrl
    }
  })

  it('classifies relative portal paths without matching unrelated text', () => {
    expect(getSensitiveMessageRedactionKind(outbound({ content: 'Review /quote/tok_1 today' }))).toBe('payment_link')
    expect(getSensitiveMessageRedactionKind(outbound({ content: 'Please pay $250 by Friday.' }))).toBeNull()
  })

  it('does not redact empty content or case-mismatched relative paths', () => {
    expect(getSensitiveMessageRedactionKind(outbound({ content: null }))).toBeNull()
    expect(getSensitiveMessageRedactionKind(outbound({ content: 'Review /PAY/tok_1 today' }))).toBeNull()
  })

  it('does not redact external payment-like URLs or ordinary outbound SMS', () => {
    expect(getSensitiveMessageRedactionKind(outbound({
      content: 'External link: https://example.com/pay/tok_1',
    }))).toBeNull()
    expect(getSensitiveMessageRedactionKind(outbound({
      content: 'Please upload your W-2 when convenient.',
      templateUsed: 'missing_docs',
    }))).toBeNull()
  })

  it('does not redact allowed-host URLs with non-sensitive paths', () => {
    expect(getSensitiveMessageRedactionKind(outbound({
      content: 'Upload here: https://my.ella.tax/upload/tok_1',
    }))).toBeNull()
  })

  it('ignores malformed URLs instead of failing closed', () => {
    expect(getSensitiveMessageRedactionKind(outbound({
      content: 'Broken link: https://%/pay/tok_1',
    }))).toBeNull()
  })

  it('does not allow configured portal host matching when PORTAL_URL is invalid', () => {
    const originalPortalUrl = process.env.PORTAL_URL
    process.env.PORTAL_URL = '::::'

    try {
      expect(getSensitiveMessageRedactionKind(outbound({
        content: 'Pay here: http://localhost:5173/pay/tok_1',
      }))).toBeNull()
    } finally {
      if (originalPortalUrl === undefined) {
        delete process.env.PORTAL_URL
      } else {
        process.env.PORTAL_URL = originalPortalUrl
      }
    }
  })
})

describe('serializeSensitiveMessageText', () => {
  it('returns raw sensitive content for ADMIN', () => {
    const message = outbound({
      content: 'Review and pay here: https://my.ella.tax/pay/tok_1',
      templateUsed: 'quote_pay_link',
    })

    expect(serializeSensitiveMessageText(makeUser({ role: 'ADMIN' }), message)).toBe(message)
  })

  it('redacts MANAGER content and clears staff-authored source text', () => {
    const message = {
      ...outbound({
        content: 'Pay $250 here: https://my.ella.tax/pay/tok_1',
        templateUsed: 'quote_pay_link',
      }),
      staffAuthoredContent: 'Please pay $250 here.',
      staffAuthoredLanguage: 'EN',
      contentLanguage: 'VI',
    }

    const serialized = serializeSensitiveMessageText(makeUser({ role: 'MANAGER' }), message)

    expect(serialized).not.toBe(message)
    expect(serialized.content).toBe(getSensitiveMessagePlaceholder('payment_link'))
    expect(serialized.staffAuthoredContent).toBeNull()
    expect(serialized.staffAuthoredLanguage).toBe('EN')
    expect(message.content).toContain('$250')
    expect(message.staffAuthoredContent).toBe('Please pay $250 here.')
  })

  it('redacts messages that do not include translation source fields', () => {
    const message = outbound({
      content: 'Sign here: https://my.ella.tax/agreements/tok_1',
      templateUsed: 'agreement_invite',
    })

    const serialized = serializeSensitiveMessageText(makeUser({ role: 'STAFF' }), message)

    expect(serialized).not.toBe(message)
    expect(serialized.content).toBe(getSensitiveMessagePlaceholder('agreement_link'))
    expect('staffAuthoredContent' in serialized).toBe(false)
  })

  it('leaves ordinary messages unchanged for non-admin users', () => {
    const message = outbound({ content: 'Ordinary outbound SMS' })

    expect(serializeSensitiveMessageText(makeUser({ role: 'MANAGER' }), message)).toBe(message)
  })
})
