/**
 * Messages API routes
 * Conversation and messaging operations
 */
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
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
import { publishMessageEventFromConversation } from '../../services/realtime/message-publisher'
import {
  sendSmsOnly,
  isSmsEnabled,
  notifyMissingDocuments,
  sendBatchMissingReminders,
} from '../../services/sms'
import {
  getStorageStatus,
  getSafeStorageError,
  getSafeStorageReference,
  getSignedDownloadUrl,
  resolveAvatarUrl,
  SENSITIVE_DOC_SIGNED_URL_TTL_SECONDS,
  uploadFile,
  deleteFile,
} from '../../services/storage'
import { ActivityRiskLevel, type MessageChannel, type MessageDirection } from '@ella/db'
import { buildClientScopeFilter, isAdminOrManager } from '../../lib/org-scope'
import { serializePhone } from '../../lib/phone-privacy'
import { isBizWithGroup } from '../../lib/client-helpers'
import { inngest } from '../../lib/inngest'
import type { AuthVariables } from '../../middleware/auth'
import { getAuditRequestContext, logStaffActivity } from '../../services/activity-log'
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, ACTIVITY_TARGET_TYPES } from '../../services/activity-actions'
import {
  generateMessageAttachmentKey,
  generateMessageAttachmentUploadId,
  getMessageAttachmentValues,
  MAX_MMS_REQUEST_BYTES,
  validateMessageImageFiles,
} from './message-attachment-upload'

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

      if (key && (key.startsWith('cases/') || key.startsWith('message-attachments/'))) {
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

function withoutAttachmentR2Keys<T extends object>(message: T): Omit<T, 'attachmentR2Keys'> {
  const copy = { ...message } as T & { attachmentR2Keys?: unknown }
  delete copy.attachmentR2Keys
  return copy
}

function getOptionalFormString(formData: FormData, key: string): string | null {
  const value = formData.get(key)
  if (value === null) return null
  return typeof value === 'string' ? value : null
}

async function cleanupUploadedMessageAttachments(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => deleteFile(key).catch(() => false)))
}

