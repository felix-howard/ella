/**
 * IntakeAnswers TypeScript Type Definition
 * Maps to ClientProfile.intakeAnswers JSON field
 *
 * All keys correspond to IntakeQuestion.questionKey values
 * Organized by section for maintainability
 *
 * SECURITY NOTE:
 * - Use validateIntakeAnswers() for API input validation (includes 50KB size limit)
 * - React JSX auto-escapes values, but if rendering via dangerouslySetInnerHTML, sanitize first
 * - String values may contain user input - sanitize before use in non-React contexts
 */

import { intakeAnswersSchema } from '../schemas'

export interface IntakeAnswers {
  // ==========================================
  // Client Status / Identity
  // ==========================================
  isNewClient?: boolean
  hasIrsNotice?: boolean
  hasIdentityTheft?: boolean

  // ==========================================
  // Life Changes
  // ==========================================
  hasAddressChange?: boolean
  hasMaritalChange?: boolean
  hasNewChild?: boolean
  hasBoughtSoldHome?: boolean
  hasStartedBusiness?: boolean

  // ==========================================
  // Income - Employment
  // ==========================================
  hasW2?: boolean
  hasW2G?: boolean
  hasTipsIncome?: boolean

  // ==========================================
  // Income - Self Employment
  // ==========================================
  hasSelfEmployment?: boolean

  // ==========================================
  // Income - Banking & Investments
  // ==========================================
  hasBankAccount?: boolean
  hasInvestments?: boolean
  hasCrypto?: boolean

  // ==========================================
  // Income - Retirement & Benefits
  // ==========================================
  hasRetirement?: boolean
  hasSocialSecurity?: boolean
  hasUnemployment?: boolean
  hasAlimony?: boolean

  // ==========================================
  // Income - Rental & K-1
  // ==========================================
  hasRentalProperty?: boolean
  hasK1Income?: boolean

  // ==========================================
  // Dependents
  // ==========================================
  hasKidsUnder17?: boolean
  numKidsUnder17?: number
  paysDaycare?: boolean
  hasKids17to24?: boolean
  hasOtherDependents?: boolean

  // ==========================================
  // Health Insurance
  // ==========================================
  hasMarketplaceCoverage?: boolean
  hasHSA?: boolean

  // ==========================================
  // Deductions
  // ==========================================
  hasMortgage?: boolean
  hasPropertyTax?: boolean
  hasCharitableDonations?: boolean
  hasMedicalExpenses?: boolean
  hasStudentLoanInterest?: boolean
  hasEducatorExpenses?: boolean

  // ==========================================
  // Credits
  // ==========================================
  hasEnergyCredits?: boolean
  hasEVCredit?: boolean
  hasAdoptionExpenses?: boolean

  // ==========================================
  // Foreign
  // ==========================================
  hasForeignAccounts?: boolean
  hasForeignIncome?: boolean
  hasForeignTaxPaid?: boolean

  // ==========================================
  // Business (conditional on hasSelfEmployment)
  // ==========================================
  businessName?: string
  ein?: string
  hasEmployees?: boolean
  hasContractors?: boolean
  has1099K?: boolean
  hasHomeOffice?: boolean
  hasBusinessVehicle?: boolean

  // ==========================================
  // Business Entity (1120S/1065)
  // ==========================================
  entityName?: string
  entityEIN?: string
  stateOfFormation?: string
  accountingMethod?: 'CASH' | 'ACCRUAL' | 'OTHER'
  returnType?: 'ORIGINAL' | 'AMENDED' | 'FINAL'
  hasOwnershipChanges?: boolean
  hasNonresidentOwners?: boolean
  hasDistributions?: boolean
  hasOwnerLoans?: boolean
  hasGrossReceipts?: boolean
  businessHas1099K?: boolean
  businessHas1099NEC?: boolean
  hasInterestIncome?: boolean
  businessHasRentalIncome?: boolean
  hasInventory?: boolean
  businessHasEmployees?: boolean
  businessHasContractors?: boolean
  hasOfficerCompensation?: boolean
  hasGuaranteedPayments?: boolean
  hasRetirementPlan?: boolean
  hasHealthInsuranceOwners?: boolean
  hasAssetPurchases?: boolean
  hasAssetDisposals?: boolean
  hasDepreciation?: boolean
  hasVehicles?: boolean
  statesWithNexus?: string
  hasMultistateIncome?: boolean
  businessHasForeignActivity?: boolean
  hasForeignOwners?: boolean

  // ==========================================
  // Tax Info / General
  // ==========================================
  taxYear?: number
  filingStatus?: 'SINGLE' | 'MARRIED_FILING_JOINTLY' | 'MARRIED_FILING_SEPARATELY' | 'HEAD_OF_HOUSEHOLD' | 'QUALIFYING_WIDOW'
  refundMethod?: 'DIRECT_DEPOSIT' | 'CHECK' | 'APPLY_NEXT_YEAR'

  // Allow additional dynamic keys for extensibility
  [key: string]: boolean | number | string | undefined
}

/**
 * Type guard to validate IntakeAnswers structure
 */
export function isIntakeAnswers(value: unknown): value is IntakeAnswers {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  // Basic validation - all keys should have valid types
  for (const [, val] of Object.entries(value)) {
    if (val !== undefined && typeof val !== 'boolean' && typeof val !== 'number' && typeof val !== 'string') {
      return false
    }
  }
  return true
}

/**
 * Parse and validate JSON from database
 */
export function parseIntakeAnswers(json: unknown): IntakeAnswers {
  if (typeof json === 'string') {
    try {
      json = JSON.parse(json)
    } catch {
      return {}
    }
  }
  if (isIntakeAnswers(json)) {
    return json
  }
  return {}
}

/**
 * Validate IntakeAnswers using Zod schema (includes size limit check)
 * Use this for API input validation to prevent DoS attacks
 * @returns { success: true, data: IntakeAnswers } or { success: false, error: string }
 */
export function validateIntakeAnswers(json: unknown): { success: true; data: IntakeAnswers } | { success: false; error: string } {
  const parsed = parseIntakeAnswers(json)
  const result = intakeAnswersSchema.safeParse(parsed)
  if (result.success) {
    return { success: true, data: parsed }
  }
  return { success: false, error: result.error.errors[0]?.message || 'Invalid intake answers' }
}
