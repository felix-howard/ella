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
import { getSignedDownloadUrl } from '../../services/storage'
import type { MessageChannel, MessageDirection } from '@ella/db'
import { buildClientScopeFilter } from '../../lib/org-scope'
import type { AuthVariables } from '../../middleware/auth'

/**
 * Extract R2 keys from signed R2 URLs
 * Used to auto-repair messages that have URLs but missing R2 keys
 *
 * URL format: https://{bucket}.{account}.r2.cloudflarestorage.com/{key}?{queryParams}
 * Example: https://ella-documents.xxx.r2.cloudflarestorage.com/cases/abc/raw/123.jpg?X-Amz-...
 * Returns: cases/abc/raw/123.jpg
 */
function extractR2KeysFromUrls(urls: string[]): string[] {
  const keys: string[] = []

  for (const url of urls) {
    try {
      // Check if it's an R2 URL
      if (!url.includes('r2.cloudflarestorage.com')) {
        continue
      }

      const urlObj = new URL(url)
      // The pathname starts with /, so we remove it
      const key = urlObj.pathname.substring(1)

      if (key && key.startsWith('cases/')) {
        keys.push(key)
      }
    } catch {
      // Invalid URL, skip
      continue
    }
  }

  return keys
}

const messagesRoute = new Hono<{ Variables: AuthVariables }>()

// GET /messages/conversations - List all conversations for unified inbox
messagesRoute.get(
  '/conversations',
  zValidator('query', listConversationsQuerySchema),
  async (c) => {
    const { page, limit, unreadOnly } = c.req.valid('query')
    const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)
    const user = c.get('user')

    // Build where clause with org scope through taxCase -> client
    const where: Record<string, unknown> = {
      taxCase: { client: buildClientScopeFilter(user) },
      ...(unreadOnly ? { unreadCount: { gt: 0 } } : {}),
    }

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

    // Calculate total unread across all conversations (org-scoped)
    const totalUnread = await prisma.conversation.aggregate({
      where: { taxCase: { client: buildClientScopeFilter(user) } },
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

// GET /messages/media/:messageId/:index - Proxy endpoint to serve message attachments
// Bypasses CORS issues with direct R2 signed URLs by proxying through the API
messagesRoute.get('/media/:messageId/:index', async (c) => {
  const messageId = c.req.param('messageId')
  const index = parseInt(c.req.param('index'), 10)
  const user = c.get('user')

  if (isNaN(index) || index < 0) {
    return c.json({ error: 'INVALID_INDEX', message: 'Invalid attachment index' }, 400)
  }

  // Org-scoped: verify message belongs to user's org via conversation -> taxCase -> client
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      conversation: { taxCase: { client: buildClientScopeFilter(user) } },
    },
    select: {
      attachmentR2Keys: true,
      attachmentUrls: true,
      conversation: { select: { caseId: true } },
    },
  })

  if (!message) {
    return c.json({ error: 'NOT_FOUND', message: 'Message not found' }, 404)
  }

  // Get R2 key for the requested attachment index
  let r2Key: string | undefined

  if (message.attachmentR2Keys && message.attachmentR2Keys[index]) {
    r2Key = message.attachmentR2Keys[index]
  } else if (message.attachmentUrls && message.attachmentUrls[index]) {
    // Fallback: extract R2 key from stored URL
    const keys = extractR2KeysFromUrls([message.attachmentUrls[index]])
    r2Key = keys[0]
  }

  if (!r2Key) {
    return c.json({ error: 'NO_ATTACHMENT', message: 'Attachment not found at index' }, 404)
  }

  // Helper: fetch file from R2 by key and return Response
  const fetchFromR2 = async (key: string) => {
    const signedUrl = await getSignedDownloadUrl(key)
    if (!signedUrl) return null

    const response = await fetch(signedUrl)
    if (!response.ok) return null

    const arrayBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  }

  try {
    // Try fetching with stored R2 key first
    const result = await fetchFromR2(r2Key)
    if (result) return result

    // Fallback: the file was likely renamed by AI classification.
    // The old raw key (e.g. cases/{caseId}/raw/{ts}-{rand}.jpg) no longer exists in R2.
    // Look up renamed RawImages for this case that were uploaded via SMS.
    const caseId = message.conversation?.caseId
    if (caseId) {
      const smsImages = await prisma.rawImage.findMany({
        where: { caseId, uploadedVia: 'SMS' },
        select: { r2Key: true },
        orderBy: { createdAt: 'asc' },
      })

      // Try the image at the same index position (MMS attachments are ordered)
      const candidate = smsImages[index]
      if (candidate && candidate.r2Key !== r2Key) {
        console.log(`[Messages] R2 key renamed: ${r2Key} -> ${candidate.r2Key} (message: ${messageId})`)
        const renamedResult = await fetchFromR2(candidate.r2Key)
        if (renamedResult) {
          // Auto-repair: update message with current R2 key (fire and forget)
          const updatedKeys = [...(message.attachmentR2Keys || [])]
          updatedKeys[index] = candidate.r2Key
          prisma.message.update({
            where: { id: messageId },
            data: { attachmentR2Keys: updatedKeys },
          }).catch(err => console.error(`[Messages] Failed to repair R2 key for message ${messageId}:`, err))

          return renamedResult
        }
      }
    }

    console.error(`[Messages] R2 fetch failed for key ${r2Key} (message: ${messageId})`)
    return c.json({ error: 'FETCH_ERROR', message: 'Failed to fetch file from storage' }, 500)
  } catch (error) {
    console.error(`[Messages] Failed to proxy media for message ${messageId}:`, error)
    return c.json({ error: 'PROXY_ERROR', message: 'Failed to serve attachment' }, 500)
  }
})

