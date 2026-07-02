import { prisma } from '../../lib/db'
import type { Prisma } from '@ella/db'

type LeadCallMessageResult = {
  id: string
  leadId: string
}

type LeadCallStatusInput = {
  leadId: string
  callerPhone: string
  callSid?: string | null
  callStatus?: string | null
  content?: string | null
}

type LeadCallRecordingInput = {
  callSid: string
  callStatus?: string | null
  content?: string | null
  recordingUrl?: string | null
  recordingDuration?: number | null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

async function acquireCallSidLock(tx: Prisma.TransactionClient, callSid: string): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext('ella_voice_call_sid'), hashtext(${callSid}))
  `
}

function buildLeadCallCreateData(input: LeadCallStatusInput) {
  return {
    leadId: input.leadId,
    channel: 'CALL' as const,
    direction: 'INBOUND' as const,
    content: input.content?.trim() || 'Incoming call',
    isSystem: false,
    ...(input.callSid ? { callSid: input.callSid } : {}),
    ...(input.callStatus ? { callStatus: input.callStatus } : {}),
  }
}

export async function createLeadInboundCallMessage(
  input: LeadCallStatusInput
): Promise<LeadCallMessageResult> {
  return await prisma.$transaction(async (tx) => {
    if (isNonEmptyString(input.callSid)) {
      await acquireCallSidLock(tx, input.callSid)

      const existingMessage = await tx.message.findFirst({
        where: {
          leadId: input.leadId,
          callSid: input.callSid,
        },
        select: { id: true, leadId: true },
      })

      if (existingMessage?.leadId) {
        return { id: existingMessage.id, leadId: existingMessage.leadId }
      }
    }

    const message = await tx.message.create({
      data: buildLeadCallCreateData({
        ...input,
        callStatus: input.callStatus || 'ringing',
      }),
      select: { id: true, leadId: true },
    })

    return { id: message.id, leadId: message.leadId! }
  })
}

export async function updateLeadCallMessageBySid(
  input: LeadCallRecordingInput
): Promise<LeadCallMessageResult | null> {
  if (!isNonEmptyString(input.callSid)) return null

  const existingMessage = await prisma.message.findFirst({
    where: {
      callSid: input.callSid,
      leadId: { not: null },
    },
    select: { id: true, leadId: true },
  })

  if (!existingMessage?.leadId) return null

  const updated = await prisma.message.update({
    where: { id: existingMessage.id },
    data: {
      ...(input.callStatus ? { callStatus: input.callStatus } : {}),
      ...(input.content ? { content: input.content } : {}),
      ...(input.recordingUrl ? { recordingUrl: input.recordingUrl } : {}),
      ...(input.recordingDuration !== undefined
        ? { recordingDuration: input.recordingDuration }
        : {}),
    },
    select: { id: true, leadId: true },
  })

  return { id: updated.id, leadId: updated.leadId! }
}

export async function upsertLeadMissedCallMessage(
  input: LeadCallStatusInput
): Promise<LeadCallMessageResult> {
  return await prisma.$transaction(async (tx) => {
    if (isNonEmptyString(input.callSid)) {
      await acquireCallSidLock(tx, input.callSid)

      const existingMessage = await tx.message.findFirst({
        where: {
          leadId: input.leadId,
          callSid: input.callSid,
        },
        select: { id: true, leadId: true },
      })

      if (existingMessage?.leadId) {
        const updated = await tx.message.update({
          where: { id: existingMessage.id },
          data: {
            callStatus: input.callStatus || 'no-answer',
            content: input.content?.trim() || 'Missed call',
          },
          select: { id: true, leadId: true },
        })

        return { id: updated.id, leadId: updated.leadId! }
      }
    }

    const message = await tx.message.create({
      data: buildLeadCallCreateData({
        ...input,
        callStatus: input.callStatus || 'no-answer',
        content: input.content?.trim() || 'Missed call',
      }),
      select: { id: true, leadId: true },
    })

    return { id: message.id, leadId: message.leadId! }
  })
}
