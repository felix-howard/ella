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
