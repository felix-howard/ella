/**
 * Agreement public-access tokens.
 *
 * Stored directly on `Agreement.token` (unique) — we deliberately don't
 * reuse the shared `MagicLink` table because its `caseId` FK doesn't apply
 * to leads. See plan `## Key Decisions` for rationale.
 */
import { customAlphabet } from 'nanoid'

/** URL-safe alphabet — no confusing chars (0/O, 1/l/I). */
const AGREEMENT_TOKEN_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
const AGREEMENT_TOKEN_LENGTH = 28

const generate = customAlphabet(AGREEMENT_TOKEN_ALPHABET, AGREEMENT_TOKEN_LENGTH)

/** Default lifetime when caller doesn't specify. Used as the @default in schema too. */
export const AGREEMENT_EXPIRY_DAYS = 7
/** Lower bound — anything shorter is unusable for a recipient to act on. */
export const MIN_EXPIRY_DAYS = 1
/** Upper bound — keeps SMS commitment within a reasonable engagement window. */
export const MAX_EXPIRY_DAYS = 90

export function generateAgreementToken(): string {
  return generate()
}

/** Legacy alias — preserved for transitional callers + tests. */
export const generateNdaToken = generateAgreementToken

export function expiryDate(days: number = AGREEMENT_EXPIRY_DAYS, from: Date = new Date()): Date {
  const out = new Date(from)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

/** Coerce caller-supplied duration into the supported range. Falsy → default. */
export function clampExpiryDays(days: number | null | undefined): number {
  if (days == null || !Number.isFinite(days)) return AGREEMENT_EXPIRY_DAYS
  const n = Math.trunc(days)
  if (n < MIN_EXPIRY_DAYS) return MIN_EXPIRY_DAYS
  if (n > MAX_EXPIRY_DAYS) return MAX_EXPIRY_DAYS
  return n
}

export function isExpired(expiresAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false
  return expiresAt.getTime() <= now.getTime()
}
