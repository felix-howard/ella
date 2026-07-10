/**
 * Lead Messages API routes
 * Two-way Staff ↔ Lead SMS via polymorphic Message.leadId.
 * Dual-writes to SmsSendLog during 2-week transition (brainstorm §7).
 *
 * Mounted at `/leads` alongside leadsRoute:
 *   GET    /leads/messages/conversations
 *   GET    /leads/:id/messages
 *   POST   /leads/:id/messages/send
 *   GET    /leads/:id/messages/unread
 *   POST   /leads/:id/messages/read
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { ActivityRiskLevel, Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { getPaginationParams, buildPaginationResponse } from '../../lib/constants'
import {
  serializeSensitiveMessageText,
  type SensitiveMessageLike,
} from '../../lib/sensitive-message-redaction'
import { serializePhone } from '../../lib/phone-privacy'
import { authMiddleware, requireAdminOrManager } from '../../middleware/auth'
import type { AuthVariables } from '../../middleware/auth'
import { sendSmsOnly, isSmsEnabled } from '../../services/sms'
import { publishLeadReadEvent, publishMessageEventFromLead } from '../../services/realtime/message-publisher'
import {
  getSafeStorageError,
  getSafeStorageReference,
  getSignedDownloadUrl,
  resolveAvatarUrl,
  SENSITIVE_DOC_SIGNED_URL_TTL_SECONDS,
} from '../../services/storage'
import { leadIdParamSchema } from './schemas'
import {
  sendLeadMessageSchema,
  listLeadConversationsQuerySchema,
  listLeadMessagesQuerySchema,
  markLeadMessagesReadSchema,
} from './messages-schemas'
import { getVerifiedAuth } from './auth-helpers'
import {
  getActiveLeadUnreadMessageTotal,
  getUnreadLeadMessageCounts,
} from './lead-message-summary-helpers'
import { getAuditRequestContext, logStaffActivity } from '../../services/activity-log'
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, ACTIVITY_TARGET_TYPES } from '../../services/activity-actions'

const leadMessagesRoute = new Hono<{ Variables: AuthVariables }>()

// All lead-message routes require authenticated staff in an org.
leadMessagesRoute.use('/messages/conversations', authMiddleware, requireAdminOrManager)
leadMessagesRoute.use('/:id/messages', authMiddleware, requireAdminOrManager)
leadMessagesRoute.use('/:id/messages/*', authMiddleware, requireAdminOrManager)

type LeadConversationRow = {
  leadId: string
  lastMessageAt: Date
}

type BackfillableLeadSmsLog = {
  leadId: string
  message: string
  status: string
  twilioSid: string | null
  error: string | null
  sentById: string
  sentAt: Date
}

type RawBackfillableLeadSmsLog = BackfillableLeadSmsLog & {
  leadid?: string
  twiliosid?: string | null
  sentbyid?: string
  sentat?: Date
}

const LEGACY_LEAD_SMS_BACKFILL_BATCH_SIZE = 500

function withoutAttachmentR2Keys<T extends object>(message: T): Omit<T, 'attachmentR2Keys'> {
  const copy = { ...message } as T & { attachmentR2Keys?: unknown }
  delete copy.attachmentR2Keys
  return copy
}

function withSafeLeadCallContent<T extends object>(message: T): T {
  const callMessage = message as T & { channel?: string; callStatus?: string | null; content?: string | null }
  if (callMessage.channel !== 'CALL') return message

  const missedStatuses = new Set(['no-answer', 'busy', 'failed', 'canceled'])
  return {
    ...message,
    content: callMessage.callStatus === 'voicemail'
      ? 'Voicemail'
      : missedStatuses.has(callMessage.callStatus ?? '')
        ? 'Missed call'
        : 'Incoming call',
  }
}

function serializeLeadMessageForViewer<T extends SensitiveMessageLike & object>(
  user: AuthVariables['user'],
  message: T
): Omit<T, 'attachmentR2Keys'> {
  const publicMessage = withoutAttachmentR2Keys(withSafeLeadCallContent(message)) as Omit<T, 'attachmentR2Keys'> & SensitiveMessageLike
  return serializeSensitiveMessageText(user, publicMessage) as Omit<T, 'attachmentR2Keys'>
}

function extractLeadMessageR2KeysFromUrls(urls: string[]): string[] {
  const keys: string[] = []

  for (const url of urls) {
    try {
      if (!url.includes('r2.cloudflarestorage.com')) continue
      const key = new URL(url).pathname.substring(1)
      if (key.startsWith('lead-message-attachments/')) keys.push(key)
    } catch {
      continue
    }
  }

  return keys
}

function buildLeadMessageProxyAttachmentUrls(
  leadId: string,
  message: { id: string; attachmentR2Keys?: string[] | null; attachmentUrls?: string[] | null }
): string[] {
  let attachmentR2Keys = message.attachmentR2Keys ?? []

  if (attachmentR2Keys.length === 0 && message.attachmentUrls && message.attachmentUrls.length > 0) {
    const extractedKeys = extractLeadMessageR2KeysFromUrls(message.attachmentUrls)
    if (extractedKeys.length > 0) {
      prisma.message.update({
        where: { id: message.id },
        data: { attachmentR2Keys: extractedKeys },
      }).catch((error) => {
        console.error('[LeadMessages] Failed to repair lead attachment keys', {
          messageId: message.id,
          error: getSafeStorageError(error),
        })
      })
      attachmentR2Keys = extractedKeys
    }
  }

  const attachmentCount = attachmentR2Keys.length || message.attachmentUrls?.length || 0
  return attachmentCount > 0
    ? Array.from({ length: attachmentCount }, (_, i) => `/leads/${leadId}/messages/media/${message.id}/${i}`)
    : []
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function toSafeLegacySmsError(error?: string | null): string {
  const twilioCode = error?.match(/TWILIO_ERROR_(\d+)/)?.[1] ?? error?.match(/\b(\d{5})\b/)?.[1]
  return twilioCode ? `SMS provider error ${twilioCode}` : 'SMS delivery failed'
}

function mapSmsSendLogStatusToMessageStatus(status: string, error?: string | null): string {
  switch (status.toUpperCase()) {
    case 'DELIVERED':
      return 'delivered'
    case 'UNDELIVERED':
      return 'undelivered'
    case 'FAILED':
      return `ERROR: ${toSafeLegacySmsError(error)}`
    case 'SENT':
      return 'sent'
    default:
      return status.toLowerCase()
  }
}

async function createMissingLeadMessagesFromSmsLogs(smsLogs: BackfillableLeadSmsLog[]) {
  const twilioSids = Array.from(new Set(smsLogs.flatMap((log) => (log.twilioSid ? [log.twilioSid] : []))))
  if (twilioSids.length === 0) return

  const existingMessages = await prisma.message.findMany({
    where: { leadId: { not: null }, twilioSid: { in: twilioSids } },
    select: { twilioSid: true },
  })
  const existingTwilioSids = new Set(existingMessages.flatMap((m) => (m.twilioSid ? [m.twilioSid] : [])))
  const missingLogs = smsLogs.filter((log) => log.twilioSid && !existingTwilioSids.has(log.twilioSid))
  if (missingLogs.length === 0) return

  await createLeadMessagesFromSmsLogs(missingLogs)
}

async function createLeadMessagesFromSmsLogs(smsLogs: BackfillableLeadSmsLog[]) {
  if (smsLogs.length === 0) return

  const data = smsLogs.flatMap((log) => {
    const raw = log as RawBackfillableLeadSmsLog
    const leadId = raw.leadId ?? raw.leadid
    const twilioSid = raw.twilioSid ?? raw.twiliosid
    const sentById = raw.sentById ?? raw.sentbyid
    const sentAt = raw.sentAt ?? raw.sentat

    if (!leadId || !twilioSid || !sentById || !sentAt) return []

    return [{
      leadId,
      channel: 'SMS' as const,
      direction: 'OUTBOUND' as const,
      content: raw.message,
      twilioSid,
      twilioStatus: mapSmsSendLogStatusToMessageStatus(raw.status, raw.error),
      sentById,
      createdAt: sentAt,
    }]
  })

  if (data.length === 0) return

  await prisma.message.createMany({
    data,
    skipDuplicates: true,
  })
}

async function backfillLeadMessagesFromSmsLogs(leadId: string, organizationId: string) {
  const smsLogs = await prisma.smsSendLog.findMany({
    where: {
      leadId,
      organizationId,
      twilioSid: { not: null },
    },
    select: {
      leadId: true,
      message: true,
      status: true,
      twilioSid: true,
      error: true,
      sentById: true,
      sentAt: true,
    },
  })

  await createMissingLeadMessagesFromSmsLogs(smsLogs)
}

async function backfillActiveOrgLeadMessagesFromSmsLogs(organizationId: string) {
  const smsLogs = await prisma.$queryRaw<BackfillableLeadSmsLog[]>`
    SELECT
      s."leadId" as "leadId",
      s.message as "message",
      s.status::text as "status",
      s."twilioSid" as "twilioSid",
      s.error as "error",
      s."sentById" as "sentById",
      s."sentAt" as "sentAt"
    FROM "SmsSendLog" s
    INNER JOIN "Lead" l ON l.id = s."leadId"
    LEFT JOIN "Message" existing ON existing."twilioSid" = s."twilioSid"
    WHERE s."organizationId" = ${organizationId}
      AND s."twilioSid" IS NOT NULL
      AND l.status != 'CONVERTED'
      AND existing.id IS NULL
    ORDER BY s."sentAt" DESC
    LIMIT ${LEGACY_LEAD_SMS_BACKFILL_BATCH_SIZE}
  `

  await createLeadMessagesFromSmsLogs(smsLogs)
}

// GET /leads/messages/conversations - Lead Messages inbox summaries
leadMessagesRoute.get(
  '/messages/conversations',
  zValidator('query', listLeadConversationsQuerySchema),
  async (c) => {
    const user = c.get('user')
    const { orgId } = getVerifiedAuth(user)
    const { page, limit, unreadOnly } = c.req.valid('query')
    const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)
    const unreadOnlyHaving = unreadOnly
      ? Prisma.sql`
        HAVING COUNT(m.id) FILTER (
          WHERE m.direction = 'INBOUND'
            AND (l."messagesLastReadAt" IS NULL OR m."createdAt" > l."messagesLastReadAt")
        ) > 0
      `
      : Prisma.empty

    await backfillActiveOrgLeadMessagesFromSmsLogs(orgId)

    const [conversationRows, totalRows] = await Promise.all([
      prisma.$queryRaw<LeadConversationRow[]>`
        SELECT l.id as "leadId", MAX(m."createdAt") as "lastMessageAt"
        FROM "Lead" l
        INNER JOIN "Message" m ON m."leadId" = l.id
        WHERE l."organizationId" = ${orgId}
          AND l.status != 'CONVERTED'
        GROUP BY l.id, l."messagesLastReadAt"
        ${unreadOnlyHaving}
        ORDER BY MAX(m."createdAt") DESC, l.id ASC
        OFFSET ${skip}
        LIMIT ${safeLimit}
      `,
      prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(*) as total
        FROM (
          SELECT l.id
          FROM "Lead" l
          INNER JOIN "Message" m ON m."leadId" = l.id
          WHERE l."organizationId" = ${orgId}
            AND l.status != 'CONVERTED'
          GROUP BY l.id, l."messagesLastReadAt"
          ${unreadOnlyHaving}
        ) conversations
      `,
    ])

    const leadIds = conversationRows.map((row) => row.leadId)
    const [leads, unreadCounts, totalUnread] = await Promise.all([
      leadIds.length > 0
        ? prisma.lead.findMany({
          where: {
            id: { in: leadIds },
            organizationId: orgId,
            status: { not: 'CONVERTED' },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
            campaignTag: true,
            tags: true,
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sentBy: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
          },
        })
        : Promise.resolve([]),
      getUnreadLeadMessageCounts(leadIds),
      getActiveLeadUnreadMessageTotal(orgId),
    ])

    const avatarCache = new Map<string, string | null>()
    for (const lead of leads) {
      const sentBy = lead.messages[0]?.sentBy
      if (sentBy && !avatarCache.has(sentBy.id)) {
        avatarCache.set(sentBy.id, await resolveAvatarUrl(sentBy.avatarUrl))
      }
    }

    const leadById = new Map(leads.map((lead) => [lead.id, lead]))
    const lastMessageAtByLeadId = new Map(conversationRows.map((row) => [row.leadId, row.lastMessageAt]))
    const conversations = leadIds.flatMap((leadId) => {
      const lead = leadById.get(leadId)
      if (!lead) return []

      const lastMessage = lead.messages[0] ?? null
      const serializedLastMessage = lastMessage
        ? serializeLeadMessageForViewer(user, {
          ...lastMessage,
          attachmentUrls: buildLeadMessageProxyAttachmentUrls(lead.id, lastMessage),
          sentBy: lastMessage.sentBy
            ? {
                id: lastMessage.sentBy.id,
                name: lastMessage.sentBy.name,
                avatarUrl: avatarCache.get(lastMessage.sentBy.id) ?? null,
              }
            : null,
          createdAt: toIsoString(lastMessage.createdAt),
          updatedAt: toIsoString(lastMessage.updatedAt),
        })
        : null

      return [{
        leadId: lead.id,
        unreadCount: unreadCounts.get(lead.id) ?? 0,
        lastMessageAt: toIsoString(lastMessageAtByLeadId.get(lead.id)),
        lead: {
          id: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          name: `${lead.firstName} ${lead.lastName}`.trim(),
          phone: serializePhone(user, lead.phone),
          status: lead.status,
          campaignTag: lead.campaignTag,
          tags: lead.tags,
        },
        lastMessage: serializedLastMessage,
      }]
    })

    return c.json({
      conversations,
      totalUnread,
      pagination: buildPaginationResponse(
        safePage,
        safeLimit,
        Number(totalRows[0]?.total ?? 0)
      ),
    })
  }
)

// GET /leads/:id/messages - Chat history (oldest first for chat display)
leadMessagesRoute.get(
  '/:id/messages',
  zValidator('param', leadIdParamSchema),
  zValidator('query', listLeadMessagesQuerySchema),
  async (c) => {
    const user = c.get('user')
    const { orgId } = getVerifiedAuth(user)
    const { id } = c.req.valid('param')
    const { page, limit, latest } = c.req.valid('query')
    const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)

    // 404 on cross-org (never 403) per security requirement.
    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    })
    if (!lead) {
      return c.json({ error: 'NOT_FOUND', message: 'Lead not found' }, 404)
    }

    await backfillLeadMessagesFromSmsLogs(id, orgId)

    const [fetchedMessages, total] = await Promise.all([
      prisma.message.findMany({
        where: { leadId: id },
        ...(latest ? {} : { skip }),
        take: safeLimit,
        orderBy: { createdAt: latest ? 'desc' : 'asc' },
        include: {
          sentBy: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.message.count({ where: { leadId: id } }),
    ])
    const messages = latest ? [...fetchedMessages].reverse() : fetchedMessages
    const responsePage = latest ? Math.max(Math.ceil(total / safeLimit), 1) : safePage

    const avatarCache = new Map<string, string | null>()
    for (const m of messages) {
      if (m.sentBy && !avatarCache.has(m.sentBy.id)) {
        avatarCache.set(m.sentBy.id, await resolveAvatarUrl(m.sentBy.avatarUrl))
      }
    }

    const messagesWithProxyUrls = messages.map((m) => {
      return serializeLeadMessageForViewer(user, {
        ...m,
        attachmentUrls: buildLeadMessageProxyAttachmentUrls(id, m),
        sentBy: m.sentBy
          ? { id: m.sentBy.id, name: m.sentBy.name, avatarUrl: avatarCache.get(m.sentBy.id) ?? null }
          : null,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })
    })

    return c.json({
      messages: messagesWithProxyUrls,
      pagination: buildPaginationResponse(responsePage, safeLimit, total),
    })
  }
)

// GET /leads/:id/messages/media/:messageId/:index - Proxy lead MMS attachments
leadMessagesRoute.get(
  '/:id/messages/media/:messageId/:index',
  zValidator('param', leadIdParamSchema),
  async (c) => {
    const { orgId } = getVerifiedAuth(c.get('user'))
    const { id } = c.req.valid('param')
    const messageId = c.req.param('messageId')
    const index = Number.parseInt(c.req.param('index'), 10)

    if (Number.isNaN(index) || index < 0) {
      return c.json({ error: 'INVALID_INDEX', message: 'Invalid attachment index' }, 400)
    }

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        leadId: id,
        lead: { organizationId: orgId },
      },
      select: {
        attachmentR2Keys: true,
        attachmentUrls: true,
      },
    })

    if (!message) {
      return c.json({ error: 'NOT_FOUND', message: 'Message not found' }, 404)
    }

    let r2Key = message.attachmentR2Keys?.[index]
    if (!r2Key && message.attachmentUrls?.[index]) {
      r2Key = extractLeadMessageR2KeysFromUrls([message.attachmentUrls[index]])[0]
    }

    if (!r2Key) {
      return c.json({ error: 'NO_ATTACHMENT', message: 'Attachment not found at index' }, 404)
    }

    try {
      const signedUrl = await getSignedDownloadUrl(r2Key, SENSITIVE_DOC_SIGNED_URL_TTL_SECONDS)
      if (!signedUrl) {
        return c.json({ error: 'FETCH_ERROR', message: 'Failed to fetch file from storage' }, 500)
      }

      const response = await fetch(signedUrl)
      if (!response.ok) {
        console.error('[LeadMessages] R2 fetch failed', {
          object: getSafeStorageReference(r2Key),
          messageId,
          status: response.status,
        })
        return c.json({ error: 'FETCH_ERROR', message: 'Failed to fetch file from storage' }, 500)
      }

      const arrayBuffer = await response.arrayBuffer()
      return new Response(arrayBuffer, {
        headers: {
          'Content-Type': response.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'private, no-store, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      })
    } catch (error) {
      console.error('[LeadMessages] Failed to proxy media', {
        messageId,
        error: getSafeStorageError(error),
      })
      return c.json({ error: 'PROXY_ERROR', message: 'Failed to serve attachment' }, 500)
    }
  }
)

// POST /leads/:id/messages/send - Staff → Lead outbound SMS
leadMessagesRoute.post(
  '/:id/messages/send',
  zValidator('param', leadIdParamSchema),
  zValidator('json', sendLeadMessageSchema),
  async (c) => {
    const { orgId, staffId } = getVerifiedAuth(c.get('user'))
    const { id } = c.req.valid('param')
    const { content } = c.req.valid('json')
    const smsEnabled = isSmsEnabled()

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, phone: true },
    })
    if (!lead) {
      return c.json({ error: 'NOT_FOUND', message: 'Lead not found' }, 404)
    }

    if (!smsEnabled) {
      return c.json({ error: 'SMS_DISABLED', message: 'SMS is not configured' }, 400)
    }

    // Send via Twilio first, then persist both Message + SmsSendLog atomically.
    // If DB persistence fails after Twilio success, log a reconciliation warning
    // so ops can reconstruct the missing row from Twilio's dashboard.
    const smsResult = await sendSmsOnly(lead.phone, content)
    const smsError = smsResult.success ? null : toSafeLegacySmsError(smsResult.error)
    const twilioStatus = smsResult.success
      ? (smsResult.status || 'queued')
      : `ERROR: ${smsError}`

    let message
    try {
      const [msg] = await prisma.$transaction([
        prisma.message.create({
          data: {
            leadId: lead.id,
            channel: 'SMS',
            direction: 'OUTBOUND',
            content,
            twilioSid: smsResult.sid ?? null,
            twilioStatus,
            sentById: staffId,
          },
          include: {
            sentBy: { select: { id: true, name: true, avatarUrl: true } },
          },
        }),
        // Dual-write to SmsSendLog (audit table) during 2-week transition.
        // Remove in follow-up PR per brainstorm §7.
        prisma.smsSendLog.create({
          data: {
            leadId: lead.id,
            message: content,
            status: smsResult.success ? 'SENT' : 'FAILED',
            twilioSid: smsResult.sid ?? null,
            error: smsError,
            sentById: staffId,
            organizationId: orgId,
          },
        }),
      ])
      message = msg
    } catch (dbError) {
      if (smsResult.success && smsResult.sid) {
        console.error(
          `[LeadMessages] RECONCILE: Twilio sent SID=${smsResult.sid} to lead=${lead.id} but DB persist failed.`,
          dbError
        )
      }
      throw dbError
    }

    // Non-blocking realtime publish.
    publishMessageEventFromLead(lead.id, {
      id: message.id,
      direction: 'OUTBOUND',
      channel: 'SMS',
    }).catch(() => {})

    await logStaffActivity({
      organizationId: orgId,
      actorStaffId: staffId,
      category: ACTIVITY_CATEGORIES.LEAD,
      targetType: ACTIVITY_TARGET_TYPES.MESSAGE,
      targetId: message.id,
      summary: 'Sent SMS to lead',
      action: ACTIVITY_ACTIONS.LEAD.MESSAGE_SENT,
      riskLevel: ActivityRiskLevel.LOW,
      metadata: {
        channel: 'SMS',
        leadId: lead.id,
        messageId: message.id,
        smsSent: smsResult.success,
        twilioStatusCategory: twilioStatus.startsWith('ERROR:') ? 'failed' : twilioStatus,
      },
      request: getAuditRequestContext(c),
    })

    return c.json(
      {
        message: {
          ...message,
          sentBy: message.sentBy
            ? {
                id: message.sentBy.id,
                name: message.sentBy.name,
                avatarUrl: await resolveAvatarUrl(message.sentBy.avatarUrl),
              }
            : null,
          createdAt: message.createdAt.toISOString(),
          updatedAt: message.updatedAt.toISOString(),
        },
        sent: smsResult.success,
        smsEnabled,
        error: smsError,
      },
      201
    )
  }
)

// GET /leads/:id/messages/unread - Count inbound messages since last read
leadMessagesRoute.get(
  '/:id/messages/unread',
  zValidator('param', leadIdParamSchema),
  async (c) => {
    const { orgId } = getVerifiedAuth(c.get('user'))
    const { id } = c.req.valid('param')

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, messagesLastReadAt: true },
    })
    if (!lead) {
      return c.json({ error: 'NOT_FOUND', message: 'Lead not found' }, 404)
    }

    const unreadCount = await prisma.message.count({
      where: {
        leadId: id,
        direction: 'INBOUND',
        ...(lead.messagesLastReadAt
          ? { createdAt: { gt: lead.messagesLastReadAt } }
          : {}),
      },
    })

    return c.json({ leadId: id, unreadCount })
  }
)

// POST /leads/:id/messages/read - Mark messages as read up to a specific timestamp.
// Accepts optional `upTo` (ISO string of the newest Message.createdAt the client
// has seen). Clamps to min(upTo, now()) so inbound messages arriving during the
// round-trip are NOT silently marked as read.
leadMessagesRoute.post(
  '/:id/messages/read',
  zValidator('param', leadIdParamSchema),
  zValidator('json', markLeadMessagesReadSchema),
  async (c) => {
    const { orgId, staffId } = getVerifiedAuth(c.get('user'))
    const { id } = c.req.valid('param')
    const { upTo } = c.req.valid('json')

    const now = new Date()
    const readAt =
      upTo && upTo.getTime() < now.getTime() ? upTo : now

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, messagesLastReadAt: true },
    })
    if (!lead) {
      return c.json({ error: 'NOT_FOUND', message: 'Lead not found' }, 404)
    }

    const markedMessageCount = await prisma.message.count({
      where: {
        leadId: id,
        direction: 'INBOUND',
        createdAt: lead.messagesLastReadAt
          ? { gt: lead.messagesLastReadAt, lte: readAt }
          : { lte: readAt },
      },
    })

    const shouldAdvanceReadAt =
      !lead.messagesLastReadAt || lead.messagesLastReadAt.getTime() < readAt.getTime()
    const updateResult = shouldAdvanceReadAt
      ? await prisma.lead.updateMany({
        where: {
          id,
          organizationId: orgId,
          OR: [
            { messagesLastReadAt: null },
            { messagesLastReadAt: { lt: readAt } },
          ],
        },
        data: { messagesLastReadAt: readAt },
      })
      : { count: 0 }

    let effectiveReadAt = readAt
    if (updateResult.count === 0) {
      const currentLead = await prisma.lead.findFirst({
        where: { id, organizationId: orgId },
        select: { messagesLastReadAt: true },
      })
      if (
        currentLead?.messagesLastReadAt &&
        currentLead.messagesLastReadAt.getTime() > effectiveReadAt.getTime()
      ) {
        effectiveReadAt = currentLead.messagesLastReadAt
      }
    }

    const unreadCount = await prisma.message.count({
      where: {
        leadId: id,
        direction: 'INBOUND',
        createdAt: { gt: effectiveReadAt },
      },
    })

    const completedActions = unreadCount === 0
      ? await prisma.action.updateMany({
        where: {
          leadId: id,
          type: 'LEAD_REPLIED',
          isCompleted: false,
        },
        data: {
          isCompleted: true,
          completedAt: effectiveReadAt,
        },
      })
      : { count: 0 }

    if (markedMessageCount > 0 && updateResult.count > 0) {
      await logStaffActivity({
        organizationId: orgId,
        actorStaffId: staffId,
        category: ACTIVITY_CATEGORIES.LEAD,
        targetType: ACTIVITY_TARGET_TYPES.LEAD,
        targetId: id,
        summary: 'Marked lead messages read',
        action: ACTIVITY_ACTIONS.LEAD.MESSAGE_READ,
        riskLevel: ActivityRiskLevel.LOW,
        metadata: {
          leadId: id,
          readAt: effectiveReadAt.toISOString(),
          markedMessageCount,
          unreadCount,
          completedLeadReplyActions: completedActions.count,
        },
        request: getAuditRequestContext(c),
      })
    }

    if (updateResult.count > 0 || completedActions.count > 0) {
      publishLeadReadEvent(id, {
        unreadCount,
        readAt: effectiveReadAt.toISOString(),
      }).catch(() => {})
    }

    return c.json({ leadId: id, unreadCount, readAt: effectiveReadAt.toISOString() })
  }
)

export { leadMessagesRoute }
