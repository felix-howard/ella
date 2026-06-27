import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
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
import { twilioWebhookRoute, clerkWebhookRoute, stripeWebhookRoute } from './routes/webhooks'
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
import { uploadLinksRoute } from './routes/upload-links'
import { portalDraftRoute } from './routes/portal/draft'
import { authSignupRoute } from './routes/auth/signup'
import { formRoute } from './routes/form'
import { termsRoute } from './routes/terms'
import { contractorAgreementsRoute } from './routes/contractor-agreements'
import { leadsRoute } from './routes/leads'
import { contractorIntakeRoute } from './routes/contractor-intake'
import { clientContractorsRoute } from './routes/contractors/client-contractors'
import { clientForm1099NecRoute } from './routes/form-1099-nec/client-form-1099-nec'
import { clientForm1099NecPdfsRoute } from './routes/form-1099-nec/client-form-1099-nec-pdfs'
import { clientForm1099NecBatchesRoute } from './routes/form-1099-nec/client-form-1099-nec-batches'
import { clientForm1099NecPrepareRoute } from './routes/form-1099-nec/client-form-1099-nec-prepare'
import { campaignsRoute } from './routes/campaigns'
import { clientGroupsRoute } from './routes/client-groups'
import { agreementsStaffRoute, agreementsPublicRoute } from './routes/agreements'
import { publicPaymentsRoute, publicQuotesRoute } from './routes/payments'
import { agreementTemplatesRoute } from './routes/agreement-templates'
import { leadMessagesRoute } from './routes/leads/messages'
import { activityRoute } from './routes/activity'
import { billingRoute } from './routes/billing'
import { couponsRoute } from './routes/coupons'
import { recipientsRoute } from './routes/recipients'
import { companyVaultRoute } from './routes/company-vault'
import { pushRoute } from './routes/push'

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

// Security headers (nosniff, frame-options, HSTS, referrer-policy, cross-origin
// policies). CSP is intentionally NOT enabled here — this API serves JSON to a
// cross-origin SPA, and a default CSP would risk breaking clients with no benefit
// for non-HTML responses. Tune a CSP later if the API ever serves HTML.
app.use('*', secureHeaders())

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
app.route('/webhooks/stripe', stripeWebhookRoute)
app.route('/api/inngest', inngestRoute)
app.route('/auth', authSignupRoute)
app.route('/form', formRoute)
app.route('/leads', leadsRoute) // Mixed: POST / is public, rest use inline authMiddleware+requireAdminOrManager
app.route('/leads', agreementsStaffRoute) // Agreement staff endpoints: /leads/:leadId/agreements/* (inline auth+requireAdminOrManager)
app.route('/leads', leadMessagesRoute) // Lead messages: /leads/:id/messages* (inline auth+requireAdminOrManager)
app.route('/public/agreements', agreementsPublicRoute) // Public signing endpoints (token-based, no auth) — canonical path
app.route('/public/nda', agreementsPublicRoute) // Alias retained for back-compat with existing customer SMS links
app.route('/public/pay', publicPaymentsRoute) // Public deposit payment endpoints (payToken-based, no auth)
app.route('/public/quote', publicQuotesRoute) // Public sent pricing-quote pay endpoints (payToken-based, no auth)
app.route('/contractor-intake', contractorIntakeRoute)
app.route('/billing', billingRoute)
app.route('/coupons', couponsRoute) // Coupon CRUD + Stripe sync (auth+requireAdminOrManager, org-scoped)
app.route('/recipients', recipientsRoute) // Combined client+lead search for sending quotes (inline auth+requireAdminOrManager)

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
app.use('/upload-links/*', authMiddleware)
app.use('/terms/*', authMiddleware)
app.use('/contractor-agreements/*', authMiddleware)
app.use('/client-groups/*', authMiddleware)
app.use('/agreement-templates/*', authMiddleware)
app.use('/activity/*', authMiddleware)
app.use('/company-vault/*', authMiddleware)
app.use('/push/*', authMiddleware)

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
app.route('/upload-links', uploadLinksRoute)
app.route('/terms', termsRoute)
app.route('/contractor-agreements', contractorAgreementsRoute)
app.route('/campaigns', campaignsRoute) // Admin-only, inline auth middleware
app.route('/client-groups', clientGroupsRoute)
app.route('/agreement-templates', agreementTemplatesRoute)
app.route('/activity', activityRoute)
app.route('/company-vault', companyVaultRoute)
app.route('/push', pushRoute)

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
