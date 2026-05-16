/**
 * Public agreement handlers — token-protected, no Clerk auth.
 * Sign endpoint carries a per-token rate limit (3 attempts/hour) so a stolen
 * token can't be used to brute-force sign payloads.
 */
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { createMiddleware } from 'hono/factory'
import { zValidator } from '@hono/zod-validator'
import { checkRateLimit } from '../../middleware/rate-limiter'
import {
  loadAgreementByToken,
  toPublicView,
  signAgreement,
} from '../../services/agreements/agreement-signing-service'
import { tokenParamSchema, signAgreementBodySchema } from './schemas'
import { extractIp, extractUserAgent } from './helpers'

const publicRoute = new Hono()

export const SIGN_WINDOW_MS = 60 * 60 * 1000 // 1 hour
export const SIGN_MAX_ATTEMPTS = 3

const perTokenSignLimit = createMiddleware(async (c, next) => {
  const token = c.req.param('token') || 'unknown'
  if (!checkRateLimit(`agreement-sign:${token}`, SIGN_WINDOW_MS, SIGN_MAX_ATTEMPTS)) {
    return c.json(
      { success: false, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many signing attempts' },
      429,
    )
  }
  await next()
})

// GET /:token — load agreement view for the portal
publicRoute.get(
  '/:token',
  zValidator('param', tokenParamSchema),
  async (c) => {
    const { token } = c.req.valid('param')
    const agreement = await loadAgreementByToken(token)
    if (!agreement) throw new HTTPException(404, { message: 'Agreement link not found' })
    return c.json({ success: true, data: await toPublicView(agreement) })
  },
)

// POST /:token/sign — accept signature + render PDF + mark signed
publicRoute.post(
  '/:token/sign',
  perTokenSignLimit,
  zValidator('param', tokenParamSchema),
  zValidator('json', signAgreementBodySchema),
  async (c) => {
    const { token } = c.req.valid('param')
    const body = c.req.valid('json')
    const result = await signAgreement({
      token,
      signerName: body.signerName,
      signerTitle: body.signerTitle,
      signaturePngDataUrl: body.signaturePngDataUrl,
      ip: extractIp(c),
      userAgent: extractUserAgent(c),
      clientAuthRepName: body.clientAuthRepName,
      clientAuthRepTitle: body.clientAuthRepTitle,
    })
    return c.json({ success: true, data: result })
  },
)

export { publicRoute }
