import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import type { PrismaClient } from '@ella/db'
import { google } from 'googleapis'
import { prisma } from '../../lib/db'
import { encryptIntegrationSecret } from '../secrets/integration-secrets'
import { getGoogleDriveConfig, type GoogleDriveConfig } from './google-drive-config'
import { createGoogleDriveOAuthClient } from './google-drive-client'
import { GoogleDriveServiceError, normalizeGoogleDriveError } from './google-drive-errors'

const STATE_MAX_AGE_MS = 10 * 60 * 1000
const STATE_ALGORITHM = 'aes-256-gcm'
const STATE_IV_LENGTH = 12
const STATE_AUTH_TAG_LENGTH = 16

export interface GoogleDriveOAuthStateInput {
  organizationId: string
  staffId: string
  rootFolderId?: string | null
  adminGroupEmail?: string | null
}

interface GoogleDriveOAuthStatePayload extends GoogleDriveOAuthStateInput {
  nonce: string
  issuedAt: number
}

export interface GoogleDriveConnectionSaveInput {
  organizationId: string
  connectedByStaffId: string
  rootFolderId: string
  rootFolderName?: string | null
  rootFolderWebUrl?: string | null
  adminGroupEmail?: string | null
  googleAccountEmail: string
  refreshToken: string
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url')
}

function getStateSecret(driveConfig: GoogleDriveConfig): string {
  if (!driveConfig.clientSecret) {
    throw new GoogleDriveServiceError('DRIVE_NOT_CONNECTED')
  }
  return driveConfig.clientSecret
}

function signStatePayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function getStateEncryptionKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

function encryptStatePayload(payload: GoogleDriveOAuthStatePayload, secret: string): string {
  const iv = randomBytes(STATE_IV_LENGTH)
  const cipher = createCipheriv(STATE_ALGORITHM, getStateEncryptionKey(secret), iv, {
    authTagLength: STATE_AUTH_TAG_LENGTH,
  })
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return base64UrlEncode(Buffer.concat([iv, authTag, encrypted]))
}

function decryptStatePayload(encodedPayload: string, secret: string): GoogleDriveOAuthStatePayload {
  try {
    const combined = Buffer.from(encodedPayload, 'base64url')
    const iv = combined.subarray(0, STATE_IV_LENGTH)
    const authTag = combined.subarray(STATE_IV_LENGTH, STATE_IV_LENGTH + STATE_AUTH_TAG_LENGTH)
    const ciphertext = combined.subarray(STATE_IV_LENGTH + STATE_AUTH_TAG_LENGTH)

    const decipher = createDecipheriv(STATE_ALGORITHM, getStateEncryptionKey(secret), iv, {
      authTagLength: STATE_AUTH_TAG_LENGTH,
    })
    decipher.setAuthTag(authTag)

    return JSON.parse(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    ) as GoogleDriveOAuthStatePayload
  } catch {
    throw new GoogleDriveServiceError('DRIVE_AUTH_EXPIRED')
  }
}

export function createGoogleDriveOAuthState(
  input: GoogleDriveOAuthStateInput,
  driveConfig: GoogleDriveConfig = getGoogleDriveConfig()
): string {
  const payload: GoogleDriveOAuthStatePayload = {
    organizationId: input.organizationId,
    staffId: input.staffId,
    ...(input.rootFolderId ? { rootFolderId: input.rootFolderId } : {}),
    ...(input.adminGroupEmail ? { adminGroupEmail: input.adminGroupEmail } : {}),
    nonce: randomBytes(16).toString('base64url'),
    issuedAt: Date.now(),
  }
  const secret = getStateSecret(driveConfig)
  const encodedPayload = encryptStatePayload(payload, secret)
  return `${encodedPayload}.${signStatePayload(encodedPayload, secret)}`
}

export function verifyGoogleDriveOAuthState(
  state: string,
  driveConfig: GoogleDriveConfig = getGoogleDriveConfig()
): GoogleDriveOAuthStateInput {
  const parts = state.split('.')
  if (parts.length !== 2) {
    throw new GoogleDriveServiceError('DRIVE_AUTH_EXPIRED')
  }
  const [encodedPayload, signature] = parts
  if (!encodedPayload || !signature) {
    throw new GoogleDriveServiceError('DRIVE_AUTH_EXPIRED')
  }

  const secret = getStateSecret(driveConfig)
  const expectedSignature = signStatePayload(encodedPayload, secret)
  const provided = Buffer.from(signature, 'base64url')
  const expected = Buffer.from(expectedSignature, 'base64url')
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new GoogleDriveServiceError('DRIVE_AUTH_EXPIRED')
  }

  const payload = decryptStatePayload(encodedPayload, secret)
  if (
    !payload.organizationId ||
    !payload.staffId ||
    !payload.issuedAt ||
    Date.now() - payload.issuedAt > STATE_MAX_AGE_MS
  ) {
    throw new GoogleDriveServiceError('DRIVE_AUTH_EXPIRED')
  }

  return {
    organizationId: payload.organizationId,
    staffId: payload.staffId,
    ...(payload.rootFolderId ? { rootFolderId: payload.rootFolderId } : {}),
    ...(payload.adminGroupEmail ? { adminGroupEmail: payload.adminGroupEmail } : {}),
  }
}

