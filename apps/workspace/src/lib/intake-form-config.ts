/**
 * Intake Form Configuration
 * Centralized configuration for intake form sections and fields
 * Used by ClientOverviewSections and SectionEditModal
 */

import type { FieldType } from './api-client'
import i18n from './i18n'

// Section configuration with i18n keys - titles resolve dynamically via Proxy
const SECTION_CONFIG_KEYS: Record<string, { titleKey: string }> = {
  personal_info: { titleKey: 'section.personalInfo' },
  tax_info: { titleKey: 'section.taxInfo' },
  identity: { titleKey: 'section.identity' },
  client_status: { titleKey: 'section.clientStatus' },
  prior_year: { titleKey: 'section.priorYear' },
  life_changes: { titleKey: 'section.lifeChanges' },
  income: { titleKey: 'section.income' },
  dependents: { titleKey: 'section.dependents' },
  health: { titleKey: 'section.health' },
  deductions: { titleKey: 'section.deductions' },
  credits: { titleKey: 'section.credits' },
  foreign: { titleKey: 'section.foreign' },
  business: { titleKey: 'section.business' },
  filing: { titleKey: 'section.filing' },
  bank: { titleKey: 'section.bank' },
  entity_info: { titleKey: 'section.entityInfo' },
  ownership: { titleKey: 'section.ownership' },
  expenses: { titleKey: 'section.expenses' },
  assets: { titleKey: 'section.assets' },
  state: { titleKey: 'section.state' },
}

export const SECTION_CONFIG: Record<string, { title: string }> = new Proxy(
  {} as Record<string, { title: string }>,
  {
    get(_, prop: string) {
      const cfg = SECTION_CONFIG_KEYS[prop]
      if (!cfg) return undefined
      return { title: i18n.t(cfg.titleKey) }
    },
    has(_, prop: string) {
      return prop in SECTION_CONFIG_KEYS
    },
    ownKeys() {
      return Object.keys(SECTION_CONFIG_KEYS)
    },
    getOwnPropertyDescriptor(_, prop: string) {
      if (prop in SECTION_CONFIG_KEYS) {
        return { configurable: true, enumerable: true }
      }
    },
  }
)

// Section display order
export const SECTION_ORDER = [
  'personal_info',
  'tax_info',
  'identity',
  'client_status',
  'prior_year',
  'life_changes',
  'income',
  'dependents',
  'health',
  'deductions',
  'credits',
  'foreign',
  'business',
  'filing',
  'bank',
  'entity_info',
  'ownership',
  'expenses',
  'assets',
  'state',
] as const

// Sections that use client/taxCase data, not intakeAnswers (read-only)
export const NON_EDITABLE_SECTIONS: readonly string[] = ['personal_info', 'tax_info']

// Field format types (display format in overview)
export type FormatType = 'boolean' | 'currency' | 'number' | 'text' | 'select' | 'ssn' | 'date'

// Field configuration item
export interface FieldConfigItem {
  label: string
  section: string
  format?: FormatType
  options?: { value: string; label: string }[]
}

// Map display format to IntakeQuestion fieldType
export function formatToFieldType(format?: FormatType): FieldType {
  switch (format) {
    case 'boolean': return 'BOOLEAN'
    case 'currency': return 'CURRENCY'
    case 'number': return 'NUMBER'
    case 'select': return 'SELECT'
    case 'ssn': return 'TEXT' // SSN stored as encrypted text
    case 'date': return 'TEXT' // Date stored as ISO string
    case 'text':
    default: return 'TEXT'
  }
}

// US States options for driver's license state selection
export const US_STATES_OPTIONS = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'Washington D.C.' },
]

// Dependent relationship options with i18n keys
const RELATIONSHIP_OPTIONS_DATA = [
  { value: 'SON', i18nKey: 'relationship.son' },
  { value: 'DAUGHTER', i18nKey: 'relationship.daughter' },
  { value: 'STEPSON', i18nKey: 'relationship.stepson' },
  { value: 'STEPDAUGHTER', i18nKey: 'relationship.stepdaughter' },
  { value: 'FOSTER_CHILD', i18nKey: 'relationship.fosterChild' },
  { value: 'GRANDCHILD', i18nKey: 'relationship.grandchild' },
  { value: 'NIECE_NEPHEW', i18nKey: 'relationship.nieceNephew' },
  { value: 'SIBLING', i18nKey: 'relationship.sibling' },
  { value: 'PARENT', i18nKey: 'relationship.parent' },
  { value: 'OTHER', i18nKey: 'relationship.other' },
]

