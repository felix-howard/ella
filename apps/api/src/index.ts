import { serve } from '@hono/node-server'
import { app } from './app'
import { initializeScheduler, stopScheduler } from './services/scheduler'

const port = Number(process.env.PORT) || 3001

console.log(`API server starting on port ${port}`)

const server = serve({
  fetch: app.fetch,
  port,
})

// Initialize scheduler after server starts
initializeScheduler()

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
