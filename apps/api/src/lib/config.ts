/**
 * Application Configuration
 * Centralized environment configuration with validation
 */

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // CORS - comma-separated origins in env
  corsOrigins: (
    process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174'
  ).split(',').map((o) => o.trim()),

  // URLs
  portalUrl: process.env.PORTAL_URL || 'http://localhost:5173',
  workspaceUrl: process.env.WORKSPACE_URL || 'http://localhost:5174',

  // File upload limits
  upload: {
    maxFileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE || '10485760', 10), // 10MB default
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf',
    ],
    maxFilesPerUpload: parseInt(process.env.UPLOAD_MAX_FILES || '50', 10),
  },

  // Magic link
  magicLink: {
    expiryDays: parseInt(process.env.MAGIC_LINK_EXPIRY_DAYS || '30', 10),
  },

  // Pagination defaults
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },

  // AI Configuration (Gemini)
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    isConfigured: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    // Fallback models tried in order if primary fails with 404
    fallbackModels: (
      process.env.GEMINI_FALLBACK_MODELS || 'gemini-2.5-flash-lite,gemini-2.5-flash'
    )
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
    maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.GEMINI_RETRY_DELAY_MS || '1000', 10),
    batchConcurrency: parseInt(process.env.AI_BATCH_CONCURRENCY || '3', 10),
  },

  // Twilio Configuration (SMS + Voice)
  twilio: {
    // Core credentials (SMS + Voice)
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    isConfigured: Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_PHONE_NUMBER
    ),
    // Voice-specific configuration
    apiKeySid: process.env.TWILIO_API_KEY_SID || '',
    apiKeySecret: process.env.TWILIO_API_KEY_SECRET || '',
    twimlAppSid: process.env.TWILIO_TWIML_APP_SID || '',
    webhookBaseUrl: process.env.TWILIO_WEBHOOK_BASE_URL || '',
    voiceConfigured: Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_API_KEY_SID &&
        process.env.TWILIO_API_KEY_SECRET &&
        process.env.TWILIO_TWIML_APP_SID
    ),
  },

  // Clerk Authentication (Phase 3)
  clerk: {
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
    secretKey: process.env.CLERK_SECRET_KEY || '',
    webhookSecret: process.env.CLERK_WEBHOOK_SECRET || '',
    isConfigured: Boolean(
      process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
    ),
  },

  // Scheduler Configuration (Phase 3)
  scheduler: {
    enabled: process.env.SCHEDULER_ENABLED === 'true',
    reminderCron: process.env.REMINDER_CRON || '0 2 * * *', // 2 AM UTC = 9 PM EST
  },

  // Inngest Configuration
  // Note: signingKey REQUIRED in production for security
  inngest: {
    eventKey: process.env.INNGEST_EVENT_KEY || '',
    signingKey: process.env.INNGEST_SIGNING_KEY || '',
    isConfigured: Boolean(process.env.INNGEST_EVENT_KEY),
    // Production requires signing key to prevent unauthorized job triggers
    isProductionReady:
      process.env.NODE_ENV === 'production'
        ? Boolean(process.env.INNGEST_SIGNING_KEY)
        : true,
  },

  // Tax1099 API Configuration (1099-NEC filing)
  tax1099: {
    login: process.env.TAX1099_LOGIN || '',
    password: process.env.TAX1099_PASSWORD || '',
    appKey: process.env.TAX1099_APP_KEY || '',
    isSandbox: process.env.TAX1099_SANDBOX !== 'false', // Default to sandbox
    isConfigured: Boolean(
      process.env.TAX1099_LOGIN &&
        process.env.TAX1099_PASSWORD &&
        process.env.TAX1099_APP_KEY
    ),
    urls: (() => {
      const sandbox = process.env.TAX1099_SANDBOX !== 'false'
      const domain = sandbox ? 'devapi.tax1099.com' : '1099cloud.com'
      return {
        login: sandbox
          ? `https://${domain}/api/v1/login`
          : 'https://tax1099api.1099cloud.com/api/v1/login',
        payer: sandbox
          ? `https://${domain}/api/v1/payer`
          : 'https://apipayer.1099cloud.com/api/v1/payer',
        recipient: sandbox
          ? `https://${domain}/api/v1/recipient`
          : 'https://apirecipient.1099cloud.com/api/v1/recipient',
        form: sandbox
          ? `https://${domain}/api/v2/form`
          : 'https://apiformnec.1099cloud.com/api/v2/form',
        pdf: sandbox
          ? `https://${domain}/api/v1/pdf`
          : 'https://tax1099api.1099cloud.com/api/v1/pdf',
        payment: sandbox
          ? `https://${domain}/api/v1/payment`
          : 'https://apipayment.1099cloud.com/api/v1/payment',
      }
    })(),
  },

  // TaxBandits API Configuration (1099-NEC e-filing via TaxBandits)
  taxbandits: {
    clientId: process.env.TAXBANDITS_CLIENT_ID || '',
    clientSecret: process.env.TAXBANDITS_CLIENT_SECRET || '',
    userToken: process.env.TAXBANDITS_USER_TOKEN || '',
    isSandbox: process.env.TAXBANDITS_SANDBOX !== 'false',
    isConfigured: Boolean(
      process.env.TAXBANDITS_CLIENT_ID &&
        process.env.TAXBANDITS_CLIENT_SECRET &&
        process.env.TAXBANDITS_USER_TOKEN
    ),
    urls: (() => {
      const sandbox = process.env.TAXBANDITS_SANDBOX !== 'false'
      return {
        oauth: sandbox
          ? 'https://testoauth.expressauth.net/v2/tbsauth'
          : 'https://oauth.expressauth.net/v2/tbsauth',
        api: sandbox
          ? 'https://testapi.taxbandits.com/v1.7.3'
          : 'https://api.taxbandits.com/v1.7.3',
      }
    })(),
  },

  // Schedule C Configuration
  scheduleC: {
    // IRS standard mileage rate in cents (2024: 67 cents/mile)
    // Update annually when IRS publishes new rate
    mileageRateCents: parseInt(process.env.MILEAGE_RATE_CENTS || '67', 10),
  },
} as const

export type Config = typeof config