export const RELATIONSHIP_OPTIONS = new Proxy([] as any, {
  get(_, prop: string | symbol) {
    if (prop === 'length') return RELATIONSHIP_OPTIONS_DATA.length
    if (typeof prop === 'symbol' || prop === 'constructor') return (RELATIONSHIP_OPTIONS_DATA as any)[prop]
    const index = Number(prop)
    if (!isNaN(index) && index >= 0 && index < RELATIONSHIP_OPTIONS_DATA.length) {
      const item = RELATIONSHIP_OPTIONS_DATA[index]
      return { value: item.value, label: i18n.t(item.i18nKey) }
    }
    // Support array iteration methods (map, filter, forEach, etc.)
    if (prop === 'map' || prop === 'filter' || prop === 'forEach' || prop === 'find' || prop === 'some' || prop === 'every' || prop === 'reduce' || prop === 'flatMap') {
      return (...args: any[]) => {
        const resolved = RELATIONSHIP_OPTIONS_DATA.map((item: { value: string; i18nKey: string }) => ({ value: item.value, label: i18n.t(item.i18nKey) }))
        return (resolved as any)[prop](...args)
      }
    }
    return (RELATIONSHIP_OPTIONS_DATA as any)[prop]
  },
  ownKeys() {
    return Object.keys(RELATIONSHIP_OPTIONS_DATA)
  },
})

