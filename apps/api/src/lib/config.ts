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
} as const

export type Config = typeof config
