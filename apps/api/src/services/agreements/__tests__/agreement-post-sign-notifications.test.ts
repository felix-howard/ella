/**
 * Tests for the admin SMS fan-out fired after an agreement is signed.
 * Covers notification gating: only ADMIN + toggle ON + valid phone receive;
 * Twilio failures are logged, never thrown back into the signing flow.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  staff: {
    findMany: vi.fn(),
  },
}))

const twilioMocks = vi.hoisted(() => ({
  sendSms: vi.fn(),
  isTwilioConfigured: vi.fn(),
  isValidPhoneNumber: vi.fn((phone: string) => phone.startsWith('+')),
  formatPhoneToE164: vi.fn((phone: string) => phone),
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../../sms/twilio-client', () => twilioMocks)

import {
  notifyAdminsAgreementSigned,
  smsOptedInAdmins,
  type PostSignAgreementContext,
} from '../agreement-post-sign-notifications'

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

beforeEach(() => {
  vi.clearAllMocks()
  twilioMocks.isTwilioConfigured.mockReturnValue(true)
  twilioMocks.sendSms.mockResolvedValue({ success: true, sid: 'SM123' })
  prismaMocks.staff.findMany.mockResolvedValue([
    { id: 'staff_a', phoneNumber: '+15550000001' },
    { id: 'staff_b', phoneNumber: '+15550000002' },
  ])
})

describe('smsOptedInAdmins', () => {
  const baseParams = {
    organizationId: 'org_1',
    toggle: 'notifyOnAgreementSigned' as const,
    message: 'test message',
    logContext: 'agreement=agr_1 signed',
  }

  it('only queries active ADMINs with the toggle ON and a phone on file', async () => {
    await smsOptedInAdmins(baseParams)

    expect(prismaMocks.staff.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org_1',
        role: 'ADMIN', // MANAGER/STAFF intentionally never queried
        isActive: true,
        notifyOnAgreementSigned: true,
        phoneNumber: { not: null },
      },
      select: { id: true, phoneNumber: true },
    })
    expect(twilioMocks.sendSms).toHaveBeenCalledTimes(2)
    expect(twilioMocks.sendSms).toHaveBeenCalledWith({
      to: '+15550000001',
      body: 'test message',
    })
  })

  it('filters on the payment toggle when requested', async () => {
    await smsOptedInAdmins({ ...baseParams, toggle: 'notifyOnClientPayment' })

    expect(prismaMocks.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ notifyOnClientPayment: true }),
      }),
    )
  })

  it('skips entirely when Twilio is not configured', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    twilioMocks.isTwilioConfigured.mockReturnValue(false)

    await smsOptedInAdmins(baseParams)

    expect(prismaMocks.staff.findMany).not.toHaveBeenCalled()
    expect(twilioMocks.sendSms).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('sends nothing when no admin opted in', async () => {
    prismaMocks.staff.findMany.mockResolvedValue([])

    await smsOptedInAdmins(baseParams)

    expect(twilioMocks.sendSms).not.toHaveBeenCalled()
  })

  it('logs per-recipient failures without throwing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    twilioMocks.sendSms
      .mockResolvedValueOnce({ success: false, error: 'unreachable' })
      .mockResolvedValueOnce({ success: true, sid: 'SM456' })

    // Returns the E.164 phones it targeted (both, even though one send failed)
    // so callers can dedupe follow-up SMS to the same handset.
    await expect(smsOptedInAdmins(baseParams)).resolves.toEqual([
      '+15550000001',
      '+15550000002',
    ])

    expect(twilioMocks.sendSms).toHaveBeenCalledTimes(2)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('agreement=agr_1 signed'),
    )
    errorSpy.mockRestore()
  })

  it('skips invalid phone numbers but still sends to valid ones', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    prismaMocks.staff.findMany.mockResolvedValue([
      { id: 'staff_bad', phoneNumber: '0123' },
      { id: 'staff_ok', phoneNumber: '+15550000002' },
    ])

    await smsOptedInAdmins(baseParams)

    expect(twilioMocks.sendSms).toHaveBeenCalledTimes(1)
    expect(twilioMocks.sendSms).toHaveBeenCalledWith({
      to: '+15550000002',
      body: 'test message',
    })
    errorSpy.mockRestore()
  })
})

describe('notifyAdminsAgreementSigned', () => {
  it('includes the pending deposit amount in the message', async () => {
    await notifyAdminsAgreementSigned(postSignCtx())

    expect(twilioMocks.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Anna Nguyen signed 2026 Engagement Letter ($300.00 initial payment pending)',
      }),
    )
  })

  it('omits the deposit suffix when the agreement has no deposit', async () => {
    await notifyAdminsAgreementSigned(postSignCtx({ depositAmount: null }))

    expect(twilioMocks.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Anna Nguyen signed 2026 Engagement Letter',
      }),
    )
  })
})
