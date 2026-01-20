/**
 * Voice API Routes
 * Token generation and call initiation for browser-based voice calls
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { generateVoiceToken, isVoiceConfigured } from '../../services/voice'
import { prisma } from '../../lib/db'
import type { AuthVariables } from '../../middleware/auth'

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
      inbound: false, // Not implemented yet
    },
  })
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
