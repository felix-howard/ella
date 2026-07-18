/**
 * Tests for the post-sign deposit Payment creation + pay-link SMS service.
 * Covers: deposit ON/OFF gating, idempotency (existing Payment → no-op),
 * resend endpoint error mapping, and Payment.amount as the immutable SMS
 * amount source (not agreement.depositAmount).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HTTPException } from 'hono/http-exception'

const prismaMocks = vi.hoisted(() => ({
  payment: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}))

const smsMocks = vi.hoisted(() => ({
  sendSignerSmsAndPersist: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../../../lib/constants', () => ({ PORTAL_URL: 'http://portal.test' }))
vi.mock('../signer-sms-delivery', () => smsMocks)

import {
  buildPaymentPayUrl,
  createDepositPaymentForAgreement,
  normalizeDepositPaymentDescription,
  resendDepositPayLink,
} from '../deposit-payment-service'
import type { PostSignAgreementContext } from '../../agreements/agreement-post-sign-notifications'

function postSignCtx(overrides: Partial<PostSignAgreementContext> = {}): PostSignAgreementContext {
  return {
    id: 'agr_1',
    organizationId: 'org_1',
    orgName: 'Acme Tax',
    title: '2026 Engagement Letter',
    createdByUserId: 'staff_1',
    leadId: 'lead_1',
    clientId: null,
    depositAmount: { toString: () => '300' },
    depositStatus: 'PENDING',
    signer: { id: 'lead_1', firstName: 'Anna', lastName: 'Nguyen', kind: 'lead' },
    ...overrides,
  }
}

describe('createDepositPaymentForAgreement', () => {
  afterEach(() => vi.useRealTimers())

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMocks.payment.findFirst.mockResolvedValue(null)
    prismaMocks.payment.create.mockResolvedValue({ payToken: 'tok_abc' })
    smsMocks.sendSignerSmsAndPersist.mockResolvedValue(undefined)
  })

  it('creates one PENDING DEPOSIT payment and SMSes the pay link', async () => {
    const result = await createDepositPaymentForAgreement(postSignCtx())

    expect(result).toEqual({ payUrl: 'http://portal.test/pay/tok_abc' })

    expect(prismaMocks.payment.create).toHaveBeenCalledTimes(1)
    expect(prismaMocks.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org_1',
        leadId: 'lead_1',
        clientId: null,
        agreementId: 'agr_1',
        type: 'DEPOSIT',
        status: 'PENDING',
        amount: '300',
        payToken: expect.any(String),
        description: 'Initial payment - 2026 Engagement Letter',
      }),
    })
    expect(prismaMocks.payment.create.mock.calls[0]?.[0]?.data).not.toHaveProperty(
      'paymentQuoteId'
    )

    expect(smsMocks.sendSignerSmsAndPersist).toHaveBeenCalledTimes(1)
    const [target, message, template] = smsMocks.sendSignerSmsAndPersist.mock.calls[0]
    expect(target).toEqual({
      signerId: 'lead_1',
      signerKind: 'lead',
      organizationId: 'org_1',
      sentById: 'staff_1',
    })
    expect(message).toContain('$300.00')
    expect(message).toContain('initial payment')
    expect(message).not.toContain('deposit')
    expect(message).toContain('http://portal.test/pay/tok_abc')
    expect(template).toBe('deposit_pay_link')
  })

  it('is a no-op when the agreement has no deposit', async () => {
    const missingResult = await createDepositPaymentForAgreement(
      postSignCtx({ depositAmount: null })
    )
    const zeroResult = await createDepositPaymentForAgreement(
      postSignCtx({ depositAmount: { toString: () => '0' } })
    )

    expect(missingResult).toBeNull()
    expect(zeroResult).toBeNull()
    expect(prismaMocks.payment.findFirst).not.toHaveBeenCalled()
    expect(prismaMocks.payment.create).not.toHaveBeenCalled()
    expect(smsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
  })

  it('is a no-op when depositStatus is not PENDING', async () => {
    const result = await createDepositPaymentForAgreement(postSignCtx({ depositStatus: 'PAID' }))

    expect(result).toBeNull()
    expect(prismaMocks.payment.findFirst).not.toHaveBeenCalled()
    expect(prismaMocks.payment.create).not.toHaveBeenCalled()
    expect(smsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
  })

  it('reuses the pay URL when a PENDING deposit payment already exists', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    prismaMocks.payment.findFirst.mockResolvedValue({
      id: 'pay_existing',
      status: 'PENDING',
      payToken: 'tok_existing',
    })

    const result = await createDepositPaymentForAgreement(postSignCtx())

    expect(prismaMocks.payment.findFirst).toHaveBeenCalledWith({
      where: {
        agreementId: 'agr_1',
        type: 'DEPOSIT',
        status: { in: ['PENDING', 'PAID'] },
      },
      select: { id: true, status: true, payToken: true },
    })
    expect(result).toEqual({ payUrl: 'http://portal.test/pay/tok_existing' })
    expect(prismaMocks.payment.create).not.toHaveBeenCalled()
    expect(smsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('does not return a payment CTA when the initial payment is already PAID', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    prismaMocks.payment.findFirst.mockResolvedValue({
      id: 'pay_existing',
      status: 'PAID',
      payToken: 'tok_paid',
    })

    const result = await createDepositPaymentForAgreement(postSignCtx())

    expect(result).toBeNull()
    expect(prismaMocks.payment.create).not.toHaveBeenCalled()
    expect(smsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('still returns the Portal URL when fallback SMS delivery fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    smsMocks.sendSignerSmsAndPersist.mockRejectedValueOnce(new Error('Twilio unavailable'))

    const result = await createDepositPaymentForAgreement(postSignCtx())

    expect(result).toEqual({ payUrl: 'http://portal.test/pay/tok_abc' })
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Initial payment link SMS failed'),
      expect.any(Error)
    )
    errorSpy.mockRestore()
  })

  it('returns the Portal URL when fallback SMS delivery exceeds its deadline', async () => {
    vi.useFakeTimers()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    smsMocks.sendSignerSmsAndPersist.mockImplementation(() => new Promise(() => undefined))

    const creation = createDepositPaymentForAgreement(postSignCtx())

    await vi.waitFor(() => expect(smsMocks.sendSignerSmsAndPersist).toHaveBeenCalled())
    await vi.advanceTimersByTimeAsync(2500)

    await expect(creation).resolves.toEqual({ payUrl: 'http://portal.test/pay/tok_abc' })
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Initial payment link SMS timed out')
    )
    errorSpy.mockRestore()
  })
})

describe('resendDepositPayLink', () => {
  const params = { clientId: 'client_1', agreementId: 'agr_1', orgId: 'org_1' }

  function paymentRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'pay_1',
      status: 'PENDING',
      amount: { toString: () => '300' },
      payToken: 'tok_resend',
      agreement: {
        id: 'agr_1',
        title: '2026 Engagement Letter',
        createdByUserId: 'staff_1',
        leadId: null,
        clientId: 'client_1',
        // Deliberately different from Payment.amount — resend must charge
        // what was originally issued, not the edited agreement deposit.
        depositAmount: { toString: () => '999' },
        depositStatus: 'PENDING',
        lead: null,
        client: { id: 'client_1', firstName: 'Bao', lastName: 'Tran' },
        organization: { name: 'Acme Tax' },
      },
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    smsMocks.sendSignerSmsAndPersist.mockResolvedValue(undefined)
  })

  it('throws 404 when no payment exists for the agreement', async () => {
    prismaMocks.payment.findFirst.mockResolvedValue(null)

    await expect(resendDepositPayLink(params)).rejects.toMatchObject(
      new HTTPException(404, { message: 'No initial payment found for this agreement' })
    )
    expect(smsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
  })

  it('throws 409 when the payment is not PENDING', async () => {
    prismaMocks.payment.findFirst.mockResolvedValue(paymentRow({ status: 'PAID' }))

    await expect(resendDepositPayLink(params)).rejects.toMatchObject({ status: 409 })
    expect(smsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
  })

  it('re-sends the SMS using Payment.amount, not agreement.depositAmount', async () => {
    prismaMocks.payment.findFirst.mockResolvedValue(paymentRow())

    const result = await resendDepositPayLink(params)

    expect(result).toEqual({ payUrl: 'http://portal.test/pay/tok_resend' })
    const [target, message] = smsMocks.sendSignerSmsAndPersist.mock.calls[0]
    expect(target).toEqual(expect.objectContaining({ signerId: 'client_1', signerKind: 'client' }))
    expect(message).toContain('$300.00')
    expect(message).toContain('initial payment')
    expect(message).not.toContain('deposit')
    expect(message).not.toContain('$999')
    expect(message).toContain('http://portal.test/pay/tok_resend')
  })

  it('prefers the lead as signer when the agreement has both lead and client', async () => {
    prismaMocks.payment.findFirst.mockResolvedValue(
      paymentRow({
        agreement: {
          ...paymentRow().agreement,
          leadId: 'lead_1',
          lead: { id: 'lead_1', firstName: 'Anna', lastName: 'Nguyen' },
        },
      })
    )

    await resendDepositPayLink(params)

    expect(smsMocks.sendSignerSmsAndPersist).toHaveBeenCalledWith(
      expect.objectContaining({ signerId: 'lead_1', signerKind: 'lead' }),
      expect.any(String),
      'deposit_pay_link'
    )
  })
})

describe('buildPaymentPayUrl', () => {
  it('builds the portal pay page URL', () => {
    expect(buildPaymentPayUrl('tok_x')).toBe('http://portal.test/pay/tok_x')
  })
})

describe('normalizeDepositPaymentDescription', () => {
  it('rewrites legacy retainer descriptions for user-facing payment surfaces', () => {
    expect(normalizeDepositPaymentDescription('Retainer – 2026 Engagement Letter')).toBe(
      'Initial payment - 2026 Engagement Letter'
    )
    expect(normalizeDepositPaymentDescription('Retainer - 2026 Engagement Letter')).toBe(
      'Initial payment - 2026 Engagement Letter'
    )
  })

  it('leaves current and empty descriptions unchanged', () => {
    expect(normalizeDepositPaymentDescription('Initial payment - 2026 Engagement Letter')).toBe(
      'Initial payment - 2026 Engagement Letter'
    )
    expect(normalizeDepositPaymentDescription(null)).toBeNull()
  })
})
