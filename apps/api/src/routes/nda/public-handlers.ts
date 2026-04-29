/**
 * Public NDA handlers — token-protected, no Clerk auth.
 * Sign endpoint carries a per-token rate limit (3 attempts/hour) so a stolen
 * token can't be used to brute-force sign payloads.
 */
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { createMiddleware } from 'hono/factory'
import { zValidator } from '@hono/zod-validator'
import { checkRateLimit } from '../../middleware/rate-limiter'
import {
  loadNdaByToken,
  toPublicView,
  signNda,
} from '../../services/nda/nda-signing-service'
import { tokenParamSchema, signNdaBodySchema } from './schemas'
import { extractIp, extractUserAgent } from './helpers'

const publicRoute = new Hono()

const SIGN_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const SIGN_MAX_ATTEMPTS = 3

const perTokenSignLimit = createMiddleware(async (c, next) => {
  const token = c.req.param('token') || 'unknown'
  if (!checkRateLimit(`nda-sign:${token}`, SIGN_WINDOW_MS, SIGN_MAX_ATTEMPTS)) {
    return c.json(
      { success: false, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many signing attempts' },
      429,
    )
  }
  await next()
})

// GET /:token — load NDA view for the portal
publicRoute.get(
  '/:token',
  zValidator('param', tokenParamSchema),
  async (c) => {
    const { token } = c.req.valid('param')
    const nda = await loadNdaByToken(token)
    if (!nda) throw new HTTPException(404, { message: 'NDA link not found' })
    return c.json({ success: true, data: toPublicView(nda) })
  },
)

// POST /:token/sign — accept signature + render PDF + mark signed
publicRoute.post(
  '/:token/sign',
  perTokenSignLimit,
  zValidator('param', tokenParamSchema),
  zValidator('json', signNdaBodySchema),
  async (c) => {
    const { token } = c.req.valid('param')
    const body = c.req.valid('json')
    const result = await signNda({
      token,
      signerName: body.signerName,
      signaturePngDataUrl: body.signaturePngDataUrl,
      ip: extractIp(c),
      userAgent: extractUserAgent(c),
    })
    return c.json({ success: true, data: result })
  },
)

export { publicRoute }
