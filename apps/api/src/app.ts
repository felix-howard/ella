import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { errorHandler } from './middleware/error-handler'
import { clerkMiddleware, authMiddleware } from './middleware/auth'
import { deprecationHeadersMiddleware } from './middleware/deprecation'
import { config } from './lib/config'
import { healthRoute } from './routes/health'
import { clientsRoute } from './routes/clients'
import { casesRoute } from './routes/cases'
import { engagementsRoute } from './routes/engagements'
import { actionsRoute } from './routes/actions'
import { docsRoute } from './routes/docs'
import { imagesRoute } from './routes/images'
import { messagesRoute } from './routes/messages'
import { portalRoute } from './routes/portal'
import { twilioWebhookRoute, clerkWebhookRoute } from './routes/webhooks'
import { inngestRoute } from './routes/inngest'
import { adminRoute } from './routes/admin'
import { voiceRoutes } from './routes/voice'
import { scheduleCRoute } from './routes/schedule-c'
import { scheduleERoute } from './routes/schedule-e'
import { expenseRoute } from './routes/expense'
import { rentalRoute } from './routes/rental'
import { staffRoute } from './routes/staff'
import { teamRoute } from './routes/team'
import { orgSettingsRoute } from './routes/org-settings'
import { sharedDocsRoute } from './routes/shared-docs'
import { portalDraftRoute } from './routes/portal/draft'
import { authSignupRoute } from './routes/auth/signup'
import { formRoute } from './routes/form'
import { termsRoute } from './routes/terms'
import { leadsRoute } from './routes/leads'
import { contractorIntakeRoute } from './routes/contractor-intake'
import { clientContractorsRoute } from './routes/contractors/client-contractors'
import { clientForm1099NecRoute } from './routes/form-1099-nec/client-form-1099-nec'
import { clientForm1099NecPdfsRoute } from './routes/form-1099-nec/client-form-1099-nec-pdfs'
import { clientForm1099NecBatchesRoute } from './routes/form-1099-nec/client-form-1099-nec-batches'
import { clientForm1099NecPrepareRoute } from './routes/form-1099-nec/client-form-1099-nec-prepare'
import { campaignsRoute } from './routes/campaigns'
import { clientGroupsRoute } from './routes/client-groups'
import { ndaStaffRoute, ndaPublicRoute } from './routes/nda'
import { leadMessagesRoute } from './routes/leads/messages'

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

// Clerk middleware - parses JWT from Authorization header (runs on all routes)
app.use('*', clerkMiddleware())

// Public routes (no auth required)
app.route('/health', healthRoute)
app.route('/api/health', healthRoute) // Alias for Railway health check
app.route('/portal', portalRoute)
app.route('/expense', expenseRoute) // Public Schedule C expense form
app.route('/rental', rentalRoute) // Public Schedule E rental form
app.route('/portal/draft', portalDraftRoute) // Public draft return viewer
app.route('/webhooks/twilio', twilioWebhookRoute)
app.route('/webhooks/clerk', clerkWebhookRoute)
app.route('/api/inngest', inngestRoute)
app.route('/auth', authSignupRoute)
app.route('/form', formRoute)
app.route('/leads', leadsRoute) // Mixed: POST / is public, rest use inline authMiddleware+requireOrgAdmin
app.route('/leads', ndaStaffRoute) // NDA staff endpoints: /leads/:leadId/nda/* (inline auth+requireOrgAdmin)
app.route('/leads', leadMessagesRoute) // Lead messages: /leads/:id/messages* (inline auth+requireOrgAdmin)
app.route('/public/nda', ndaPublicRoute) // NDA public endpoints: token-based, no auth
app.route('/contractor-intake', contractorIntakeRoute)

// Protected routes - require authenticated Clerk user + Staff record
app.use('/clients/*', authMiddleware)
app.use('/cases/*', authMiddleware)
app.use('/engagements/*', authMiddleware)
app.use('/actions/*', authMiddleware)
app.use('/docs/*', authMiddleware)
app.use('/images/*', authMiddleware)
app.use('/messages/*', authMiddleware)
app.use('/admin/*', authMiddleware)
app.use('/voice/*', authMiddleware)
app.use('/schedule-c/*', authMiddleware)
app.use('/schedule-e/*', authMiddleware)
app.use('/staff/*', authMiddleware)
app.use('/team/*', authMiddleware)
app.use('/org-settings/*', authMiddleware)
app.use('/shared-docs/*', authMiddleware)
app.use('/terms/*', authMiddleware)
app.use('/client-groups/*', authMiddleware)

// Routes (with deprecation headers for clientId-based queries)
app.use('/clients/*', deprecationHeadersMiddleware)
app.use('/cases/*', deprecationHeadersMiddleware)
app.route('/clients', clientsRoute)
app.route('/clients', clientContractorsRoute) // /clients/:clientId/contractors
app.route('/clients', clientForm1099NecRoute) // /clients/:clientId/1099-nec/*
app.route('/clients', clientForm1099NecPdfsRoute) // /clients/:clientId/1099-nec/pdfs/*
app.route('/clients', clientForm1099NecBatchesRoute) // /clients/:clientId/1099-nec/batches/*
app.route('/clients', clientForm1099NecPrepareRoute) // /clients/:clientId/1099-nec/prepare
app.route('/cases', casesRoute)
app.route('/engagements', engagementsRoute)
app.route('/actions', actionsRoute)
app.route('/docs', docsRoute)
app.route('/images', imagesRoute)
app.route('/messages', messagesRoute)
app.route('/admin', adminRoute)
app.route('/voice', voiceRoutes)
app.route('/schedule-c', scheduleCRoute)
app.route('/schedule-e', scheduleERoute)
app.route('/staff', staffRoute)
app.route('/team', teamRoute)
app.route('/org-settings', orgSettingsRoute)
app.route('/shared-docs', sharedDocsRoute)
app.route('/terms', termsRoute)
app.route('/campaigns', campaignsRoute) // Admin-only, inline auth middleware
app.route('/client-groups', clientGroupsRoute)

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