// GET /messages/:caseId/unread - Get unread count for a specific case
messagesRoute.get('/:caseId/unread', async (c) => {
  const caseId = c.req.param('caseId')
  const user = c.get('user')

  const conversation = await prisma.conversation.findFirst({
    where: { caseId, taxCase: { client: buildClientScopeFilter(user) } },
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
  const user = c.get('user')

  // Verify case belongs to user's org before accessing conversation
  const caseCheck = await prisma.taxCase.findFirst({
    where: { id: caseId, client: buildClientScopeFilter(user) },
    select: { id: true },
  })
  if (!caseCheck) {
    return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
  }

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

  // Build proxy URLs for messages with attachments
  // Uses /messages/media/:messageId/:index proxy to bypass R2 CORS restrictions
  const messagesWithProxyUrls = messages.map((m) => {
    // Auto-repair: extract R2 keys from stored URLs if keys are missing
    if ((!m.attachmentR2Keys || m.attachmentR2Keys.length === 0) &&
        m.attachmentUrls && m.attachmentUrls.length > 0) {
      const extractedKeys = extractR2KeysFromUrls(m.attachmentUrls)
      if (extractedKeys.length > 0) {
        console.log(`[Messages] Auto-repairing message ${m.id}: extracted ${extractedKeys.length} R2 keys from URLs`)
        // Update the message with extracted R2 keys (fire and forget)
        prisma.message.update({
          where: { id: m.id },
          data: { attachmentR2Keys: extractedKeys },
        }).catch(err => console.error(`[Messages] Failed to update R2 keys for message ${m.id}:`, err))

        // Set keys so proxy URLs are generated below
        m.attachmentR2Keys = extractedKeys
      }
    }

    // Generate proxy URLs for attachments
    const hasR2Keys = m.attachmentR2Keys && m.attachmentR2Keys.length > 0
    const attachmentCount = hasR2Keys
      ? m.attachmentR2Keys!.length
      : (m.attachmentUrls?.length || 0)

    const proxyUrls = attachmentCount > 0
      ? Array.from({ length: attachmentCount }, (_, i) => `/messages/media/${m.id}/${i}`)
      : m.attachmentUrls || []

    return {
      ...m,
      attachmentUrls: proxyUrls,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }
  })

  return c.json({
    conversation: {
      ...conversation,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    },
    messages: messagesWithProxyUrls,
    pagination: buildPaginationResponse(safePage, safeLimit, total),
  })
})

// POST /messages/send - Send message to client
messagesRoute.post('/send', zValidator('json', sendMessageSchema), async (c) => {
  const { caseId, content, channel, templateName } = c.req.valid('json')
  const user = c.get('user')

  // Verify case exists and belongs to user's org
  const taxCase = await prisma.taxCase.findFirst({
    where: { id: caseId, client: buildClientScopeFilter(user) },
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
  const user = c.get('user')

  // Verify case exists and belongs to user's org
  const taxCase = await prisma.taxCase.findFirst({
    where: { id: caseId, client: buildClientScopeFilter(user) },
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
