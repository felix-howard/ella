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
import { sendMessageSchema, listMessagesQuerySchema } from './schemas'
import type { MessageChannel, MessageDirection } from '@ella/db'

const messagesRoute = new Hono()

// GET /messages/:caseId - Get conversation for case
messagesRoute.get('/:caseId', zValidator('query', listMessagesQuerySchema), async (c) => {
  const caseId = c.req.param('caseId')
  const { page, limit } = c.req.valid('query')
  const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)

  // Get or create conversation
  let conversation = await prisma.conversation.findUnique({
    where: { caseId },
  })

  if (!conversation) {
    // Create conversation if it doesn't exist
    conversation = await prisma.conversation.create({
      data: { caseId },
    })
  }

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

  return c.json({
    conversation: {
      ...conversation,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    },
    messages: messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
    pagination: buildPaginationResponse(safePage, safeLimit, total),
  })
})

// POST /messages/send - Send message to client
messagesRoute.post('/send', zValidator('json', sendMessageSchema), async (c) => {
  const { caseId, content, channel, templateName } = c.req.valid('json')

  // Get or create conversation
  let conversation = await prisma.conversation.findUnique({
    where: { caseId },
    include: {
      taxCase: { include: { client: true } },
    },
  })

  if (!conversation) {
    // Verify case exists
    const taxCase = await prisma.taxCase.findUnique({
      where: { id: caseId },
      include: { client: true },
    })

    if (!taxCase) {
      return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
    }

    conversation = await prisma.conversation.create({
      data: { caseId },
      include: {
        taxCase: { include: { client: true } },
      },
    })
  }

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

  // SMS sending will be implemented in Phase 3 (Twilio integration)
  // For now, just record the message
  const smsSent = channel === 'SYSTEM' ? true : false // SMS not implemented yet

  return c.json(
    {
      message: {
        ...message,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
      },
      sent: smsSent,
    },
    201
  )
})

export { messagesRoute }
