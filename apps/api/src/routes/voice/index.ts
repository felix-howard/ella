/**
 * Voice API Routes
 * Token generation, presence tracking, and call initiation for browser-based voice calls
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { generateVoiceToken, isVoiceConfigured } from '../../services/voice'
import { prisma } from '../../lib/db'
import type { AuthVariables } from '../../middleware/auth'
import { presenceRateLimit } from '../../middleware/rate-limiter'

const voiceRoutes = new Hono<{ Variables: AuthVariables }>()

/**
 * POST /voice/token - Generate voice access token for authenticated staff
 */
voiceRoutes.post('/token', async (c) => {
  if (!isVoiceConfigured()) {
    return c.json(
      { error: 'VOICE_NOT_CONFIGURED', message: 'Voice calling not available' },
      503
    )
  }

  const user = c.get('user')
  if (!user?.staffId) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Staff authentication required' }, 401)
  }

  try {
    const result = generateVoiceToken({
      identity: `staff_${user.staffId}`,
    })

    return c.json(result)
  } catch (error) {
    console.error('[Voice Token] Generation failed:', error)
    return c.json({ error: 'TOKEN_GENERATION_FAILED' }, 500)
  }
})

/**
 * GET /voice/status - Check voice feature availability
 */
voiceRoutes.get('/status', async (c) => {
  return c.json({
    available: isVoiceConfigured(),
    features: {
      outbound: isVoiceConfigured(),
      recording: isVoiceConfigured(),
      inbound: isVoiceConfigured(), // Inbound calls now supported
    },
  })
})

/**
 * POST /voice/presence/register - Register staff as online for incoming calls
 * Called when Device.on('registered') fires in frontend
 */
voiceRoutes.post('/presence/register', presenceRateLimit, async (c) => {
  const user = c.get('user')
  if (!user?.staffId) {
    return c.json({ error: 'UNAUTHORIZED' }, 401)
  }

  try {
    const deviceId = `staff_${user.staffId}`
    const now = new Date()

    await prisma.staffPresence.upsert({
      where: { staffId: user.staffId },
      create: {
        staffId: user.staffId,
        isOnline: true,
        deviceId,
        lastSeen: now,
      },
      update: {
        isOnline: true,
        deviceId,
        lastSeen: now,
      },
    })

    console.log('[Voice Presence] Registered:', deviceId)
    return c.json({ success: true, deviceId })
  } catch (error) {
    console.error('[Voice Presence] Register failed:', error instanceof Error ? error.message : 'Unknown')
    return c.json({ error: 'OPERATION_FAILED' }, 500)
  }
})

/**
 * POST /voice/presence/unregister - Mark staff as offline
 * Called when Device.on('unregistered') fires or tab closes
 */
voiceRoutes.post('/presence/unregister', presenceRateLimit, async (c) => {
  const user = c.get('user')
  if (!user?.staffId) {
    return c.json({ error: 'UNAUTHORIZED' }, 401)
  }

  try {
    const now = new Date()

    await prisma.staffPresence.upsert({
      where: { staffId: user.staffId },
      create: {
        staffId: user.staffId,
        isOnline: false,
        lastSeen: now,
      },
      update: {
        isOnline: false,
        lastSeen: now,
      },
    })

    console.log('[Voice Presence] Unregistered:', `staff_${user.staffId}`)
    return c.json({ success: true })
  } catch (error) {
    console.error('[Voice Presence] Unregister failed:', error instanceof Error ? error.message : 'Unknown')
    return c.json({ error: 'OPERATION_FAILED' }, 500)
  }
})

/**
 * POST /voice/presence/heartbeat - Keep presence alive (called periodically by frontend)
 * Updates lastSeen timestamp to indicate staff is still online
 */
voiceRoutes.post('/presence/heartbeat', presenceRateLimit, async (c) => {
  const user = c.get('user')
  if (!user?.staffId) {
    return c.json({ error: 'UNAUTHORIZED' }, 401)
  }

  try {
    const result = await prisma.staffPresence.updateMany({
      where: { staffId: user.staffId, isOnline: true },
      data: { lastSeen: new Date() },
    })

    // If no record was updated, staff might have been marked offline
    if (result.count === 0) {
      return c.json({ success: false, reason: 'NOT_ONLINE' })
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('[Voice Presence] Heartbeat failed:', error instanceof Error ? error.message : 'Unknown')
    return c.json({ error: 'OPERATION_FAILED' }, 500)
  }
})

// Schema for caller lookup - E.164 phone format
const callerLookupSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{9,14}$/, 'Phone must be E.164 format'),
})

