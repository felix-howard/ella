import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const ENCRYPTION_KEY_ENV = 'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY'

let cachedKey: Buffer | null = null

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey

  const keyHex = process.env[ENCRYPTION_KEY_ENV]
  if (!keyHex) {
    throw new Error(`[Secrets] ${ENCRYPTION_KEY_ENV} environment variable is not set`)
  }

  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(`[Secrets] ${ENCRYPTION_KEY_ENV} must be 64 hex characters (256 bits)`)
  }

  cachedKey = Buffer.from(keyHex, 'hex')
  return cachedKey
}

export function encryptIntegrationSecret(value: string): string {
  if (!value || value.trim() === '') return ''

  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptIntegrationSecret(encrypted: string): string {
  if (!encrypted || encrypted.trim() === '') return ''

  const key = getEncryptionKey()
  const combined = Buffer.from(encrypted, 'base64')
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