export function buildGoogleDriveAuthUrl(
  input: GoogleDriveOAuthStateInput,
  driveConfig: GoogleDriveConfig = getGoogleDriveConfig()
): string {
  const auth = createGoogleDriveOAuthClient(driveConfig)
  return auth.generateAuthUrl({
    access_type: 'offline',
    include_granted_scopes: true,
    prompt: 'consent',
    scope: driveConfig.scopes,
    state: createGoogleDriveOAuthState(input, driveConfig),
  })
}

export async function exchangeGoogleDriveCodeForConnection(input: {
  code: string
  state: string
  expectedOrganizationId?: string
  expectedStaffId?: string
  driveConfig?: GoogleDriveConfig
}): Promise<{
  organizationId: string
  staffId: string
  rootFolderId?: string | null
  adminGroupEmail?: string | null
  refreshToken: string
  googleAccountEmail: string
}> {
  const driveConfig = input.driveConfig ?? getGoogleDriveConfig()
  const statePayload = verifyGoogleDriveOAuthState(input.state, driveConfig)

  if (
    (input.expectedOrganizationId && statePayload.organizationId !== input.expectedOrganizationId) ||
    (input.expectedStaffId && statePayload.staffId !== input.expectedStaffId)
  ) {
    throw new GoogleDriveServiceError('DRIVE_AUTH_EXPIRED')
  }

  try {
    const auth = createGoogleDriveOAuthClient(driveConfig)
    const { tokens } = await auth.getToken(input.code)
    if (!tokens.refresh_token) {
      throw new GoogleDriveServiceError('DRIVE_AUTH_EXPIRED')
    }

    auth.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth })
    const userInfo = await oauth2.userinfo.get()
    const googleAccountEmail = userInfo.data.email
    if (!googleAccountEmail) {
      throw new GoogleDriveServiceError('DRIVE_AUTH_EXPIRED')
    }

    return {
      organizationId: statePayload.organizationId,
      staffId: statePayload.staffId,
      rootFolderId: statePayload.rootFolderId ?? null,
      adminGroupEmail: statePayload.adminGroupEmail ?? null,
      refreshToken: tokens.refresh_token,
      googleAccountEmail,
    }
  } catch (error) {
    throw normalizeGoogleDriveError(error, 'DRIVE_AUTH_EXPIRED')
  }
}

export async function saveGoogleDriveConnection(
  input: GoogleDriveConnectionSaveInput,
  db: PrismaClient = prisma
) {
  if (!input.refreshToken || input.refreshToken.trim() === '') {
    throw new GoogleDriveServiceError('DRIVE_AUTH_EXPIRED')
  }

  let refreshTokenEncrypted: string
  try {
    refreshTokenEncrypted = encryptIntegrationSecret(input.refreshToken)
  } catch {
    throw new GoogleDriveServiceError('DRIVE_NOT_CONNECTED')
  }

  return db.googleDriveConnection.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      rootFolderId: input.rootFolderId,
      rootFolderName: input.rootFolderName ?? null,
      rootFolderWebUrl: input.rootFolderWebUrl ?? null,
      adminGroupEmail: input.adminGroupEmail ?? null,
      googleAccountEmail: input.googleAccountEmail,
      refreshTokenEncrypted,
      connectedByStaffId: input.connectedByStaffId,
      status: 'CONNECTED',
      disconnectedAt: null,
    },
    update: {
      rootFolderId: input.rootFolderId,
      rootFolderName: input.rootFolderName ?? null,
      rootFolderWebUrl: input.rootFolderWebUrl ?? null,
      adminGroupEmail: input.adminGroupEmail ?? null,
      googleAccountEmail: input.googleAccountEmail,
      refreshTokenEncrypted,
      connectedByStaffId: input.connectedByStaffId,
      status: 'CONNECTED',
      disconnectedAt: null,
    },
  })
}