// Field configuration data with i18n keys
const FIELD_CONFIG_DATA: Record<string, { i18nKey: string; section: string; format?: FormatType; options?: { value: string; label: string }[] }> = {
  // Identity - Taxpayer
  taxpayerSSN: { i18nKey: 'field.taxpayerSsn', section: 'identity', format: 'ssn' },
  taxpayerDOB: { i18nKey: 'field.taxpayerDob', section: 'identity', format: 'date' },
  taxpayerOccupation: { i18nKey: 'field.taxpayerOccupation', section: 'identity', format: 'text' },
  taxpayerDLNumber: { i18nKey: 'field.taxpayerDlNumber', section: 'identity', format: 'text' },
  taxpayerDLIssueDate: { i18nKey: 'field.taxpayerDlIssueDate', section: 'identity', format: 'date' },
  taxpayerDLExpDate: { i18nKey: 'field.taxpayerDlExpDate', section: 'identity', format: 'date' },
  taxpayerDLState: { i18nKey: 'field.taxpayerDlState', section: 'identity', format: 'select', options: US_STATES_OPTIONS },
  taxpayerIPPIN: { i18nKey: 'field.taxpayerIpPin', section: 'identity', format: 'text' },
  // Identity - Spouse
  spouseSSN: { i18nKey: 'field.spouseSsn', section: 'identity', format: 'ssn' },
  spouseDOB: { i18nKey: 'field.spouseDob', section: 'identity', format: 'date' },
  spouseOccupation: { i18nKey: 'field.spouseOccupation', section: 'identity', format: 'text' },
  spouseDLNumber: { i18nKey: 'field.spouseDlNumber', section: 'identity', format: 'text' },
  spouseDLIssueDate: { i18nKey: 'field.spouseDlIssueDate', section: 'identity', format: 'date' },
  spouseDLExpDate: { i18nKey: 'field.spouseDlExpDate', section: 'identity', format: 'date' },
  spouseDLState: { i18nKey: 'field.spouseDlState', section: 'identity', format: 'select', options: US_STATES_OPTIONS },
  spouseIPPIN: { i18nKey: 'field.spouseIpPin', section: 'identity', format: 'text' },
  dependentCount: { i18nKey: 'field.dependentCount', section: 'identity', format: 'number' },
  // Bank Info
  refundAccountType: { i18nKey: 'field.refundAccountType', section: 'bank', format: 'select', options: [{ value: 'CHECKING', label: 'Checking' }, { value: 'SAVINGS', label: 'Savings' }] },
  // Client Status
  isNewClient: { i18nKey: 'field.isNewClient', section: 'client_status', format: 'boolean' },
  hasIrsNotice: { i18nKey: 'field.hasIrsNotice', section: 'client_status', format: 'boolean' },
  hasIdentityTheft: { i18nKey: 'field.hasIdentityTheft', section: 'client_status', format: 'boolean' },
  // Prior Year
  hasExtensionFiled: { i18nKey: 'field.hasExtensionFiled', section: 'prior_year', format: 'boolean' },
  estimatedTaxPaid: { i18nKey: 'field.estimatedTaxPaid', section: 'prior_year', format: 'boolean' },
  estimatedTaxAmountTotal: { i18nKey: 'field.estimatedTaxAmountTotal', section: 'prior_year', format: 'currency' },
  estimatedTaxPaidQ1: { i18nKey: 'field.estimatedTaxPaidQ1', section: 'prior_year', format: 'currency' },
  estimatedTaxPaidQ2: { i18nKey: 'field.estimatedTaxPaidQ2', section: 'prior_year', format: 'currency' },
  estimatedTaxPaidQ3: { i18nKey: 'field.estimatedTaxPaidQ3', section: 'prior_year', format: 'currency' },
  estimatedTaxPaidQ4: { i18nKey: 'field.estimatedTaxPaidQ4', section: 'prior_year', format: 'currency' },
  priorYearAGI: { i18nKey: 'field.priorYearAgi', section: 'prior_year', format: 'currency' },
  // Life Changes
  hasAddressChange: { i18nKey: 'field.hasAddressChange', section: 'life_changes', format: 'boolean' },
  hasMaritalChange: { i18nKey: 'field.hasMaritalChange', section: 'life_changes', format: 'boolean' },
  hasNewChild: { i18nKey: 'field.hasNewChild', section: 'life_changes', format: 'boolean' },
  hasBoughtSoldHome: { i18nKey: 'field.hasBoughtSoldHome', section: 'life_changes', format: 'boolean' },
  hasStartedBusiness: { i18nKey: 'field.hasStartedBusiness', section: 'life_changes', format: 'boolean' },
  // Income - Employment
  hasW2: { i18nKey: 'field.hasW2', section: 'income', format: 'boolean' },
  w2Count: { i18nKey: 'field.w2Count', section: 'income', format: 'number' },
  hasW2G: { i18nKey: 'field.hasW2g', section: 'income', format: 'boolean' },
  hasTipsIncome: { i18nKey: 'field.hasTipsIncome', section: 'income', format: 'boolean' },
  has1099NEC: { i18nKey: 'field.has1099Nec', section: 'income', format: 'boolean' },
  num1099Types: { i18nKey: 'field.num1099Types', section: 'income', format: 'number' },
  hasJuryDutyPay: { i18nKey: 'field.hasJuryDutyPay', section: 'income', format: 'boolean' },
  // Income - Self Employment
  hasSelfEmployment: { i18nKey: 'field.hasSelfEmployment', section: 'income', format: 'boolean' },
  // Income - Banking & Investments
  hasBankAccount: { i18nKey: 'field.hasBankAccount', section: 'income', format: 'boolean' },
  hasInvestments: { i18nKey: 'field.hasInvestments', section: 'income', format: 'boolean' },
  hasCrypto: { i18nKey: 'field.hasCrypto', section: 'income', format: 'boolean' },
  // Income - Retirement & Benefits
  hasRetirement: { i18nKey: 'field.hasRetirement', section: 'income', format: 'boolean' },
  hasSocialSecurity: { i18nKey: 'field.hasSocialSecurity', section: 'income', format: 'boolean' },
  hasUnemployment: { i18nKey: 'field.hasUnemployment', section: 'income', format: 'boolean' },
  hasAlimony: { i18nKey: 'field.hasAlimony', section: 'income', format: 'boolean' },
  // Income - Rental & K-1
  hasRentalProperty: { i18nKey: 'field.hasRentalProperty', section: 'income', format: 'boolean' },
  rentalPropertyCount: { i18nKey: 'field.rentalPropertyCount', section: 'income', format: 'number' },
  rentalMonthsRented: { i18nKey: 'field.rentalMonthsRented', section: 'income', format: 'number' },
  rentalPersonalUseDays: { i18nKey: 'field.rentalPersonalUseDays', section: 'income', format: 'number' },
  hasK1Income: { i18nKey: 'field.hasK1Income', section: 'income', format: 'boolean' },
  k1Count: { i18nKey: 'field.k1Count', section: 'income', format: 'number' },
  // Home Sale
  homeSaleGrossProceeds: { i18nKey: 'field.homeSaleGrossProceeds', section: 'life_changes', format: 'currency' },
  homeSaleGain: { i18nKey: 'field.homeSaleGain', section: 'life_changes', format: 'currency' },
  monthsLivedInHome: { i18nKey: 'field.monthsLivedInHome', section: 'life_changes', format: 'number' },
  // Home Office
  homeOfficeSqFt: { i18nKey: 'field.homeOfficeSqFt', section: 'business', format: 'number' },
  homeOfficeMethod: { i18nKey: 'field.homeOfficeMethod', section: 'business', format: 'select', options: [{ value: 'SIMPLIFIED', label: 'Simplified ($5/sq ft, max 300)' }, { value: 'REGULAR', label: 'Regular (actual expenses)' }] },
  // Dependents
  hasKidsUnder17: { i18nKey: 'field.hasKidsUnder17', section: 'dependents', format: 'boolean' },
  numKidsUnder17: { i18nKey: 'field.numKidsUnder17', section: 'dependents', format: 'number' },
  numDependentsCTC: { i18nKey: 'field.numDependentsCtc', section: 'dependents', format: 'number' },
  paysDaycare: { i18nKey: 'field.paysDaycare', section: 'dependents', format: 'boolean' },
  daycareAmount: { i18nKey: 'field.daycareAmount', section: 'dependents', format: 'currency' },
  childcareProviderName: { i18nKey: 'field.childcareProviderName', section: 'dependents', format: 'text' },
  childcareProviderEIN: { i18nKey: 'field.childcareProviderEin', section: 'dependents', format: 'text' },
  hasKids17to24: { i18nKey: 'field.hasKids17To24', section: 'dependents', format: 'boolean' },
  hasOtherDependents: { i18nKey: 'field.hasOtherDependents', section: 'dependents', format: 'boolean' },
  // Health Insurance
  hasMarketplaceCoverage: { i18nKey: 'field.hasMarketplaceCoverage', section: 'health', format: 'boolean' },
  hasHSA: { i18nKey: 'field.hasHsa', section: 'health', format: 'boolean' },
  // Deductions
  hasMortgage: { i18nKey: 'field.hasMortgage', section: 'deductions', format: 'boolean' },
  helocInterestPurpose: { i18nKey: 'field.helocInterestPurpose', section: 'deductions', format: 'select', options: [{ value: 'HOME_IMPROVEMENT', label: 'Home Improvement' }, { value: 'OTHER', label: 'Other' }] },
  hasPropertyTax: { i18nKey: 'field.hasPropertyTax', section: 'deductions', format: 'boolean' },
  hasCharitableDonations: { i18nKey: 'field.hasCharitableDonations', section: 'deductions', format: 'boolean' },
  noncashDonationValue: { i18nKey: 'field.noncashDonationValue', section: 'deductions', format: 'currency' },
  hasMedicalExpenses: { i18nKey: 'field.hasMedicalExpenses', section: 'deductions', format: 'boolean' },
  medicalMileage: { i18nKey: 'field.medicalMileage', section: 'deductions', format: 'number' },
  hasStudentLoanInterest: { i18nKey: 'field.hasStudentLoanInterest', section: 'deductions', format: 'boolean' },
  hasEducatorExpenses: { i18nKey: 'field.hasEducatorExpenses', section: 'deductions', format: 'boolean' },
  hasCasualtyLoss: { i18nKey: 'field.hasCasualtyLoss', section: 'deductions', format: 'boolean' },
  // Credits
  hasEnergyCredits: { i18nKey: 'field.hasEnergyCredits', section: 'credits', format: 'boolean' },
  energyCreditInvoice: { i18nKey: 'field.energyCreditInvoice', section: 'credits', format: 'boolean' },
  hasEVCredit: { i18nKey: 'field.hasEvCredit', section: 'credits', format: 'boolean' },
  hasAdoptionExpenses: { i18nKey: 'field.hasAdoptionExpenses', section: 'credits', format: 'boolean' },
  hasRDCredit: { i18nKey: 'field.hasRdCredit', section: 'credits', format: 'boolean' },
  // Foreign
  hasForeignAccounts: { i18nKey: 'field.hasForeignAccounts', section: 'foreign', format: 'boolean' },
  fbarMaxBalance: { i18nKey: 'field.fbarMaxBalance', section: 'foreign', format: 'currency' },
  hasForeignIncome: { i18nKey: 'field.hasForeignIncome', section: 'foreign', format: 'boolean' },
  hasForeignTaxPaid: { i18nKey: 'field.hasForeignTaxPaid', section: 'foreign', format: 'boolean' },
  feieResidencyStartDate: { i18nKey: 'field.feieResidencyStartDate', section: 'foreign', format: 'text' },
  feieResidencyEndDate: { i18nKey: 'field.feieResidencyEndDate', section: 'foreign', format: 'text' },
  foreignGiftValue: { i18nKey: 'field.foreignGiftValue', section: 'foreign', format: 'currency' },
  // Business
  businessName: { i18nKey: 'field.businessName', section: 'business', format: 'text' },
  ein: { i18nKey: 'field.ein', section: 'business', format: 'text' },
  hasEmployees: { i18nKey: 'field.hasEmployees', section: 'business', format: 'boolean' },
  hasContractors: { i18nKey: 'field.hasContractors', section: 'business', format: 'boolean' },
  has1099K: { i18nKey: 'field.has1099K', section: 'business', format: 'boolean' },
  hasHomeOffice: { i18nKey: 'field.hasHomeOffice', section: 'business', format: 'boolean' },
  hasBusinessVehicle: { i18nKey: 'field.hasBusinessVehicle', section: 'business', format: 'boolean' },
  // Entity Info (1120S/1065)
  entityName: { i18nKey: 'field.entityName', section: 'entity_info', format: 'text' },
  entityEIN: { i18nKey: 'field.entityEin', section: 'entity_info', format: 'text' },
  stateOfFormation: { i18nKey: 'field.stateOfFormation', section: 'entity_info', format: 'text' },
  accountingMethod: { i18nKey: 'field.accountingMethod', section: 'entity_info', format: 'select', options: [{ value: 'CASH', label: 'Cash' }, { value: 'ACCRUAL', label: 'Accrual' }, { value: 'OTHER', label: 'Other' }] },
  returnType: { i18nKey: 'field.returnType', section: 'entity_info', format: 'select', options: [{ value: 'ORIGINAL', label: 'Original' }, { value: 'AMENDED', label: 'Amended' }, { value: 'FINAL', label: 'Final' }] },
  // Ownership
  hasOwnershipChanges: { i18nKey: 'field.hasOwnershipChanges', section: 'ownership', format: 'boolean' },
  hasNonresidentOwners: { i18nKey: 'field.hasNonresidentOwners', section: 'ownership', format: 'boolean' },
  hasDistributions: { i18nKey: 'field.hasDistributions', section: 'ownership', format: 'boolean' },
  hasOwnerLoans: { i18nKey: 'field.hasOwnerLoans', section: 'ownership', format: 'boolean' },
  // Expenses
  hasGrossReceipts: { i18nKey: 'field.hasGrossReceipts', section: 'expenses', format: 'boolean' },
  businessHas1099K: { i18nKey: 'field.businessHas1099K', section: 'expenses', format: 'boolean' },
  businessHas1099NEC: { i18nKey: 'field.businessHas1099Nec', section: 'expenses', format: 'boolean' },
  hasInterestIncome: { i18nKey: 'field.hasInterestIncome', section: 'expenses', format: 'boolean' },
  businessHasRentalIncome: { i18nKey: 'field.businessHasRentalIncome', section: 'expenses', format: 'boolean' },
  hasInventory: { i18nKey: 'field.hasInventory', section: 'expenses', format: 'boolean' },
  businessHasEmployees: { i18nKey: 'field.businessHasEmployees', section: 'expenses', format: 'boolean' },
  businessHasContractors: { i18nKey: 'field.businessHasContractors', section: 'expenses', format: 'boolean' },
  hasOfficerCompensation: { i18nKey: 'field.hasOfficerCompensation', section: 'expenses', format: 'boolean' },
  officerCompensationAmount: { i18nKey: 'field.officerCompensationAmount', section: 'expenses', format: 'currency' },
  hasGuaranteedPayments: { i18nKey: 'field.hasGuaranteedPayments', section: 'expenses', format: 'boolean' },
  guaranteedPaymentsAmount: { i18nKey: 'field.guaranteedPaymentsAmount', section: 'expenses', format: 'currency' },
  hasRetirementPlan: { i18nKey: 'field.hasRetirementPlan', section: 'expenses', format: 'boolean' },
  hasHealthInsuranceOwners: { i18nKey: 'field.hasHealthInsuranceOwners', section: 'expenses', format: 'boolean' },
  // Assets
  hasAssetPurchases: { i18nKey: 'field.hasAssetPurchases', section: 'assets', format: 'boolean' },
  hasAssetDisposals: { i18nKey: 'field.hasAssetDisposals', section: 'assets', format: 'boolean' },
  hasDepreciation: { i18nKey: 'field.hasDepreciation', section: 'assets', format: 'boolean' },
  hasVehicles: { i18nKey: 'field.hasVehicles', section: 'assets', format: 'boolean' },
  // State
  statesWithNexus: { i18nKey: 'field.statesWithNexus', section: 'state', format: 'text' },
  hasMultistateIncome: { i18nKey: 'field.hasMultistateIncome', section: 'state', format: 'boolean' },
  businessHasForeignActivity: { i18nKey: 'field.businessHasForeignActivity', section: 'state', format: 'boolean' },
  hasForeignOwners: { i18nKey: 'field.hasForeignOwners', section: 'state', format: 'boolean' },
  shareholderBasisTracking: { i18nKey: 'field.shareholderBasisTracking', section: 'state', format: 'boolean' },
  partnerCapitalMethod: { i18nKey: 'field.partnerCapitalMethod', section: 'state', format: 'select', options: [{ value: 'TAX', label: 'Tax' }, { value: 'GAAP', label: 'GAAP' }, { value: '704B', label: '704(b)' }] },
  // Filing
  deliveryPreference: { i18nKey: 'field.deliveryPreference', section: 'filing', format: 'select', options: [{ value: 'EMAIL', label: 'Email' }, { value: 'MAIL', label: 'Mail' }, { value: 'PICKUP', label: 'Pick up' }] },
  followUpNotes: { i18nKey: 'field.followUpNotes', section: 'filing', format: 'text' },
  refundBankAccount: { i18nKey: 'field.refundBankAccount', section: 'filing', format: 'text' },
  refundRoutingNumber: { i18nKey: 'field.refundRoutingNumber', section: 'filing', format: 'text' },
  // Tax Info (display only, from client/taxCase)
  taxYear: { i18nKey: 'field.taxYear', section: 'tax_info', format: 'number' },
  filingStatus: { i18nKey: 'field.filingStatus', section: 'tax_info', format: 'select' },
  refundMethod: { i18nKey: 'field.refundMethod', section: 'tax_info', format: 'select' },
}

