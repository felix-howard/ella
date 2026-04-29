/**
 * Lead Messages API routes
 * Two-way Staff ↔ Lead SMS via polymorphic Message.leadId.
 * Dual-writes to SmsSendLog during 2-week transition (brainstorm §7).
 *
 * Mounted at `/leads` alongside leadsRoute:
 *   GET    /leads/:id/messages
 *   POST   /leads/:id/messages/send
 *   GET    /leads/:id/messages/unread
 *   POST   /leads/:id/messages/read
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import { getPaginationParams, buildPaginationResponse } from '../../lib/constants'
import { authMiddleware, requireOrgAdmin } from '../../middleware/auth'
import type { AuthVariables } from '../../middleware/auth'
import { sendSmsOnly, isSmsEnabled } from '../../services/sms'
import { publishMessageEventFromLead } from '../../services/realtime/message-publisher'
import { leadIdParamSchema } from './schemas'
import {
  sendLeadMessageSchema,
  listLeadMessagesQuerySchema,
  markLeadMessagesReadSchema,
} from './messages-schemas'
import { getVerifiedAuth } from './auth-helpers'

const leadMessagesRoute = new Hono<{ Variables: AuthVariables }>()

// All lead-message routes require authenticated staff in an org.
leadMessagesRoute.use('/:id/messages', authMiddleware, requireOrgAdmin)
leadMessagesRoute.use('/:id/messages/*', authMiddleware, requireOrgAdmin)

// GET /leads/:id/messages - Chat history (oldest first for chat display)
leadMessagesRoute.get(
  '/:id/messages',
  zValidator('param', leadIdParamSchema),
  zValidator('query', listLeadMessagesQuerySchema),
  async (c) => {
    const { orgId } = getVerifiedAuth(c.get('user'))
    const { id } = c.req.valid('param')
    const { page, limit } = c.req.valid('query')
    const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)

    // 404 on cross-org (never 403) per security requirement.
    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    })
    if (!lead) {
      return c.json({ error: 'NOT_FOUND', message: 'Lead not found' }, 404)
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { leadId: id },
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'asc' },
        include: {
          sentBy: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.message.count({ where: { leadId: id } }),
    ])

    return c.json({
      messages: messages.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
      pagination: buildPaginationResponse(safePage, safeLimit, total),
    })
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
    const twilioStatus = smsResult.success
      ? (smsResult.status || 'queued')
      : `ERROR: ${smsResult.error ?? 'unknown'}`

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
            error: smsResult.error ?? null,
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

    return c.json(
      {
        message: {
          ...message,
          createdAt: message.createdAt.toISOString(),
          updatedAt: message.updatedAt.toISOString(),
        },
        sent: smsResult.success,
        smsEnabled,
        error: smsResult.error,
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
    const { orgId } = getVerifiedAuth(c.get('user'))
    const { id } = c.req.valid('param')
    const { upTo } = c.req.valid('json')

    const now = new Date()
    const readAt =
      upTo && upTo.getTime() < now.getTime() ? upTo : now

    const { count } = await prisma.lead.updateMany({
      where: { id, organizationId: orgId },
      data: { messagesLastReadAt: readAt },
    })
    if (count === 0) {
      return c.json({ error: 'NOT_FOUND', message: 'Lead not found' }, 404)
    }

    const unreadCount = await prisma.message.count({
      where: {
        leadId: id,
        direction: 'INBOUND',
        createdAt: { gt: readAt },
      },
    })

    return c.json({ leadId: id, unreadCount, readAt: readAt.toISOString() })
  }
)

export { leadMessagesRoute }
