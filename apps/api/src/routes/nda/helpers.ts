/**
 * Shared helpers for NDA route handlers:
 *   - Extract client IP / User-Agent from Hono context (audit trail)
 *   - Guard deposit-status transitions (staff can't move from PAID back to PENDING, etc.)
 *   - Decode + validate the signature PNG data URL.
 */
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { PNG_DATA_URL_PREFIX } from './schemas'

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const MAX_SIGNATURE_BYTES = 500_000

export function extractIp(c: Context): string {
  const cfIp = c.req.header('cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  const xff = c.req.header('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }

  const real = c.req.header('x-real-ip')
  if (real) return real.trim()

  return 'unknown'
}

export function extractUserAgent(c: Context): string {
  return c.req.header('user-agent')?.trim() || 'unknown'
}

export type DepositStatus = 'PENDING' | 'PAID' | 'REFUNDED' | 'FORFEITED'

/**
 * Whitelist of allowed deposit-status transitions.
 * Keys are current status; values are statuses you can move to.
 * Staff can always re-save the same status (idempotent note update).
 */
const ALLOWED_TRANSITIONS: Record<DepositStatus, readonly DepositStatus[]> = {
  PENDING: ['PENDING', 'PAID', 'FORFEITED'],
  PAID: ['PAID', 'REFUNDED'],
  REFUNDED: ['REFUNDED'],
  FORFEITED: ['FORFEITED'],
}

export function assertDepositTransition(
  from: DepositStatus,
  to: DepositStatus,
): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new HTTPException(409, {
      message: `Cannot transition deposit status from ${from} to ${to}`,
    })
  }
}

export interface DecodedSignature {
  buffer: Buffer
  byteLength: number
}

/**
 * Decode a `data:image/png;base64,...` URL into a Buffer and validate:
 *  - base64 decoding succeeds
 *  - output is ≤ 500KB
 *  - first 8 bytes match the PNG magic number (anti-spoof)
 */
export function decodeSignaturePng(dataUrl: string): DecodedSignature {
  if (!dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    throw new HTTPException(400, { message: 'Invalid signature image format' })
  }

  const base64 = dataUrl.slice(PNG_DATA_URL_PREFIX.length)
  let buffer: Buffer
  try {
    buffer = Buffer.from(base64, 'base64')
  } catch {
    throw new HTTPException(400, { message: 'Invalid signature image encoding' })
  }

  if (buffer.length === 0) {
    throw new HTTPException(400, { message: 'Signature image is empty' })
  }
  if (buffer.length > MAX_SIGNATURE_BYTES) {
    throw new HTTPException(413, { message: 'Signature image too large' })
  }
  if (buffer.length < PNG_MAGIC.length || !PNG_MAGIC.equals(buffer.subarray(0, PNG_MAGIC.length))) {
    throw new HTTPException(400, { message: 'Signature image is not a valid PNG' })
  }

  return { buffer, byteLength: buffer.length }
}
