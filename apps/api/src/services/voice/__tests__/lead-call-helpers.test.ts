import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  message: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({
  prisma: prismaMocks,
}))

import {
  createLeadInboundCallMessage,
  updateLeadCallMessageBySid,
  upsertLeadMissedCallMessage,
} from '../lead-call-helpers'

describe('lead call helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMocks.$executeRaw.mockResolvedValue(0)
    prismaMocks.$transaction.mockImplementation(async (callback) =>
      callback({
        message: prismaMocks.message,
        $executeRaw: prismaMocks.$executeRaw,
      })
    )
  })

  it('creates a lead-owned inbound call message when CallSid is new', async () => {
    prismaMocks.message.findFirst.mockResolvedValue(null)
    prismaMocks.message.create.mockResolvedValue({ id: 'lead_call_1', leadId: 'lead_1' })

    const result = await createLeadInboundCallMessage({
      leadId: 'lead_1',
      callerPhone: '+15551112222',
      callSid: 'CA_lead_1',
    })

    expect(result).toEqual({ id: 'lead_call_1', leadId: 'lead_1' })
    expect(prismaMocks.$executeRaw).toHaveBeenCalled()
    expect(prismaMocks.message.create).toHaveBeenCalledWith({
      data: {
        leadId: 'lead_1',
        channel: 'CALL',
        direction: 'INBOUND',
        content: 'Incoming call',
        isSystem: false,
        callSid: 'CA_lead_1',
        callStatus: 'ringing',
      },
      select: { id: true, leadId: true },
    })
  })

  it('returns the existing lead call message on duplicate CallSid retries', async () => {
    prismaMocks.message.findFirst.mockResolvedValue({ id: 'lead_call_existing', leadId: 'lead_1' })

    const result = await createLeadInboundCallMessage({
      leadId: 'lead_1',
      callerPhone: '+15551112222',
      callSid: 'CA_retry',
    })

    expect(result).toEqual({ id: 'lead_call_existing', leadId: 'lead_1' })
    expect(prismaMocks.$executeRaw).toHaveBeenCalled()
    expect(prismaMocks.message.create).not.toHaveBeenCalled()
  })

  it('does not query or update when updating with an empty CallSid', async () => {
    const result = await updateLeadCallMessageBySid({
      callSid: '',
      callStatus: 'no-answer',
      content: 'Call - No answer',
    })

    expect(result).toBeNull()
    expect(prismaMocks.message.findFirst).not.toHaveBeenCalled()
    expect(prismaMocks.message.update).not.toHaveBeenCalled()
  })

  it('updates an existing lead call message for missed-call upserts', async () => {
    prismaMocks.message.findFirst.mockResolvedValue({ id: 'lead_call_1', leadId: 'lead_1' })
    prismaMocks.message.update.mockResolvedValue({ id: 'lead_call_1', leadId: 'lead_1' })

    const result = await upsertLeadMissedCallMessage({
      leadId: 'lead_1',
      callerPhone: '+15551112222',
      callSid: 'CA_lead_1',
      callStatus: 'no-answer',
    })

    expect(result).toEqual({ id: 'lead_call_1', leadId: 'lead_1' })
    expect(prismaMocks.$executeRaw).toHaveBeenCalled()
    expect(prismaMocks.message.update).toHaveBeenCalledWith({
      where: { id: 'lead_call_1' },
      data: {
        callStatus: 'no-answer',
        content: 'Missed call',
      },
      select: { id: true, leadId: true },
    })
    expect(prismaMocks.message.create).not.toHaveBeenCalled()
  })
})
