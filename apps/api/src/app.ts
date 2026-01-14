import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { errorHandler } from './middleware/error-handler'
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth'
import { config } from './lib/config'
import { healthRoute } from './routes/health'
import { authRoute } from './routes/auth'
import { clientsRoute } from './routes/clients'
import { casesRoute } from './routes/cases'
import { actionsRoute } from './routes/actions'
import { docsRoute } from './routes/docs'
import { messagesRoute } from './routes/messages'
import { portalRoute } from './routes/portal'
import { twilioWebhookRoute } from './routes/webhooks'

const app = new OpenAPIHono()

// Global error handler
app.onError(errorHandler)

// Middleware
app.use('*', logger())
app.use(
  '*',
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
)

// Public routes (no auth required)
app.route('/health', healthRoute)
app.route('/auth', authRoute)
app.route('/portal', portalRoute)
app.route('/webhooks/twilio', twilioWebhookRoute)

// Optional auth for /auth/me endpoint
app.use('/auth/me', optionalAuthMiddleware)

// Protected routes - always apply auth middleware
// Note: In development without JWT_SECRET, use test token or seed user
app.use('/clients/*', authMiddleware)
app.use('/cases/*', authMiddleware)
app.use('/actions/*', authMiddleware)
app.use('/docs/*', authMiddleware)
app.use('/messages/*', authMiddleware)

// Routes
app.route('/clients', clientsRoute)
app.route('/cases', casesRoute)
app.route('/actions', actionsRoute)
app.route('/docs', docsRoute)
app.route('/messages', messagesRoute)

// OpenAPI documentation
app.doc('/doc', {
  openapi: '3.1.0',
  info: {
    title: 'Ella API',
    version: '0.1.0',
    description: 'Tax Document Management API for Ella',
  },
})

// Scalar API docs UI
app.get('/docs', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Ella API Docs</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <script id="api-reference" data-url="/doc"></script>
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
      </body>
    </html>
  `)
})

export { app }
