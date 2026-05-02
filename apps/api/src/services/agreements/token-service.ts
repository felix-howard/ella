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

/** Agreement link lifetime from send. Locked by design — not configurable per send. */
export const AGREEMENT_EXPIRY_DAYS = 7

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

export function isExpired(expiresAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false
  return expiresAt.getTime() <= now.getTime()
}
