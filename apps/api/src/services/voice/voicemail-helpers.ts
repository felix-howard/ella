/**
 * Voicemail Helper Functions
 * Utilities for handling voicemail recordings from unknown/known callers
 */
import { prisma } from '../../lib/db'
import type { Prisma } from '@ella/db'
import { findOrCreateEngagement } from '../engagement-helpers'

// Transaction client type for type-safe transactions
type TransactionClient = Prisma.TransactionClient
type ConversationReference = { id: string }

const MISSED_CALL_STATUSES = new Set(['no-answer', 'busy', 'failed', 'canceled', 'voicemail'])

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate E.164 phone number format
 * @param phone - Phone number to validate
 * @returns true if valid E.164 format
 */
export function isValidE164Phone(phone: string): boolean {
  // E.164: + followed by 1-9, then 9-14 more digits (10-15 total after +)
  return /^\+[1-9]\d{9,14}$/.test(phone)
}

/**
 * Sanitize phone number for safe display/storage
 * Removes potential XSS attack vectors while preserving valid E.164 characters
 * @param phone - Phone number to sanitize
 * @returns Sanitized phone string (only +, digits, truncated to 16 chars)
 */
export function sanitizePhone(phone: string): string {
  // Remove any character that isn't + or digit
  const sanitized = phone.replace(/[^\d+]/g, '')
  // Ensure only one + at the start, truncate to safe length
  return sanitized.replace(/^\++/, '+').slice(0, 16)
}

function buildPhoneLookupCandidates(e164Phone: string): string[] {
  const digits = e164Phone.replace(/\D/g, '')
  const candidates = new Set([e164Phone])

  if (digits.length === 11 && digits.startsWith('1')) {
    const national = digits.slice(1)
    candidates.add(national)
    candidates.add(digits)
    candidates.add(`(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`)
    candidates.add(`${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`)
    candidates.add(`+1 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`)
  }

  return Array.from(candidates)
}

function buildClientPhoneWhere(
  phone: string,
  organizationId?: string | null
): Prisma.ClientWhereInput {
  const phoneCandidates = buildPhoneLookupCandidates(phone)
  return {
    phone: { in: phoneCandidates },
    clientType: 'INDIVIDUAL',
    ...(organizationId ? { OR: [{ organizationId }, { organizationId: null }] } : {}),
  }
}

