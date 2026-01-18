/**
 * Messages API routes
 * Conversation and messaging operations
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import {
  getPaginationParams,
  buildPaginationResponse,
} from '../../lib/constants'
import {
  sendMessageSchema,
  listMessagesQuerySchema,
  listConversationsQuerySchema,
} from './schemas'
import {
  sendSmsOnly,
  isSmsEnabled,
  notifyMissingDocuments,
  sendBatchMissingReminders,
} from '../../services/sms'
import { refreshAttachmentUrls } from '../../services/sms/mms-media-handler'
import type { MessageChannel, MessageDirection } from '@ella/db'

const messagesRoute = new Hono()

// GET /messages/conversations - List all conversations for unified inbox
messagesRoute.get(
  '/conversations',
  zValidator('query', listConversationsQuerySchema),
  async (c) => {
    const { page, limit, unreadOnly } = c.req.valid('query')
    const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)

    // Build where clause
    const where = unreadOnly ? { unreadCount: { gt: 0 } } : {}

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: [
          { lastMessageAt: 'desc' },
          { createdAt: 'desc' }, // Secondary sort for same/null lastMessageAt
        ],
        include: {
          taxCase: {
            include: {
              client: {
                select: { id: true, name: true, phone: true, language: true },
              },
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              content: true,
              channel: true,
              direction: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.conversation.count({ where }),
    ])

    // Calculate total unread across all conversations
    const totalUnread = await prisma.conversation.aggregate({
      _sum: { unreadCount: true },
    })

    return c.json({
      conversations: conversations.map((conv) => ({
        id: conv.id,
        caseId: conv.caseId,
        unreadCount: conv.unreadCount,
        lastMessageAt: conv.lastMessageAt?.toISOString() || null,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
        client: conv.taxCase.client,
        taxCase: {
          id: conv.taxCase.id,
          taxYear: conv.taxCase.taxYear,
          status: conv.taxCase.status,
        },
        lastMessage: conv.messages[0]
          ? {
              ...conv.messages[0],
              createdAt: conv.messages[0].createdAt.toISOString(),
            }
          : null,
      })),
      totalUnread: totalUnread._sum.unreadCount || 0,
      pagination: buildPaginationResponse(safePage, safeLimit, total),
    })
  }
)

// GET /messages/:caseId/unread - Get unread count for a specific case
messagesRoute.get('/:caseId/unread', async (c) => {
  const caseId = c.req.param('caseId')

  const conversation = await prisma.conversation.findUnique({
    where: { caseId },
    select: { unreadCount: true },
  })

  return c.json({
    caseId,
    unreadCount: conversation?.unreadCount ?? 0,
  })
})

// GET /messages/:caseId - Get conversation for case
messagesRoute.get('/:caseId', zValidator('query', listMessagesQuerySchema), async (c) => {
  const caseId = c.req.param('caseId')
  const { page, limit } = c.req.valid('query')
  const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)

  // Get or create conversation using upsert to prevent race conditions
  const conversation = await prisma.conversation.upsert({
    where: { caseId },
    update: {}, // No updates needed, just ensure it exists
    create: { caseId },
  })

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: conversation.id },
      skip,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.message.count({
      where: { conversationId: conversation.id },
    }),
  ])

  // Reset unread count when fetching messages
  if (conversation.unreadCount > 0) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { unreadCount: 0 },
    })
  }

  // Refresh signed URLs for messages with attachments (URLs expire after 1 hour)
  const messagesWithRefreshedUrls = await Promise.all(
    messages.map(async (m) => {
      // If message has R2 keys, generate fresh signed URLs
      if (m.attachmentR2Keys && m.attachmentR2Keys.length > 0) {
        const freshUrls = await refreshAttachmentUrls(m.attachmentR2Keys)
        return {
          ...m,
          attachmentUrls: freshUrls,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        }
      }
      return {
        ...m,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      }
    })
  )

  return c.json({
    conversation: {
      ...conversation,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    },
    messages: messagesWithRefreshedUrls,
    pagination: buildPaginationResponse(safePage, safeLimit, total),
  })
})

// POST /messages/send - Send message to client
messagesRoute.post('/send', zValidator('json', sendMessageSchema), async (c) => {
  const { caseId, content, channel, templateName } = c.req.valid('json')

  // Verify case exists first
  const taxCase = await prisma.taxCase.findUnique({
    where: { id: caseId },
    include: { client: true },
  })

  if (!taxCase) {
    return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
  }

  // Get or create conversation using upsert to prevent race conditions
  const conversation = await prisma.conversation.upsert({
    where: { caseId },
    update: {}, // No updates needed, just ensure it exists
    create: { caseId },
    include: {
      taxCase: { include: { client: true } },
    },
  })

  // Create message record
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      channel: channel as MessageChannel,
      direction: 'OUTBOUND' as MessageDirection,
      content,
      templateUsed: templateName,
    },
  })

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  })

  // Update case last contact
  await prisma.taxCase.update({
    where: { id: caseId },
    data: { lastContactAt: new Date() },
  })

  // Send SMS if channel is SMS and Twilio is configured
  let smsSent = false
  let smsError: string | undefined

  if (channel === 'SMS' && isSmsEnabled()) {
    // Use sendSmsOnly to avoid creating duplicate message record
    const result = await sendSmsOnly(taxCase.client.phone, content)
    smsSent = result.success
    smsError = result.error

    // Update message with Twilio response
    if (result.success && result.sid) {
      await prisma.message.update({
        where: { id: message.id },
        data: {
          twilioSid: result.sid,
          twilioStatus: result.status,
        },
      })
    } else if (!result.success) {
      await prisma.message.update({
        where: { id: message.id },
        data: {
          twilioSid: null,
          twilioStatus: `ERROR: ${smsError}`,
        },
      })
    }
  } else if (channel !== 'SMS') {
    // System/Portal messages don't need SMS
    smsSent = true
  }

  return c.json(
    {
      message: {
        ...message,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
      },
      sent: smsSent,
      smsEnabled: isSmsEnabled(),
      error: smsError,
    },
    201
  )
})

// POST /messages/remind/:caseId - Send missing docs reminder to specific case
messagesRoute.post('/remind/:caseId', async (c) => {
  const caseId = c.req.param('caseId')

  // Verify case exists
  const taxCase = await prisma.taxCase.findUnique({
    where: { id: caseId },
    select: { id: true, status: true },
  })

  if (!taxCase) {
    return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
  }

  if (!isSmsEnabled()) {
    return c.json({ error: 'SMS_DISABLED', message: 'SMS is not configured' }, 400)
  }

  const result = await notifyMissingDocuments(caseId)

  return c.json({
    success: result.success,
    smsSent: result.smsSent,
    messageId: result.messageId,
    error: result.error,
  })
})

// POST /messages/remind-batch - Send reminders to all eligible cases
// Should be called by cron job (e.g., daily at 10am)
messagesRoute.post('/remind-batch', async (c) => {
  if (!isSmsEnabled()) {
    return c.json({ error: 'SMS_DISABLED', message: 'SMS is not configured' }, 400)
  }

  const result = await sendBatchMissingReminders()

  return c.json({
    success: true,
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
    details: result.details,
  })
})

export { messagesRoute }
