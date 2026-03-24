// Deploy trigger: migrations for ScheduleE table, MagicLinkType enum, org smsLanguage/missedCallTextBack
import { serve } from '@hono/node-server'
import { app } from './app'
import { initializeScheduler, stopScheduler } from './services/scheduler'
import { validateGeminiModel } from './services/ai/gemini-client'

const port = Number(process.env.PORT) || 3002

console.log(`API server starting on port ${port}`)

const server = serve({
  fetch: app.fetch,
  port,
})

// Initialize scheduler after server starts
initializeScheduler()

// Validate Gemini model (non-blocking)
validateGeminiModel().then((status) => {
  if (!status.available) {
    console.warn('[Startup] Gemini model not available:', status.error)
  }
})

// Warn if webhook secret missing (webhooks won't work without it)
if (!process.env.CLERK_WEBHOOK_SECRET) {
  const level = process.env.NODE_ENV === 'production' ? 'error' : 'warn'
  console[level]('[Startup] CLERK_WEBHOOK_SECRET not set — Clerk webhooks will return 500')
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...')
  stopScheduler()
  server.close()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...')
  stopScheduler()
  server.close()
  process.exit(0)
})
