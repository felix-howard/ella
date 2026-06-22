import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetRateLimitMapForTests,
  presenceHeartbeatRateLimit,
  presenceRegisterRateLimit,
  presenceUnregisterRateLimit,
} from '../rate-limiter'

function createPresenceLimiterApp() {
  const app = new Hono<{ Variables: { user: { staffId: string } } }>()

  app.use('*', async (c, next) => {
    c.set('user', { staffId: 'staff_1' })
    await next()
  })

  app.post('/register', presenceRegisterRateLimit, (c) => c.json({ ok: true }))
  app.post('/unregister', presenceUnregisterRateLimit, (c) => c.json({ ok: true }))
  app.post('/heartbeat', presenceHeartbeatRateLimit, (c) => c.json({ ok: true }))

  return app
}

describe('presence rate limiters', () => {
  beforeEach(() => {
    __resetRateLimitMapForTests()
  })

  it('isolates register, unregister, and heartbeat buckets per staff member', async () => {
    const app = createPresenceLimiterApp()

    for (let i = 0; i < 30; i++) {
      const res = await app.request('/register', { method: 'POST' })
      expect(res.status).toBe(200)
    }

    const limitedRegister = await app.request('/register', { method: 'POST' })
    expect(limitedRegister.status).toBe(429)

    const unregister = await app.request('/unregister', { method: 'POST' })
    const heartbeat = await app.request('/heartbeat', { method: 'POST' })

    expect(unregister.status).toBe(200)
    expect(heartbeat.status).toBe(200)
  })
})
