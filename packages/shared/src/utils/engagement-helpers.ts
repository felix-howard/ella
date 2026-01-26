/**
 * Engagement helpers for backward compatibility during transition
 * Supports both legacy ClientProfile and new TaxEngagement patterns
 */

import type { TaxEngagement } from '../types/tax-engagement'

/**
 * Profile-like data that can come from either TaxEngagement or legacy ClientProfile
 */
export interface ProfileData {
  filingStatus: string | null
  hasW2: boolean
  hasBankAccount: boolean
  hasInvestments: boolean
  hasKidsUnder17: boolean
  numKidsUnder17: number
  paysDaycare: boolean
  hasKids17to24: boolean
  hasSelfEmployment: boolean
  hasRentalProperty: boolean
  businessName: string | null
  ein: string | null
  hasEmployees: boolean
  hasContractors: boolean
  has1099K: boolean
  intakeAnswers?: Record<string, unknown>
}

/**
 * Legacy ClientProfile interface (for backward compat)
 */
export interface LegacyClientProfile extends ProfileData {
  id: string
}

/**
 * TaxCase with optional engagement (during transition)
 */
export interface TaxCaseWithOptionalEngagement {
  id: string
  clientId: string
  engagementId?: string | null
  engagement?: TaxEngagement | null
  taxYear: number
}

/**
 * Get profile data from either engagement or legacy profile
 * Prefers engagement data if available (source of truth going forward)
 *
 * @param taxCase - TaxCase with optional engagement relation
 * @param legacyProfile - Optional legacy ClientProfile (fallback)
 * @returns ProfileData from engagement or legacy profile, or null
 */
export function getProfileData(
  taxCase: TaxCaseWithOptionalEngagement,
  legacyProfile?: LegacyClientProfile | null
): ProfileData | null {
  // Prefer engagement data if available (new pattern)
  if (taxCase.engagement) {
    return {
      filingStatus: taxCase.engagement.filingStatus,
      hasW2: taxCase.engagement.hasW2,
      hasBankAccount: taxCase.engagement.hasBankAccount,
      hasInvestments: taxCase.engagement.hasInvestments,
      hasKidsUnder17: taxCase.engagement.hasKidsUnder17,
      numKidsUnder17: taxCase.engagement.numKidsUnder17,
      paysDaycare: taxCase.engagement.paysDaycare,
      hasKids17to24: taxCase.engagement.hasKids17to24,
      hasSelfEmployment: taxCase.engagement.hasSelfEmployment,
      hasRentalProperty: taxCase.engagement.hasRentalProperty,
      businessName: taxCase.engagement.businessName,
      ein: taxCase.engagement.ein,
      hasEmployees: taxCase.engagement.hasEmployees,
      hasContractors: taxCase.engagement.hasContractors,
      has1099K: taxCase.engagement.has1099K,
      intakeAnswers: taxCase.engagement.intakeAnswers,
    }
  }

  // Fallback to legacy profile
  if (legacyProfile) {
    return {
      filingStatus: legacyProfile.filingStatus,
      hasW2: legacyProfile.hasW2,
      hasBankAccount: legacyProfile.hasBankAccount,
      hasInvestments: legacyProfile.hasInvestments,
      hasKidsUnder17: legacyProfile.hasKidsUnder17,
      numKidsUnder17: legacyProfile.numKidsUnder17,
      paysDaycare: legacyProfile.paysDaycare,
      hasKids17to24: legacyProfile.hasKids17to24,
      hasSelfEmployment: legacyProfile.hasSelfEmployment,
      hasRentalProperty: legacyProfile.hasRentalProperty,
      businessName: legacyProfile.businessName,
      ein: legacyProfile.ein,
      hasEmployees: legacyProfile.hasEmployees,
      hasContractors: legacyProfile.hasContractors,
      has1099K: legacyProfile.has1099K,
      intakeAnswers: legacyProfile.intakeAnswers,
    }
  }

  return null
}

/**
 * Normalize TaxCase to always include engagementId
 * During transition, generates placeholder if missing
 *
 * @param taxCase - TaxCase with optional engagementId
 * @returns TaxCase with guaranteed engagementId string
 */
export function normalizeTaxCase<T extends TaxCaseWithOptionalEngagement>(
  taxCase: T
): T & { engagementId: string } {
  return {
    ...taxCase,
    // Use existing engagementId or fallback to case id (temporary during migration)
    engagementId: taxCase.engagementId ?? taxCase.id,
  }
}

/**
 * Check if a case has engagement-based profile data
 *
 * @param taxCase - TaxCase to check
 * @returns true if case has engagement with profile data
 */
export function hasEngagementProfile(taxCase: TaxCaseWithOptionalEngagement): boolean {
  return !!taxCase.engagement && !!taxCase.engagementId
}
