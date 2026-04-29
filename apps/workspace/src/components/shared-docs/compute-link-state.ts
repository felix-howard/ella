/**
 * compute-link-state — Pure helper to derive magic link UI state.
 *
 * Encapsulates the 4-state logic (active / paused / expired / none)
 * and near-expiry detection so UI components stay declarative.
 */

export type LinkState = 'active' | 'paused' | 'expired' | 'none'

export type LinkStateResult = {
  state: LinkState
  daysUntilExpiry: number | null
  isNearExpiry: boolean
  expiresAt: Date | null
}

export type ComputeLinkStateInput = {
  /** Required when linkExists=true; ignored otherwise. Prevents silent "paused" on undefined. */
  isActive?: boolean
  expiresAt?: Date | string | null
  linkExists: boolean
  now?: Date
}

export const NEAR_EXPIRY_THRESHOLD_DAYS = 3

const MS_PER_DAY = 1000 * 60 * 60 * 24

function parseExpiresAt(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function computeLinkState(input: ComputeLinkStateInput): LinkStateResult {
  const { isActive, linkExists } = input
  const now = input.now ?? new Date()
  const expiresAt = parseExpiresAt(input.expiresAt)

  if (!linkExists) {
    return { state: 'none', daysUntilExpiry: null, isNearExpiry: false, expiresAt }
  }

  if (!isActive) {
    return { state: 'paused', daysUntilExpiry: null, isNearExpiry: false, expiresAt }
  }

  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    return { state: 'expired', daysUntilExpiry: null, isNearExpiry: false, expiresAt }
  }

  // active (possibly with expiry in the future, or never-expires)
  if (!expiresAt) {
    return { state: 'active', daysUntilExpiry: null, isNearExpiry: false, expiresAt: null }
  }

  // Math.round → nearest-day display. Avoids the "extend by 14d shows 13 days" bug:
  // backend sets expiresAt = now + 14d, client sees ~13.9998d by refetch, which floor'd to 13.
  // Near-expiry test still uses rawDays (unrounded) so the 3-day threshold stays precise.
  const rawDays = (expiresAt.getTime() - now.getTime()) / MS_PER_DAY
  const daysUntilExpiry = Math.round(rawDays)
  const isNearExpiry = rawDays <= NEAR_EXPIRY_THRESHOLD_DAYS

  return { state: 'active', daysUntilExpiry, isNearExpiry, expiresAt }
}
