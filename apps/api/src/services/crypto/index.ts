/**
 * SSN Encryption Service (Server-Side Only)
 * AES-256-GCM encryption for sensitive SSN fields
 * Uses Node.js crypto module for secure server-side encryption
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { logProfileChanges } from '../audit-logger'

// Encryption configuration
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits (recommended for GCM)
const AUTH_TAG_LENGTH = 16 // 128 bits

// Cached encryption key (initialized on first use)
let encryptionKey: Buffer | null = null

/**
 * Validate encryption key format
 * Must be 64 hex characters (32 bytes = 256 bits)
 */
function validateKeyFormat(key: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(key)
}

/**
 * Get and validate encryption key from environment
 * Caches the key for performance
 */
function getEncryptionKey(): Buffer {
  if (encryptionKey) return encryptionKey

  const keyHex = process.env.SSN_ENCRYPTION_KEY
  if (!keyHex) {
    throw new Error('[Crypto] SSN_ENCRYPTION_KEY environment variable is not set')
  }

  if (!validateKeyFormat(keyHex)) {
    throw new Error('[Crypto] SSN_ENCRYPTION_KEY must be 64 hex characters (256 bits)')
  }

  encryptionKey = Buffer.from(keyHex, 'hex')
  return encryptionKey
}

/**
 * Encrypt SSN using AES-256-GCM
 * Returns base64 encoded string: IV + AuthTag + Ciphertext
 * @param ssn - Plain SSN string (e.g., "123-45-6789")
 * @returns Encrypted string (base64) or empty string if input empty
 */
export function encryptSSN(ssn: string): string {
  if (!ssn || ssn.trim() === '') return ''

  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(ssn, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Combine: IV (12) + AuthTag (16) + Ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted])
  return combined.toString('base64')
}

/**
 * Decrypt SSN using AES-256-GCM
 * @param encrypted - Base64 encoded encrypted string
 * @returns Decrypted SSN string
 */
export function decryptSSN(encrypted: string): string {
  if (!encrypted || encrypted.trim() === '') return ''

  const key = getEncryptionKey()
  const combined = Buffer.from(encrypted, 'base64')

  // Extract: IV (12) + AuthTag (16) + Ciphertext
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Mask SSN for display (e.g., "123-45-6789" -> "***-**-6789")
 * @param ssn - Plain or decrypted SSN string
 * @returns Masked SSN showing only last 4 digits
 */
export function maskSSN(ssn: string): string {
  if (!ssn || ssn.trim() === '') return ''

  const digits = ssn.replace(/\D/g, '')
  if (digits.length < 4) return '***-**-****'

  return `***-**-${digits.slice(-4)}`
}

/**
 * Validate SSN format (basic validation)
 * - Must be 9 digits
 * - Cannot start with 000, 666, or 9XX (invalid SSA prefixes)
 * - Middle two digits cannot be 00
 * - Last four digits cannot be 0000
 */
export function isValidSSN(ssn: string): boolean {
  if (!ssn) return false

  const digits = ssn.replace(/\D/g, '')
  if (digits.length !== 9) return false

  // Invalid area numbers
  const area = digits.slice(0, 3)
  if (area === '000' || area === '666' || area[0] === '9') return false

  // Invalid group number
  const group = digits.slice(3, 5)
  if (group === '00') return false

  // Invalid serial number
  const serial = digits.slice(5, 9)
  if (serial === '0000') return false

  return true
}

/**
 * Format SSN with dashes (e.g., "123456789" -> "123-45-6789")
 */
export function formatSSN(ssn: string): string {
  if (!ssn) return ''
  const digits = ssn.replace(/\D/g, '')
  if (digits.length !== 9) return ssn
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`
}

/**
 * Encrypt all SSN fields in intake answers object
 * Also logs SSN access for audit compliance
 * @param data - Object containing potential SSN fields
 * @param clientId - Client ID for audit logging
 * @param staffId - Staff ID who made the change
 * @returns Object with SSN fields encrypted
 */
export async function encryptSensitiveFields(
  data: Record<string, unknown>,
  clientId: string,
  staffId?: string
): Promise<Record<string, unknown>> {
  const result = { ...data }
  const ssnFieldsProcessed: string[] = []

  for (const key of Object.keys(result)) {
    const value = result[key]

    // Encrypt SSN fields (keys containing 'ssn' case-insensitive)
    if (key.toLowerCase().includes('ssn') && typeof value === 'string' && value) {
      // Validate before encrypting
      if (!isValidSSN(value)) {
        throw new Error(`Invalid SSN format for field: ${key}`)
      }
      result[key] = encryptSSN(value)
      ssnFieldsProcessed.push(key)
    }

    // Handle dependents array with SSN fields
    if (key === 'dependents' && Array.isArray(value)) {
      result[key] = value.map((dep: Record<string, unknown>, index: number) => {
        if (dep.ssn && typeof dep.ssn === 'string') {
          if (!isValidSSN(dep.ssn)) {
            throw new Error(`Invalid SSN format for dependent ${index + 1}`)
          }
          ssnFieldsProcessed.push(`dependents[${index}].ssn`)
          return { ...dep, ssn: encryptSSN(dep.ssn) }
        }
        return dep
      })
    }
  }

  // Log SSN encryption for audit compliance (async, non-blocking)
  if (ssnFieldsProcessed.length > 0 && clientId) {
    void logProfileChanges(
      clientId,
      ssnFieldsProcessed.map((field) => ({
        field: `${field}_encrypted`,
        oldValue: null,
        newValue: '[ENCRYPTED]',
      })),
      staffId
    )
    console.log(`[Crypto] Encrypted ${ssnFieldsProcessed.length} SSN fields for client ${clientId}`)
  }

  return result
}

/**
 * Decrypt SSN fields in intake answers for display
 * Logs SSN access for audit compliance
 * @param data - Object with encrypted SSN fields
 * @param clientId - Client ID for audit logging
 * @param staffId - Staff ID requesting access
 * @returns Object with SSN fields decrypted
 */
export async function decryptSensitiveFields(
  data: Record<string, unknown>,
  clientId: string,
  staffId?: string
): Promise<Record<string, unknown>> {
  const result = { ...data }
  const ssnFieldsAccessed: string[] = []

  for (const key of Object.keys(result)) {
    const value = result[key]

    // Decrypt SSN fields
    if (key.toLowerCase().includes('ssn') && typeof value === 'string' && value) {
      try {
        result[key] = decryptSSN(value)
        ssnFieldsAccessed.push(key)
      } catch {
        // If decryption fails, assume it's already plain text (migration period)
        console.warn(`[Crypto] Failed to decrypt ${key}, assuming plain text`)
      }
    }

    // Handle dependents array
    if (key === 'dependents' && Array.isArray(value)) {
      result[key] = value.map((dep: Record<string, unknown>, index: number) => {
        if (dep.ssn && typeof dep.ssn === 'string') {
          try {
            ssnFieldsAccessed.push(`dependents[${index}].ssn`)
            return { ...dep, ssn: decryptSSN(dep.ssn) }
          } catch {
            return dep
          }
        }
        return dep
      })
    }
  }

  // Log SSN access for audit compliance
  if (ssnFieldsAccessed.length > 0 && clientId) {
    void logProfileChanges(
      clientId,
      ssnFieldsAccessed.map((field) => ({
        field: `${field}_accessed`,
        oldValue: null,
        newValue: '[DECRYPTED_FOR_VIEW]',
      })),
      staffId
    )
    console.log(`[Crypto] Decrypted ${ssnFieldsAccessed.length} SSN fields for client ${clientId}`)
  }

  return result
}
