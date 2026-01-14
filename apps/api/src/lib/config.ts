/**
 * Application Configuration
 * Centralized environment configuration with validation
 */

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
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
    maxFilesPerUpload: parseInt(process.env.UPLOAD_MAX_FILES || '20', 10),
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
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.GEMINI_RETRY_DELAY_MS || '1000', 10),
    batchConcurrency: parseInt(process.env.AI_BATCH_CONCURRENCY || '3', 10),
  },

  // Twilio SMS Configuration
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    isConfigured: Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_PHONE_NUMBER
    ),
  },

  // Authentication Configuration (Phase 3)
  auth: {
    jwtSecret: (() => {
      const secret = process.env.JWT_SECRET
      if (!secret || secret.length < 32) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('JWT_SECRET must be set in production (min 32 chars)')
        }
        console.warn('[SECURITY] Using dev JWT secret - NOT FOR PRODUCTION')
        return 'development-secret-change-in-prod-32chars!'
      }
      return secret
    })(),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshTokenExpiresDays: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10),
    isConfigured: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32),
  },

  // Scheduler Configuration (Phase 3)
  scheduler: {
    enabled: process.env.SCHEDULER_ENABLED === 'true',
    reminderCron: process.env.REMINDER_CRON || '0 2 * * *', // 2 AM UTC = 9 PM EST
  },
} as const

export type Config = typeof config
