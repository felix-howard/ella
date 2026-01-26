// Computed status utility
export type { ComputedStatus, ComputedStatusInput } from './computed-status'
export { computeStatus, calculateStaleDays, STALE_THRESHOLD_DAYS } from './computed-status'

// Engagement helpers for backward compatibility
export type { ProfileData, LegacyClientProfile, TaxCaseWithOptionalEngagement } from './engagement-helpers'
export { getProfileData, normalizeTaxCase, hasEngagementProfile } from './engagement-helpers'
