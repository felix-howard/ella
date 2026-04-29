/**
 * NDA public-access tokens.
 *
 * Stored directly on `NdaAgreement.token` (unique) — we deliberately don't
 * reuse the shared `MagicLink` table because its `caseId` FK doesn't apply
 * to leads. See plan `## Key Decisions` for rationale.
 */
import { customAlphabet } from 'nanoid'

/** URL-safe alphabet — no confusing chars (0/O, 1/l/I). */
const NDA_TOKEN_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
const NDA_TOKEN_LENGTH = 28

const generate = customAlphabet(NDA_TOKEN_ALPHABET, NDA_TOKEN_LENGTH)

/** NDA link lifetime from send. Locked by design — not configurable per send. */
export const NDA_EXPIRY_DAYS = 7

export function generateNdaToken(): string {
  return generate()
}

export function expiryDate(days: number = NDA_EXPIRY_DAYS, from: Date = new Date()): Date {
  const out = new Date(from)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

export function isExpired(expiresAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false
  return expiresAt.getTime() <= now.getTime()
}