function getTwilioStatusCategory(status: string | null): string | null {
  if (!status) return null
  if (status.startsWith('ERROR:')) return 'failed'
  return status
}

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
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  language: true,
                  clientType: true,
                  clientGroupId: true,
                  clientGroup: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
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
              attachmentUrls: true,
              sentBy: {
                select: { id: true, name: true, avatarUrl: true },
              },
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

    const avatarCache = new Map<string, string | null>()
    for (const conv of conversations) {
      const sentBy = conv.messages[0]?.sentBy
      if (sentBy && !avatarCache.has(sentBy.id)) {
        avatarCache.set(sentBy.id, await resolveAvatarUrl(sentBy.avatarUrl))
      }
    }

    return c.json({
      conversations: conversations.map((conv) => ({
        id: conv.id,
        caseId: conv.caseId,
        unreadCount: conv.unreadCount,
        lastMessageAt: conv.lastMessageAt?.toISOString() || null,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
        client: {
          id: conv.taxCase.client.id,
          name: conv.taxCase.client.name,
          phone: serializePhone(user, conv.taxCase.client.phone),
          language: conv.taxCase.client.language,
          clientType: conv.taxCase.client.clientType,
          clientGroupId: conv.taxCase.client.clientGroupId,
          clientGroupName: conv.taxCase.client.clientGroup?.name ?? null,
        },
        taxCase: {
          id: conv.taxCase.id,
          taxYear: conv.taxCase.taxYear,
          status: conv.taxCase.status,
        },
        lastMessage: conv.messages[0]
          ? {
              ...withoutAttachmentR2Keys(conv.messages[0]),
              attachmentUrls: conv.messages[0].attachmentUrls?.length
                ? Array.from(
                    { length: conv.messages[0].attachmentUrls.length },
                    (_, i) => `/messages/media/${conv.messages[0].id}/${i}`
                  )
                : [],
              sentBy: conv.messages[0].sentBy
                ? {
                    id: conv.messages[0].sentBy.id,
                    name: conv.messages[0].sentBy.name,
                    avatarUrl: avatarCache.get(conv.messages[0].sentBy.id) ?? null,
                  }
                : null,
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
    const signedUrl = await getSignedDownloadUrl(key, SENSITIVE_DOC_SIGNED_URL_TTL_SECONDS)
    if (!signedUrl) return null

    const response = await fetch(signedUrl)
    if (!response.ok) return null

    const arrayBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, no-store, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
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
        console.log('[Messages] R2 key renamed', {
          from: getSafeStorageReference(r2Key),
          to: getSafeStorageReference(candidate.r2Key),
          messageId,
        })
        const renamedResult = await fetchFromR2(candidate.r2Key)
        if (renamedResult) {
          // Auto-repair: update message with current R2 key (fire and forget)
          const updatedKeys = [...(message.attachmentR2Keys || [])]
          updatedKeys[index] = candidate.r2Key
          prisma.message.update({
            where: { id: messageId },
            data: { attachmentR2Keys: updatedKeys },
          }).catch((err) =>
            console.error('[Messages] Failed to repair R2 key', {
              messageId,
              object: getSafeStorageReference(candidate.r2Key),
              error: getSafeStorageError(err),
            })
          )

          return renamedResult
        }
      }
    }

    console.error('[Messages] R2 fetch failed', {
      object: getSafeStorageReference(r2Key),
      messageId,
    })
    return c.json({ error: 'FETCH_ERROR', message: 'Failed to fetch file from storage' }, 500)
  } catch (error) {
    console.error('[Messages] Failed to proxy media', {
      messageId,
      error: getSafeStorageError(error),
    })
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
    select: { id: true, client: { select: { clientType: true, clientGroupId: true } } },
  })
  if (!caseCheck) {
    return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
  }

  // Prevent conversation creation for business cases linked to an individual via group
  if (isBizWithGroup(caseCheck.client)) {
    console.warn(`[Messages] Blocked conversation upsert for business case ${caseId} — use individual's case`)
    return c.json({ error: 'BUSINESS_CASE', message: 'Use the individual owner\'s case for messaging' }, 400)
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
      include: {
        sentBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
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

  // Pre-resolve avatar URLs, deduplicated by staffId
  const avatarCache = new Map<string, string | null>()
  for (const m of messages) {
    if (m.sentBy && !avatarCache.has(m.sentBy.id)) {
      avatarCache.set(m.sentBy.id, await resolveAvatarUrl(m.sentBy.avatarUrl))
    }
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
      ...withoutAttachmentR2Keys(m),
      attachmentUrls: proxyUrls,
      sentBy: m.sentBy
        ? { id: m.sentBy.id, name: m.sentBy.name, avatarUrl: avatarCache.get(m.sentBy.id) ?? null }
        : null,
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

  // Prevent messaging on business cases linked to an individual via group
  if (isBizWithGroup(taxCase.client)) {
    console.warn(`[Messages] Blocked send to business case ${caseId} — use individual's case`)
    return c.json({ error: 'BUSINESS_CASE', message: 'Use the individual owner\'s case for messaging' }, 400)
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

  // Create message record with sender info
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      channel: channel as MessageChannel,
      direction: 'OUTBOUND' as MessageDirection,
      content,
      templateUsed: templateName,
      sentById: user.staffId,
    },
    include: {
      sentBy: {
        select: { id: true, name: true, avatarUrl: true },
      },
    },
  })

  // Publish realtime event (non-blocking)
  publishMessageEventFromConversation(conversation.id, {
    id: message.id,
    direction: 'OUTBOUND',
    channel: channel as 'SMS' | 'PORTAL' | 'CALL',
  }).catch(() => {})

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
  let twilioStatus: string | null = null

  if (channel === 'SMS' && isSmsEnabled()) {
    // Use sendSmsOnly to avoid creating duplicate message record
    const result = await sendSmsOnly(taxCase.client.phone, content)
    smsSent = result.success
    smsError = result.error

    // Update message with Twilio response
    if (result.success && result.sid) {
      twilioStatus = result.status || 'queued'
      await prisma.message.update({
        where: { id: message.id },
        data: {
          twilioSid: result.sid,
          twilioStatus,
        },
      })
    } else if (!result.success) {
      twilioStatus = `ERROR: ${smsError}`
      await prisma.message.update({
        where: { id: message.id },
        data: {
          twilioSid: null,
          twilioStatus,
        },
      })
    }
  } else if (channel !== 'SMS') {
    // System/Portal messages don't need SMS
    smsSent = true
  }

  // Emit chat monitoring event for staff outbound messages
  if (user.staffId) {
    const clientName = taxCase.client.name ||
      `${taxCase.client.firstName} ${taxCase.client.lastName || ''}`.trim()
    inngest.send({
      name: 'message/staff-sent',
      data: {
        staffId: user.staffId,
        staffName: message.sentBy?.name || 'Staff',
        caseId,
        clientName,
        staffCaseKey: `${user.staffId}-${caseId}`,
      },
    }).catch((err) => {
      console.error('[Messages] Failed to emit staff chat event:', err)
    })
  }

  if (user.staffId) {
    await logStaffActivity({
      organizationId: user.organizationId,
      clientId: taxCase.client.id,
      caseId,
      actorStaffId: user.staffId,
      category: ACTIVITY_CATEGORIES.MESSAGE,
      targetType: ACTIVITY_TARGET_TYPES.MESSAGE,
      targetId: message.id,
      targetLabel: taxCase.client.name,
      summary: channel === 'SMS' ? 'Sent SMS to client' : 'Sent portal message to client',
      action: ACTIVITY_ACTIONS.MESSAGE.SENT,
      riskLevel: ActivityRiskLevel.LOW,
      coalesceKey: `message.sent:${channel}:${caseId}:${user.staffId}`,
      metadata: {
        channel,
        messageId: message.id,
        conversationId: conversation.id,
        templateName,
        smsSent,
        twilioStatusCategory: getTwilioStatusCategory(twilioStatus),
      },
      request: getAuditRequestContext(c),
    })
  }

  return c.json(
    {
      message: {
        ...withoutAttachmentR2Keys(message),
        twilioStatus,
        sentBy: message.sentBy
          ? { id: message.sentBy.id, name: message.sentBy.name, avatarUrl: await resolveAvatarUrl(message.sentBy.avatarUrl) }
          : null,
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

// POST /messages/send-with-attachments - Send case message with optional MMS images
messagesRoute.post('/send-with-attachments', bodyLimit({ maxSize: MAX_MMS_REQUEST_BYTES }), async (c) => {
  const user = c.get('user')
  if (!user.organizationId) {
    return c.json({ error: 'NO_ORGANIZATION', message: 'Organization required' }, 403)
  }

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'INVALID_MULTIPART', message: 'Expected multipart form data' }, 400)
  }

  const caseIdValue = getOptionalFormString(formData, 'caseId')
  const contentValue = getOptionalFormString(formData, 'content')
  const templateNameValue = getOptionalFormString(formData, 'templateName')

  if (
    caseIdValue === null ||
    (formData.has('content') && contentValue === null) ||
    (formData.has('templateName') && templateNameValue === null)
  ) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid multipart field type' }, 400)
  }

  const caseId = caseIdValue.trim()
  const content = (contentValue ?? '').trim()
  const templateName = templateNameValue?.trim() || undefined

  if (!caseId) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'Case ID is required' }, 400)
  }

  if (content.length > 1000) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'Message content must be 1000 characters or less' }, 400)
  }

  const validation = await validateMessageImageFiles(getMessageAttachmentValues(formData))
  if (!validation.ok) {
    return c.json({ error: validation.error, message: validation.message }, validation.status)
  }

  if (!content && validation.images.length === 0) {
    return c.json({ error: 'EMPTY_MESSAGE', message: 'Message content or image attachment is required' }, 400)
  }

  if (validation.images.length > 0 && !getStorageStatus().configured) {
    return c.json({ error: 'STORAGE_NOT_CONFIGURED', message: 'Image message storage is not configured' }, 503)
  }

  // Verify case exists and belongs to user's org
  const taxCase = await prisma.taxCase.findFirst({
    where: { id: caseId, client: buildClientScopeFilter(user) },
    include: { client: true },
  })

  if (!taxCase) {
    return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
  }

  // Prevent messaging on business cases linked to an individual via group
  if (isBizWithGroup(taxCase.client)) {
    console.warn(`[Messages] Blocked send to business case ${caseId} — use individual's case`)
    return c.json({ error: 'BUSINESS_CASE', message: 'Use the individual owner\'s case for messaging' }, 400)
  }

  const attachmentR2Keys: string[] = []
  const attachmentUrls: string[] = []
  const uploadId = generateMessageAttachmentUploadId()

  for (const [index, image] of validation.images.entries()) {
    const key = generateMessageAttachmentKey({
      organizationId: user.organizationId,
      caseId,
      uploadId,
      extension: image.extension,
      index,
    })

    try {
      const upload = await uploadFile(key, image.buffer, image.contentType)
      if (!upload.url) {
        await cleanupUploadedMessageAttachments([...attachmentR2Keys, upload.key])
        return c.json({ error: 'STORAGE_NOT_CONFIGURED', message: 'Image message storage is not configured' }, 503)
      }
      attachmentR2Keys.push(upload.key)
      attachmentUrls.push(upload.url)
    } catch (error) {
      await cleanupUploadedMessageAttachments([...attachmentR2Keys, key])
      console.error('[Messages] Failed to upload message attachment', {
        object: getSafeStorageReference(key),
        error: getSafeStorageError(error),
      })
      return c.json({ error: 'UPLOAD_FAILED', message: 'Failed to upload image attachment' }, 500)
    }
  }

  const persisted = await (async () => {
    try {
      // Get or create conversation using upsert to prevent race conditions
      const conversation = await prisma.conversation.upsert({
        where: { caseId },
        update: {},
        create: { caseId },
        include: {
          taxCase: { include: { client: true } },
        },
      })

      // Create message record with sender info
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          channel: 'SMS' as MessageChannel,
          direction: 'OUTBOUND' as MessageDirection,
          content,
          templateUsed: templateName,
          sentById: user.staffId,
          ...(attachmentUrls.length > 0 ? { attachmentUrls, attachmentR2Keys } : {}),
        },
        include: {
          sentBy: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      })

      return { ok: true as const, conversation, message }
    } catch (error) {
      await cleanupUploadedMessageAttachments(attachmentR2Keys)
      console.error('[Messages] Failed to persist message attachment record', {
        attachmentCount: attachmentR2Keys.length,
        error: {
          name: error instanceof Error ? error.name : undefined,
          message: 'Message attachment persistence failed',
        },
      })
      return { ok: false as const }
    }
  })()

  if (!persisted.ok) {
    return c.json({ error: 'MESSAGE_CREATE_FAILED', message: 'Failed to create image message' }, 500)
  }

  const { conversation, message } = persisted

  // Publish realtime event (non-blocking)
  publishMessageEventFromConversation(conversation.id, {
    id: message.id,
    direction: 'OUTBOUND',
    channel: 'SMS',
  }).catch(() => {})

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

  // Send SMS/MMS if Twilio is configured
  let smsSent = false
  let smsError: string | undefined
  let twilioStatus: string | null = null

  if (isSmsEnabled()) {
    const result = await sendSmsOnly(
      taxCase.client.phone,
      content,
      attachmentUrls.length > 0 ? { mediaUrls: attachmentUrls } : undefined
    )
    smsSent = result.success
    smsError = result.error

    if (result.success && result.sid) {
      twilioStatus = result.status || 'queued'
      await prisma.message.update({
        where: { id: message.id },
        data: {
          twilioSid: result.sid,
          twilioStatus,
        },
      })
    } else if (!result.success) {
      twilioStatus = `ERROR: ${smsError}`
      await prisma.message.update({
        where: { id: message.id },
        data: {
          twilioSid: null,
          twilioStatus,
        },
      })
    }
  }

  // Emit chat monitoring event for staff outbound messages
  if (user.staffId) {
    const clientName = taxCase.client.name ||
      `${taxCase.client.firstName} ${taxCase.client.lastName || ''}`.trim()
    inngest.send({
      name: 'message/staff-sent',
      data: {
        staffId: user.staffId,
        staffName: message.sentBy?.name || 'Staff',
        caseId,
        clientName,
        staffCaseKey: `${user.staffId}-${caseId}`,
      },
    }).catch((err) => {
      console.error('[Messages] Failed to emit staff chat event:', err)
    })
  }

  if (user.staffId) {
    await logStaffActivity({
      organizationId: user.organizationId,
      clientId: taxCase.client.id,
      caseId,
      actorStaffId: user.staffId,
      category: ACTIVITY_CATEGORIES.MESSAGE,
      targetType: ACTIVITY_TARGET_TYPES.MESSAGE,
      targetId: message.id,
      targetLabel: taxCase.client.name,
      summary: attachmentUrls.length > 0 ? 'Sent MMS to client' : 'Sent SMS to client',
      action: ACTIVITY_ACTIONS.MESSAGE.SENT,
      riskLevel: ActivityRiskLevel.LOW,
      coalesceKey: `message.sent:SMS:${caseId}:${user.staffId}`,
      metadata: {
        channel: 'SMS',
        messageId: message.id,
        conversationId: conversation.id,
        templateName,
        smsSent,
        attachmentCount: attachmentUrls.length,
        twilioStatusCategory: getTwilioStatusCategory(twilioStatus),
      },
      request: getAuditRequestContext(c),
    })
  }

  return c.json(
    {
      message: {
        ...withoutAttachmentR2Keys(message),
        twilioStatus,
        attachmentUrls: attachmentR2Keys.map((_, i) => `/messages/media/${message.id}/${i}`),
        sentBy: message.sentBy
          ? { id: message.sentBy.id, name: message.sentBy.name, avatarUrl: await resolveAvatarUrl(message.sentBy.avatarUrl) }
          : null,
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
    select: { id: true, clientId: true, status: true },
  })

  if (!taxCase) {
    return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
  }

  if (!isSmsEnabled()) {
    return c.json({ error: 'SMS_DISABLED', message: 'SMS is not configured' }, 400)
  }

  const result = await notifyMissingDocuments(caseId)

  if (user.staffId) {
    await logStaffActivity({
      organizationId: user.organizationId,
      clientId: taxCase.clientId,
      caseId,
      actorStaffId: user.staffId,
      category: ACTIVITY_CATEGORIES.MESSAGE,
      targetType: result.messageId ? ACTIVITY_TARGET_TYPES.MESSAGE : ACTIVITY_TARGET_TYPES.CASE,
      targetId: result.messageId ?? caseId,
      summary: 'Sent missing document reminder',
      action: ACTIVITY_ACTIONS.MESSAGE.REMINDER_SENT,
      riskLevel: ActivityRiskLevel.LOW,
      metadata: {
        channel: 'SMS',
        messageId: result.messageId,
        smsSent: result.smsSent,
        result: result.success ? 'sent' : 'failed',
      },
      request: getAuditRequestContext(c),
    })
  }

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
  const user = c.get('user')

  if (!isAdminOrManager(user)) {
    return c.json({ error: 'Admin access required' }, 403)
  }

  if (!user.organizationId) {
    return c.json({ error: 'No organization' }, 403)
  }

  if (!isSmsEnabled()) {
    return c.json({ error: 'SMS_DISABLED', message: 'SMS is not configured' }, 400)
  }

  const result = await sendBatchMissingReminders(user.organizationId)

  if (user.staffId) {
    await logStaffActivity({
      organizationId: user.organizationId,
      actorStaffId: user.staffId,
      category: ACTIVITY_CATEGORIES.MESSAGE,
      targetType: ACTIVITY_TARGET_TYPES.ORGANIZATION,
      targetId: user.organizationId,
      summary: 'Triggered batch missing document reminders',
      action: ACTIVITY_ACTIONS.MESSAGE.BATCH_REMINDER_SENT,
      riskLevel: ActivityRiskLevel.MEDIUM,
      metadata: {
        channel: 'SMS',
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
      },
      request: getAuditRequestContext(c),
    })
  }

  return c.json({
    success: true,
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
    details: result.details,
  })
})

export { messagesRoute }