async function acquireCallSidLock(tx: TransactionClient, callSid?: string | null): Promise<void> {
  if (!callSid?.trim()) return

  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext('ella_voice_call_sid'), hashtext(${callSid}))
  `
}

/**
 * Sanitize recording duration from Twilio webhook
 * Parses string, clamps to valid range [0, max]
 * @param raw - Raw duration value from webhook
 * @param maxDuration - Maximum allowed duration in seconds
 * @returns Sanitized duration in seconds
 */
export function sanitizeRecordingDuration(raw: string | undefined, maxDuration: number): number {
  const parsed = parseInt(raw || '0', 10)
  if (isNaN(parsed) || parsed < 0) return 0
  return Math.min(parsed, maxDuration)
}

// ============================================
// FORMATTING HELPERS
// ============================================

/**
 * Format voicemail duration to human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "1:23" for 83 seconds)
 */
export function formatVoicemailDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// ============================================
// DATABASE HELPERS
// ============================================

/**
 * Find conversation by caller phone number
 * Looks up client by phone and returns their latest case's conversation
 * @param phone - E.164 formatted phone number
 * @returns Conversation or null if not found
 * @throws Error if phone format is invalid
 */
export async function findConversationByPhone(
  phone: string,
  organizationId?: string | null
): Promise<ConversationReference | null> {
  // SECURITY: Validate phone format BEFORE database query
  if (!isValidE164Phone(phone)) {
    return null // Invalid format = no match possible
  }

  const client = await prisma.client.findFirst({
    where: buildClientPhoneWhere(phone, organizationId),
    include: {
      taxCases: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { conversation: true },
      },
    },
  })

  if (!client?.taxCases[0]?.conversation) {
    return null
  }

  return { id: client.taxCases[0].conversation.id }
}

async function findConversationByPhoneInTx(
  tx: TransactionClient,
  phone: string,
  organizationId?: string | null
): Promise<ConversationReference | null> {
  if (!isValidE164Phone(phone)) {
    return null
  }

  const client = await tx.client.findFirst({
    where: buildClientPhoneWhere(phone, organizationId),
    include: {
      taxCases: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { conversation: true },
      },
    },
  })

  if (!client?.taxCases[0]?.conversation) {
    return null
  }

  return { id: client.taxCases[0].conversation.id }
}

async function createPlaceholderConversationInTx(
  tx: TransactionClient,
  phone: string,
  organizationId?: string | null,
  source?: 'INCOMING_SMS' | 'INCOMING_CALL'
): Promise<ConversationReference> {
  let client = await tx.client.findFirst({
    where: buildClientPhoneWhere(phone, organizationId),
    include: {
      taxCases: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { conversation: true },
      },
    },
  })

  if (client) {
    if (organizationId && !client.organizationId) {
      await tx.client.update({
        where: { id: client.id },
        data: { organizationId },
      })
    }
  } else {
    client = await tx.client.create({
      data: {
        firstName: 'New Caller',
        lastName: ' ',
        name: 'New Caller',
        phone,
        language: 'VI',
        clientType: 'INDIVIDUAL',
        ...(source ? { source } : {}),
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        taxCases: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { conversation: true },
        },
      },
    })
  }

  if (client.taxCases[0]?.conversation) {
    return client.taxCases[0].conversation
  }

  const currentYear = new Date().getFullYear() - 1
  const { engagementId } = await findOrCreateEngagement(tx, client.id, currentYear, null)

  const taxCase = await tx.taxCase.create({
    data: {
      clientId: client.id,
      taxYear: currentYear,
      engagementId,
      taxTypes: ['FORM_1040'],
      status: 'INTAKE',
    },
  })

  return await tx.conversation.create({
    data: {
      caseId: taxCase.id,
      lastMessageAt: new Date(),
    },
  })
}

/**
 * Create placeholder client, tax case, and conversation for unknown caller
 * Used when voicemail is received from a number not in the system
 * Uses upsert pattern to handle race conditions (concurrent calls from same number)
 * @param phone - E.164 formatted caller phone (must be pre-validated)
 * @param organizationId - Optional org ID to associate the placeholder client with
 * @returns Created or existing conversation
 */
export async function createPlaceholderConversation(
  phone: string,
  organizationId?: string | null,
  source?: 'INCOMING_SMS' | 'INCOMING_CALL'
): Promise<ConversationReference> {
  const result = await prisma.$transaction((tx: TransactionClient) =>
    createPlaceholderConversationInTx(tx, phone, organizationId, source)
  )

  return { id: result.id }
}

function getMissedCallContent(status: string): string {
  const messages: Record<string, string> = {
    busy: 'Missed call - Busy',
    'no-answer': 'Missed call',
    failed: 'Missed call - Failed',
    canceled: 'Missed call - Canceled',
  }
  return messages[status] || 'Missed call'
}

export async function recordMissedInboundCall(input: {
  callerPhone: string
  organizationId?: string | null
  callSid?: string | null
  callStatus?: string | null
  content?: string | null
}): Promise<{ id: string; conversationId: string } | null> {
  if (!input.organizationId || !isValidE164Phone(input.callerPhone)) {
    return null
  }

  const callStatus = input.callStatus || 'no-answer'
  const content = input.content?.trim() || getMissedCallContent(callStatus)

  return await prisma.$transaction(async (tx: TransactionClient) => {
    await acquireCallSidLock(tx, input.callSid)

    const existingMessage = input.callSid
      ? await tx.message.findFirst({
          where: {
            callSid: input.callSid,
            conversationId: { not: null },
          },
          select: { id: true, callStatus: true, conversationId: true },
        })
      : null

    if (existingMessage?.conversationId) {
      const shouldIncrementUnread = !MISSED_CALL_STATUSES.has(existingMessage.callStatus || '')
      const updated = await tx.message.update({
        where: { id: existingMessage.id },
        data: { callStatus, content },
      })

      await tx.conversation.update({
        where: { id: existingMessage.conversationId },
        data: {
          lastMessageAt: new Date(),
          ...(shouldIncrementUnread ? { unreadCount: { increment: 1 } } : {}),
        },
      })

      return { id: updated.id, conversationId: existingMessage.conversationId }
    }

    let conversation = await findConversationByPhoneInTx(
      tx,
      input.callerPhone,
      input.organizationId
    )

    if (!conversation) {
      conversation = await createPlaceholderConversationInTx(
        tx,
        input.callerPhone,
        input.organizationId,
        'INCOMING_CALL'
      )
    }

    const conversationId = conversation.id

    const message = await tx.message.create({
      data: {
        conversationId,
        channel: 'CALL',
        direction: 'INBOUND',
        content,
        isSystem: false,
        ...(input.callSid ? { callSid: input.callSid } : {}),
        callStatus,
      },
    })

    await tx.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
    })

    return { id: message.id, conversationId }
  })
}

export async function recordRingingInboundCall(input: {
  callerPhone: string
  organizationId?: string | null
  callSid: string
}): Promise<{ id: string; conversationId: string } | null> {
  if (!input.organizationId || !isValidE164Phone(input.callerPhone) || !input.callSid.trim()) {
    return null
  }

  return await prisma.$transaction(async (tx: TransactionClient) => {
    await acquireCallSidLock(tx, input.callSid)

    const existingMessage = await tx.message.findFirst({
      where: {
        callSid: input.callSid,
        conversationId: { not: null },
      },
      select: { id: true, conversationId: true },
    })

    if (existingMessage?.conversationId) {
      return { id: existingMessage.id, conversationId: existingMessage.conversationId }
    }

    let conversation = await findConversationByPhoneInTx(
      tx,
      input.callerPhone,
      input.organizationId
    )

    if (!conversation) {
      conversation = await createPlaceholderConversationInTx(
        tx,
        input.callerPhone,
        input.organizationId,
        'INCOMING_CALL'
      )
    }

    const message = await tx.message.create({
      data: {
        conversationId: conversation.id,
        channel: 'CALL',
        direction: 'INBOUND',
        content: 'Incoming call',
        isSystem: false,
        callSid: input.callSid,
        callStatus: 'ringing',
      },
    })

    await tx.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    })

    return { id: message.id, conversationId: conversation.id }
  })
}

export async function recordVoicemailInboundCall(input: {
  callerPhone: string
  organizationId?: string | null
  callSid: string
  recordingUrl: string
  recordingDuration: number
}): Promise<{ id: string; conversationId: string; created: boolean } | null> {
  if (!input.organizationId || !isValidE164Phone(input.callerPhone) || !input.callSid.trim()) {
    return null
  }

  return await prisma.$transaction(async (tx: TransactionClient) => {
    await acquireCallSidLock(tx, input.callSid)

    const existingMessage = await tx.message.findFirst({
      where: {
        callSid: input.callSid,
        conversationId: { not: null },
      },
      select: { id: true, callStatus: true, conversationId: true },
    })

    if (existingMessage?.conversationId) {
      const shouldIncrementUnread = !MISSED_CALL_STATUSES.has(existingMessage.callStatus || '')
      const updated = await tx.message.update({
        where: { id: existingMessage.id },
        data: {
          recordingUrl: `${input.recordingUrl}.mp3`,
          recordingDuration: input.recordingDuration,
          content: `Voicemail (${formatVoicemailDuration(input.recordingDuration)})`,
          callStatus: 'voicemail',
        },
      })

      await tx.conversation.update({
        where: { id: existingMessage.conversationId },
        data: {
          lastMessageAt: new Date(),
          ...(shouldIncrementUnread ? { unreadCount: { increment: 1 } } : {}),
        },
      })

      return { id: updated.id, conversationId: existingMessage.conversationId, created: false }
    }

    let conversation = await findConversationByPhoneInTx(
      tx,
      input.callerPhone,
      input.organizationId
    )

    if (!conversation) {
      conversation = await createPlaceholderConversationInTx(
        tx,
        input.callerPhone,
        input.organizationId,
        'INCOMING_CALL'
      )
    }

    const message = await tx.message.create({
      data: {
        conversationId: conversation.id,
        channel: 'CALL',
        direction: 'INBOUND',
        content: `Voicemail (${formatVoicemailDuration(input.recordingDuration)})`,
        isSystem: false,
        callSid: input.callSid,
        recordingUrl: `${input.recordingUrl}.mp3`,
        recordingDuration: input.recordingDuration,
        callStatus: 'voicemail',
      },
    })

    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
    })

    return { id: message.id, conversationId: conversation.id, created: true }
  })
}
