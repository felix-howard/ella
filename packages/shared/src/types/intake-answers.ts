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
  // Prior Year / Filing
  // ==========================================
  hasExtensionFiled?: boolean
  estimatedTaxPaid?: boolean
  estimatedTaxAmountTotal?: number
  estimatedTaxPaidQ1?: number
  estimatedTaxPaidQ2?: number
  estimatedTaxPaidQ3?: number
  estimatedTaxPaidQ4?: number
  priorYearAGI?: number

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
  w2Count?: number
  hasW2G?: boolean
  hasTipsIncome?: boolean
  has1099NEC?: boolean
  num1099Types?: number
  hasJuryDutyPay?: boolean

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
  rentalPropertyCount?: number
  rentalMonthsRented?: number
  rentalPersonalUseDays?: number
  hasK1Income?: boolean
  k1Count?: number

  // ==========================================
  // Home Sale
  // ==========================================
  homeSaleGrossProceeds?: number
  homeSaleGain?: number
  monthsLivedInHome?: number
  homeOfficeSqFt?: number
  homeOfficeMethod?: 'SIMPLIFIED' | 'REGULAR'

  // ==========================================
  // Dependents
  // ==========================================
  hasKidsUnder17?: boolean
  numKidsUnder17?: number
  numDependentsCTC?: number
  paysDaycare?: boolean
  daycareAmount?: number
  childcareProviderName?: string
  childcareProviderEIN?: string
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
  helocInterestPurpose?: 'HOME_IMPROVEMENT' | 'OTHER'
  hasPropertyTax?: boolean
  hasCharitableDonations?: boolean
  noncashDonationValue?: number
  hasMedicalExpenses?: boolean
  medicalMileage?: number
  hasStudentLoanInterest?: boolean
  hasEducatorExpenses?: boolean
  hasCasualtyLoss?: boolean

  // ==========================================
  // Credits
  // ==========================================
  hasEnergyCredits?: boolean
  energyCreditInvoice?: boolean
  hasEVCredit?: boolean
  hasAdoptionExpenses?: boolean
  hasRDCredit?: boolean

  // ==========================================
  // Foreign
  // ==========================================
  hasForeignAccounts?: boolean
  fbarMaxBalance?: number
  hasForeignIncome?: boolean
  hasForeignTaxPaid?: boolean
  feieResidencyStartDate?: string
  feieResidencyEndDate?: string
  foreignGiftValue?: number

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
  officerCompensationAmount?: number
  hasGuaranteedPayments?: boolean
  guaranteedPaymentsAmount?: number
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
  shareholderBasisTracking?: boolean
  partnerCapitalMethod?: 'TAX' | 'GAAP' | '704B'

  // ==========================================
  // Filing / Delivery
  // ==========================================
  deliveryPreference?: 'EMAIL' | 'MAIL' | 'PICKUP'
  followUpNotes?: string
  refundBankAccount?: string
  refundRoutingNumber?: string

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
