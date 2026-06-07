/**
 * Phone privacy helpers — server-enforced masking of client phone numbers.
 *
 * Authorization rule: full client phone numbers are visible ONLY to ADMIN
 * (Clerk org:admin or app-level Staff.role ADMIN). MANAGER/STAFF/CPA receive
 * masked values in every workspace-facing API response.
 *
 * Apply `serializePhone` at response-build points only — DB queries and
 * internal logic (SMS sending, lead-convert phone matching) keep raw values.
 * Portal (client-facing) routes are untouched: clients may see their own phone.
 */
import type { AuthUser } from '../services/auth'

/** ADMIN tier only — mirrors requireAdmin middleware check (middleware/auth.ts) */
export function canViewFullPhone(user: AuthUser): boolean {
  return user.orgRole === 'org:admin' || user.role === 'ADMIN'
}

/**
 * Mask phone keeping last 4 digits: "*** *** 1234".
 * Matches workspace formatter contract (apps/workspace/src/lib/formatters.ts).
 * Null-safe; short values (<4 digits) mask whatever digits exist.
 */
export function maskPhone(phone: string): string
export function maskPhone(phone: string | null | undefined): string | null
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const last4 = phone.replace(/\D/g, '').slice(-4)
  return `*** *** ${last4}`
}

/** Serialize a phone for an API response based on viewer role */
export function serializePhone(user: AuthUser, phone: string): string
export function serializePhone(user: AuthUser, phone: string | null | undefined): string | null
export function serializePhone(user: AuthUser, phone: string | null | undefined): string | null {
  return canViewFullPhone(user) ? (phone ?? null) : maskPhone(phone)
}
