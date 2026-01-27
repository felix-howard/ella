// Computed status utility
export type { ComputedStatus, ComputedStatusInput } from './computed-status'
export { computeStatus, calculateStaleDays, STALE_THRESHOLD_DAYS } from './computed-status'

// Engagement helpers for backward compatibility
export type { ProfileData, LegacyClientProfile, TaxCaseWithOptionalEngagement } from './engagement-helpers'
export { getProfileData, normalizeTaxCase, hasEngagementProfile } from './engagement-helpers'

// Filename sanitization utilities for document naming
export type { DocumentNamingComponents } from './filename-sanitizer'
export {
  removeDiacritics,
  toPascalCase,
  sanitizeComponent,
  generateDocumentName,
  getDisplayNameFromKey,
} from './filename-sanitizer'