// Field display configuration - labels resolve dynamically via Proxy
export const FIELD_CONFIG: Record<string, FieldConfigItem> = new Proxy(
  {} as Record<string, FieldConfigItem>,
  {
    get(_, prop: string) {
      const cfg = FIELD_CONFIG_DATA[prop]
      if (!cfg) return undefined
      return { label: i18n.t(cfg.i18nKey), section: cfg.section, format: cfg.format, options: cfg.options }
    },
    has(_, prop: string) {
      return prop in FIELD_CONFIG_DATA
    },
    ownKeys() {
      return Object.keys(FIELD_CONFIG_DATA)
    },
    getOwnPropertyDescriptor(_, prop: string) {
      if (prop in FIELD_CONFIG_DATA) {
        return { configurable: true, enumerable: true }
      }
    },
  }
)

// Select option labels for display formatting
export const SELECT_LABELS: Record<string, Record<string, string>> = {
  homeOfficeMethod: {
    SIMPLIFIED: 'Simplified',
    REGULAR: 'Regular',
  },
  helocInterestPurpose: {
    HOME_IMPROVEMENT: 'Home Improvement',
    OTHER: 'Other',
  },
  accountingMethod: {
    CASH: 'Cash',
    ACCRUAL: 'Accrual',
    OTHER: 'Other',
  },
  returnType: {
    ORIGINAL: 'Original',
    AMENDED: 'Amended',
    FINAL: 'Final',
  },
  deliveryPreference: {
    EMAIL: 'Email',
    MAIL: 'Mail',
    PICKUP: 'Pick up',
  },
  refundMethod: {
    DIRECT_DEPOSIT: 'Direct Deposit',
    CHECK: 'Check',
    APPLY_NEXT_YEAR: 'Apply to Next Year',
  },
  partnerCapitalMethod: {
    TAX: 'Tax',
    GAAP: 'GAAP',
    '704B': '704(b)',
  },
  refundAccountType: {
    CHECKING: 'Checking',
    SAVINGS: 'Savings',
  },
  // US States - generate from US_STATES_OPTIONS
  taxpayerDLState: Object.fromEntries(US_STATES_OPTIONS.map((s: { value: string; label: string }) => [s.value, s.label])),
  spouseDLState: Object.fromEntries(US_STATES_OPTIONS.map((s: { value: string; label: string }) => [s.value, s.label])),
  // Dependent relationships
  relationship: Object.fromEntries(RELATIONSHIP_OPTIONS.map((r: { value: string; label: string }) => [r.value, r.label])),
}
