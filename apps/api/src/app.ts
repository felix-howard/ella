import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { healthRoute } from './routes/health'

const app = new OpenAPIHono()

// Middleware
app.use('*', logger())
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  })
)

// Routes
app.route('/health', healthRoute)

// OpenAPI documentation
app.doc('/doc', {
  openapi: '3.1.0',
  info: {
    title: 'Ella API',
    version: '0.0.1',
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