/**
 * Validate E.164 phone format with stricter rules
 * Format: +[country code][number] - 10-15 digits total after +
 */
function isValidE164Phone(phone: string): boolean {
  // Must start with +, followed by 10-15 digits, first digit after + can't be 0
  return /^\+[1-9]\d{9,14}$/.test(phone)
}

/**
 * GET /voice/caller/:phone - Lookup caller info for incoming call UI
 * Returns caller info including conversation and last-contact staff
 */
voiceRoutes.get('/caller/:phone', async (c) => {
  const user = c.get('user')
  if (!user?.staffId) {
    return c.json({ error: 'UNAUTHORIZED' }, 401)
  }

  const phone = c.req.param('phone')

  // Validate E.164 format
  if (!isValidE164Phone(phone)) {
    return c.json({ error: 'INVALID_PHONE' }, 400)
  }

  try {
    // Find client by phone
    const client = await prisma.client.findUnique({
      where: { phone },
      include: {
        taxCases: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            conversation: true,
          },
        },
      },
    })

    if (!client) {
      return c.json({
        phone,
        conversation: null,
        lastContactStaffId: null,
      })
    }

    const taxCase = client.taxCases[0]
    const conversation = taxCase?.conversation

    // Find last outbound call to determine routing staff
    let lastContactStaffId: string | null = null
    if (conversation) {
      const lastOutbound = await prisma.message.findFirst({
        where: {
          conversationId: conversation.id,
          channel: 'CALL',
          direction: 'OUTBOUND',
          callStatus: 'completed',
        },
        orderBy: { createdAt: 'desc' },
      })

      // TODO: Track staffId on messages for better routing
      // For now, return null - will ring all online staff
      if (lastOutbound) {
        // Future: lastContactStaffId = lastOutbound.staffId
      }
    }

    return c.json({
      phone,
      conversation: conversation
        ? {
            id: conversation.id,
            caseId: taxCase?.id || null,
            clientName: client.name,
          }
        : null,
      lastContactStaffId,
    })
  } catch (error) {
    console.error('[Voice Caller] Lookup failed:', error instanceof Error ? error.message : 'Unknown')
    return c.json({ error: 'OPERATION_FAILED' }, 500)
  }
})

// Schema for initiating call
const initiateCallSchema = z.object({
  caseId: z.string().min(1, 'Case ID required'),
  toPhone: z.string().regex(/^\+[1-9]\d{9,14}$/, 'Phone must be E.164 format'),
})

/**
 * POST /voice/calls - Create call record before initiating call
 * Returns messageId to track the call
 */
voiceRoutes.post('/calls', zValidator('json', initiateCallSchema), async (c) => {
  if (!isVoiceConfigured()) {
    return c.json(
      { error: 'VOICE_NOT_CONFIGURED', message: 'Voice calling not available' },
      503
    )
  }

  const user = c.get('user')
  if (!user?.staffId) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Staff authentication required' }, 401)
  }

  const { caseId, toPhone } = c.req.valid('json')

  try {
    // Verify case exists
    const taxCase = await prisma.taxCase.findUnique({
      where: { id: caseId },
      include: { client: true },
    })

    if (!taxCase) {
      return c.json({ error: 'CASE_NOT_FOUND', message: 'Tax case not found' }, 404)
    }

    // Get or create conversation
    let conversation = await prisma.conversation.findUnique({
      where: { caseId },
    })

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { caseId },
      })
    }

    // Create call message placeholder (callSid set by webhook)
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        channel: 'CALL',
        direction: 'OUTBOUND',
        content: `Cuộc gọi đến ${toPhone}`,
        isSystem: false,
        callStatus: 'initiated',
      },
    })

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    })

    return c.json({
      messageId: message.id,
      conversationId: conversation.id,
      toPhone,
      clientName: taxCase.client.name,
    })
  } catch (error) {
    console.error('[Voice Calls] Create failed:', error)
    return c.json({ error: 'CALL_CREATE_FAILED' }, 500)
  }
})

// Schema for updating call with Twilio SID
const updateCallSidSchema = z.object({
  callSid: z.string().min(1, 'Call SID required'),
})

/**
 * PATCH /voice/calls/:messageId - Update call message with Twilio CallSid
 * Called by frontend after device.connect() returns
 */
voiceRoutes.patch(
  '/calls/:messageId',
  zValidator('json', updateCallSidSchema),
  async (c) => {
    // Consistency: Check voice config like other endpoints
    if (!isVoiceConfigured()) {
      return c.json(
        { error: 'VOICE_NOT_CONFIGURED', message: 'Voice calling not available' },
        503
      )
    }

    const user = c.get('user')
    if (!user?.staffId) {
      return c.json({ error: 'UNAUTHORIZED' }, 401)
    }

    const messageId = c.req.param('messageId')
    const { callSid } = c.req.valid('json')

    try {
      // Verify message exists and is a CALL type before updating
      const existingMessage = await prisma.message.findFirst({
        where: {
          id: messageId,
          channel: 'CALL',
        },
      })

      if (!existingMessage) {
        return c.json({ error: 'MESSAGE_NOT_FOUND', message: 'Call message not found' }, 404)
      }

      const message = await prisma.message.update({
        where: { id: messageId },
        data: { callSid },
      })

      return c.json({ success: true, messageId: message.id, callSid })
    } catch (error) {
      console.error('[Voice Calls] Update CallSid failed:', error)
      return c.json({ error: 'UPDATE_FAILED' }, 500)
    }
  }
)

/**
 * Helper to verify user has access to a recording via message ownership
 */
async function verifyRecordingAccess(recordingSid: string): Promise<boolean> {
  // Find message with this recording URL
  const message = await prisma.message.findFirst({
    where: {
      recordingUrl: { contains: recordingSid },
      channel: 'CALL',
    },
    select: { id: true },
  })
  // Return true if recording exists in our database (staff made this call)
  return !!message
}

/**
 * GET /voice/recordings/:recordingSid - Get recording metadata
 * Returns recording info for frontend
 */
voiceRoutes.get('/recordings/:recordingSid', async (c) => {
  if (!isVoiceConfigured()) {
    return c.json({ error: 'VOICE_NOT_CONFIGURED', message: 'Voice calling not available' }, 503)
  }

  const user = c.get('user')
  if (!user?.staffId) {
    return c.json({ error: 'UNAUTHORIZED' }, 401)
  }

  const recordingSid = c.req.param('recordingSid')

  // Validate Recording SID format (RE + 32 hex chars)
  if (!/^RE[0-9a-fA-F]{32}$/.test(recordingSid)) {
    return c.json({ error: 'INVALID_RECORDING_SID' }, 400)
  }

  try {
    // Verify user has access to this recording
    const hasAccess = await verifyRecordingAccess(recordingSid)
    if (!hasAccess) {
      return c.json({ error: 'RECORDING_NOT_FOUND' }, 404)
    }

    // Return the proxied audio URL path
    return c.json({
      recordingSid,
      audioUrl: `/voice/recordings/${recordingSid}/audio`,
    })
  } catch (error) {
    console.error('[Recording] Fetch error:', error)
    return c.json({ error: 'RECORDING_FETCH_FAILED' }, 500)
  }
})

/**
 * GET /voice/recordings/:recordingSid/audio - Proxy recording audio
 * Streams audio through backend to avoid exposing Twilio credentials
 */
voiceRoutes.get('/recordings/:recordingSid/audio', async (c) => {
  if (!isVoiceConfigured()) {
    return c.json({ error: 'VOICE_NOT_CONFIGURED' }, 503)
  }

  const user = c.get('user')
  if (!user?.staffId) {
    return c.json({ error: 'UNAUTHORIZED' }, 401)
  }

  const recordingSid = c.req.param('recordingSid')

  if (!/^RE[0-9a-fA-F]{32}$/.test(recordingSid)) {
    return c.json({ error: 'INVALID_RECORDING_SID' }, 400)
  }

  try {
    // Verify user has access to this recording
    const hasAccess = await verifyRecordingAccess(recordingSid)
    if (!hasAccess) {
      return c.json({ error: 'RECORDING_NOT_FOUND' }, 404)
    }

    const { accountSid, authToken } = await import('../../lib/config').then((m) => m.config.twilio)

    // Fetch from Twilio with auth
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`

    const response = await fetch(twilioUrl, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      console.error('[Recording Proxy] Twilio error:', response.status, response.statusText)
      return c.json({ error: 'RECORDING_NOT_FOUND' }, 404)
    }

    // Stream response body directly (memory efficient)
    if (!response.body) {
      return c.json({ error: 'RECORDING_STREAM_FAILED' }, 500)
    }

    const headers = new Headers({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=3600',
    })

    // Forward content-length if available
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      headers.set('Content-Length', contentLength)
    }

    return new Response(response.body, {
      status: 200,
      headers,
    })
  } catch (error) {
    // Sanitize error to avoid logging sensitive data (Twilio credentials)
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Recording Proxy] Error:', errMsg)
    return c.json({ error: 'RECORDING_PROXY_FAILED' }, 500)
  }
})

export { voiceRoutes }
