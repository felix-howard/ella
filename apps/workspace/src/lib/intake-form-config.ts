/**
 * Intake Form Configuration
 * Centralized configuration for intake form sections and fields
 * Used by ClientOverviewSections and SectionEditModal
 */

import type { FieldType } from './api-client'

// Section configuration with Vietnamese labels
export const SECTION_CONFIG: Record<string, { title: string }> = {
  personal_info: { title: 'Thông tin cá nhân' },
  tax_info: { title: 'Thông tin thuế' },
  identity: { title: 'Nhận dạng' },
  client_status: { title: 'Trạng thái khách hàng' },
  prior_year: { title: 'Năm trước & Extension' },
  life_changes: { title: 'Thay đổi trong năm' },
  income: { title: 'Nguồn thu nhập' },
  dependents: { title: 'Người phụ thuộc' },
  health: { title: 'Bảo hiểm sức khỏe' },
  deductions: { title: 'Khấu trừ' },
  credits: { title: 'Tín dụng thuế' },
  foreign: { title: 'Thu nhập nước ngoài' },
  business: { title: 'Thông tin doanh nghiệp' },
  filing: { title: 'Giao nhận tờ khai' },
  bank: { title: 'Thông tin ngân hàng' },
  entity_info: { title: 'Thông tin pháp nhân' },
  ownership: { title: 'Cấu trúc sở hữu' },
  expenses: { title: 'Chi phí kinh doanh' },
  assets: { title: 'Tài sản' },
  state: { title: 'Thuế tiểu bang' },
}

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

// Dependent relationship options
export const RELATIONSHIP_OPTIONS = [
  { value: 'SON', label: 'Con trai' },
  { value: 'DAUGHTER', label: 'Con gái' },
  { value: 'STEPSON', label: 'Con trai riêng' },
  { value: 'STEPDAUGHTER', label: 'Con gái riêng' },
  { value: 'FOSTER_CHILD', label: 'Con nuôi' },
  { value: 'GRANDCHILD', label: 'Cháu' },
  { value: 'NIECE_NEPHEW', label: 'Cháu trai/gái' },
  { value: 'SIBLING', label: 'Anh/Chị/Em' },
  { value: 'PARENT', label: 'Cha/Mẹ' },
  { value: 'OTHER', label: 'Khác' },
]

// Field display configuration - centralized for all components
export const FIELD_CONFIG: Record<string, FieldConfigItem> = {
  // Identity - Taxpayer
  taxpayerSSN: { label: 'Số An sinh Xã hội', section: 'identity', format: 'ssn' },
  taxpayerDOB: { label: 'Ngày sinh', section: 'identity', format: 'date' },
  taxpayerOccupation: { label: 'Nghề nghiệp', section: 'identity', format: 'text' },
  taxpayerDLNumber: { label: 'Số bằng lái', section: 'identity', format: 'text' },
  taxpayerDLIssueDate: { label: 'Ngày cấp bằng lái', section: 'identity', format: 'date' },
  taxpayerDLExpDate: { label: 'Ngày hết hạn bằng lái', section: 'identity', format: 'date' },
  taxpayerDLState: {
    label: 'Tiểu bang cấp bằng lái',
    section: 'identity',
    format: 'select',
    options: US_STATES_OPTIONS,
  },
  taxpayerIPPIN: { label: 'IP PIN (6 số)', section: 'identity', format: 'text' },

  // Identity - Spouse (conditional on MFJ filing status)
  spouseSSN: { label: 'SSN vợ/chồng', section: 'identity', format: 'ssn' },
  spouseDOB: { label: 'Ngày sinh vợ/chồng', section: 'identity', format: 'date' },
  spouseOccupation: { label: 'Nghề nghiệp vợ/chồng', section: 'identity', format: 'text' },
  spouseDLNumber: { label: 'Số bằng lái vợ/chồng', section: 'identity', format: 'text' },
  spouseDLIssueDate: { label: 'Ngày cấp (vợ/chồng)', section: 'identity', format: 'date' },
  spouseDLExpDate: { label: 'Ngày hết hạn (vợ/chồng)', section: 'identity', format: 'date' },
  spouseDLState: {
    label: 'Tiểu bang cấp (vợ/chồng)',
    section: 'identity',
    format: 'select',
    options: US_STATES_OPTIONS,
  },
  spouseIPPIN: { label: 'IP PIN vợ/chồng', section: 'identity', format: 'text' },

  // Identity - Dependents count
  dependentCount: { label: 'Số người phụ thuộc', section: 'identity', format: 'number' },

  // Bank Info
  refundAccountType: {
    label: 'Loại tài khoản',
    section: 'bank',
    format: 'select',
    options: [
      { value: 'CHECKING', label: 'Checking' },
      { value: 'SAVINGS', label: 'Savings' },
    ],
  },

  // Client Status
  isNewClient: { label: 'Khách hàng mới', section: 'client_status', format: 'boolean' },
  hasIrsNotice: { label: 'Có thông báo từ IRS', section: 'client_status', format: 'boolean' },
  hasIdentityTheft: { label: 'Có vấn đề Identity Theft', section: 'client_status', format: 'boolean' },

  // Prior Year
  hasExtensionFiled: { label: 'Đã nộp Extension', section: 'prior_year', format: 'boolean' },
  estimatedTaxPaid: { label: 'Đã trả Estimated Tax', section: 'prior_year', format: 'boolean' },
  estimatedTaxAmountTotal: { label: 'Tổng Estimated Tax đã trả', section: 'prior_year', format: 'currency' },
  estimatedTaxPaidQ1: { label: 'Estimated Tax Q1', section: 'prior_year', format: 'currency' },
  estimatedTaxPaidQ2: { label: 'Estimated Tax Q2', section: 'prior_year', format: 'currency' },
  estimatedTaxPaidQ3: { label: 'Estimated Tax Q3', section: 'prior_year', format: 'currency' },
  estimatedTaxPaidQ4: { label: 'Estimated Tax Q4', section: 'prior_year', format: 'currency' },
  priorYearAGI: { label: 'AGI năm trước', section: 'prior_year', format: 'currency' },

  // Life Changes
  hasAddressChange: { label: 'Đổi địa chỉ', section: 'life_changes', format: 'boolean' },
  hasMaritalChange: { label: 'Thay đổi tình trạng hôn nhân', section: 'life_changes', format: 'boolean' },
  hasNewChild: { label: 'Có con mới', section: 'life_changes', format: 'boolean' },
  hasBoughtSoldHome: { label: 'Mua/Bán nhà', section: 'life_changes', format: 'boolean' },
  hasStartedBusiness: { label: 'Bắt đầu kinh doanh', section: 'life_changes', format: 'boolean' },

  // Income - Employment
  hasW2: { label: 'Có W2', section: 'income', format: 'boolean' },
  w2Count: { label: 'Số lượng W2', section: 'income', format: 'number' },
  hasW2G: { label: 'Có W2-G (Gambling)', section: 'income', format: 'boolean' },
  hasTipsIncome: { label: 'Có thu nhập Tips', section: 'income', format: 'boolean' },
  has1099NEC: { label: 'Có 1099-NEC', section: 'income', format: 'boolean' },
  num1099Types: { label: 'Số loại 1099', section: 'income', format: 'number' },
  hasJuryDutyPay: { label: 'Có tiền Jury Duty', section: 'income', format: 'boolean' },

  // Income - Self Employment
  hasSelfEmployment: { label: 'Tự kinh doanh', section: 'income', format: 'boolean' },

  // Income - Banking & Investments
  hasBankAccount: { label: 'Có tài khoản ngân hàng', section: 'income', format: 'boolean' },
  hasInvestments: { label: 'Có đầu tư', section: 'income', format: 'boolean' },
  hasCrypto: { label: 'Có Crypto', section: 'income', format: 'boolean' },

  // Income - Retirement & Benefits
  hasRetirement: { label: 'Có thu nhập hưu trí', section: 'income', format: 'boolean' },
  hasSocialSecurity: { label: 'Có Social Security', section: 'income', format: 'boolean' },
  hasUnemployment: { label: 'Có Unemployment', section: 'income', format: 'boolean' },
  hasAlimony: { label: 'Có Alimony', section: 'income', format: 'boolean' },

  // Income - Rental & K-1
  hasRentalProperty: { label: 'Có bất động sản cho thuê', section: 'income', format: 'boolean' },
  rentalPropertyCount: { label: 'Số bất động sản', section: 'income', format: 'number' },
  rentalMonthsRented: { label: 'Số tháng cho thuê', section: 'income', format: 'number' },
  rentalPersonalUseDays: { label: 'Số ngày sử dụng cá nhân', section: 'income', format: 'number' },
  hasK1Income: { label: 'Có K-1 Income', section: 'income', format: 'boolean' },
  k1Count: { label: 'Số K-1', section: 'income', format: 'number' },

  // Home Sale (life_changes section - shown when hasBoughtSoldHome is true)
  homeSaleGrossProceeds: { label: 'Tiền bán nhà (Gross)', section: 'life_changes', format: 'currency' },
  homeSaleGain: { label: 'Lợi nhuận bán nhà', section: 'life_changes', format: 'currency' },
  monthsLivedInHome: { label: 'Số tháng sống trong nhà', section: 'life_changes', format: 'number' },

  // Home Office (business section - shown when hasHomeOffice is true)
  homeOfficeSqFt: { label: 'Diện tích Home Office (sqft)', section: 'business', format: 'number' },
  homeOfficeMethod: {
    label: 'Phương pháp Home Office',
    section: 'business',
    format: 'select',
    options: [
      { value: 'SIMPLIFIED', label: 'Simplified ($5/sq ft, max 300)' },
      { value: 'REGULAR', label: 'Regular (actual expenses)' },
    ]
  },

  // Dependents
  hasKidsUnder17: { label: 'Con dưới 17 tuổi', section: 'dependents', format: 'boolean' },
  numKidsUnder17: { label: 'Số con dưới 17 tuổi', section: 'dependents', format: 'number' },
  numDependentsCTC: { label: 'Số người phụ thuộc CTC', section: 'dependents', format: 'number' },
  paysDaycare: { label: 'Trả tiền Daycare', section: 'dependents', format: 'boolean' },
  daycareAmount: { label: 'Số tiền Daycare', section: 'dependents', format: 'currency' },
  childcareProviderName: { label: 'Tên nhà cung cấp Childcare', section: 'dependents', format: 'text' },
  childcareProviderEIN: { label: 'EIN nhà cung cấp Childcare', section: 'dependents', format: 'text' },
  hasKids17to24: { label: 'Con 17-24 tuổi', section: 'dependents', format: 'boolean' },
  hasOtherDependents: { label: 'Người phụ thuộc khác', section: 'dependents', format: 'boolean' },

  // Health Insurance
  hasMarketplaceCoverage: { label: 'Có Marketplace Coverage', section: 'health', format: 'boolean' },
  hasHSA: { label: 'Có HSA', section: 'health', format: 'boolean' },

  // Deductions
  hasMortgage: { label: 'Có Mortgage', section: 'deductions', format: 'boolean' },
  helocInterestPurpose: {
    label: 'Mục đích HELOC',
    section: 'deductions',
    format: 'select',
    options: [
      { value: 'HOME_IMPROVEMENT', label: 'Home Improvement' },
      { value: 'OTHER', label: 'Other' },
    ]
  },
  hasPropertyTax: { label: 'Có Property Tax', section: 'deductions', format: 'boolean' },
  hasCharitableDonations: { label: 'Có từ thiện', section: 'deductions', format: 'boolean' },
  noncashDonationValue: { label: 'Giá trị đóng góp phi tiền mặt', section: 'deductions', format: 'currency' },
  hasMedicalExpenses: { label: 'Có chi phí y tế', section: 'deductions', format: 'boolean' },
  medicalMileage: { label: 'Medical Mileage', section: 'deductions', format: 'number' },
  hasStudentLoanInterest: { label: 'Có Student Loan Interest', section: 'deductions', format: 'boolean' },
  hasEducatorExpenses: { label: 'Có Educator Expenses', section: 'deductions', format: 'boolean' },
  hasCasualtyLoss: { label: 'Có Casualty Loss', section: 'deductions', format: 'boolean' },

  // Credits
  hasEnergyCredits: { label: 'Có Energy Credits', section: 'credits', format: 'boolean' },
  energyCreditInvoice: { label: 'Có hóa đơn Energy Credit', section: 'credits', format: 'boolean' },
  hasEVCredit: { label: 'Có EV Credit', section: 'credits', format: 'boolean' },
  hasAdoptionExpenses: { label: 'Có Adoption Expenses', section: 'credits', format: 'boolean' },
  hasRDCredit: { label: 'Có R&D Credit', section: 'credits', format: 'boolean' },

  // Foreign
  hasForeignAccounts: { label: 'Có tài khoản nước ngoài', section: 'foreign', format: 'boolean' },
  fbarMaxBalance: { label: 'FBAR Max Balance', section: 'foreign', format: 'currency' },
  hasForeignIncome: { label: 'Có thu nhập nước ngoài', section: 'foreign', format: 'boolean' },
  hasForeignTaxPaid: { label: 'Đã trả thuế nước ngoài', section: 'foreign', format: 'boolean' },
  feieResidencyStartDate: { label: 'FEIE Residency Start', section: 'foreign', format: 'text' },
  feieResidencyEndDate: { label: 'FEIE Residency End', section: 'foreign', format: 'text' },
  foreignGiftValue: { label: 'Giá trị quà từ nước ngoài', section: 'foreign', format: 'currency' },

  // Business
  businessName: { label: 'Tên doanh nghiệp', section: 'business', format: 'text' },
  ein: { label: 'EIN', section: 'business', format: 'text' },
  hasEmployees: { label: 'Có nhân viên', section: 'business', format: 'boolean' },
  hasContractors: { label: 'Có contractors', section: 'business', format: 'boolean' },
  has1099K: { label: 'Có 1099-K', section: 'business', format: 'boolean' },
  hasHomeOffice: { label: 'Có Home Office', section: 'business', format: 'boolean' },
  hasBusinessVehicle: { label: 'Có xe kinh doanh', section: 'business', format: 'boolean' },

  // Entity Info (1120S/1065)
  entityName: { label: 'Tên pháp nhân', section: 'entity_info', format: 'text' },
  entityEIN: { label: 'EIN pháp nhân', section: 'entity_info', format: 'text' },
  stateOfFormation: { label: 'Tiểu bang thành lập', section: 'entity_info', format: 'text' },
  accountingMethod: {
    label: 'Phương pháp kế toán',
    section: 'entity_info',
    format: 'select',
    options: [
      { value: 'CASH', label: 'Cash' },
      { value: 'ACCRUAL', label: 'Accrual' },
      { value: 'OTHER', label: 'Other' },
    ]
  },
  returnType: {
    label: 'Loại tờ khai',
    section: 'entity_info',
    format: 'select',
    options: [
      { value: 'ORIGINAL', label: 'Original' },
      { value: 'AMENDED', label: 'Amended' },
      { value: 'FINAL', label: 'Final' },
    ]
  },

  // Ownership
  hasOwnershipChanges: { label: 'Có thay đổi sở hữu', section: 'ownership', format: 'boolean' },
  hasNonresidentOwners: { label: 'Có chủ sở hữu non-resident', section: 'ownership', format: 'boolean' },
  hasDistributions: { label: 'Có distributions', section: 'ownership', format: 'boolean' },
  hasOwnerLoans: { label: 'Có owner loans', section: 'ownership', format: 'boolean' },

  // Expenses
  hasGrossReceipts: { label: 'Có Gross Receipts', section: 'expenses', format: 'boolean' },
  businessHas1099K: { label: 'Business có 1099-K', section: 'expenses', format: 'boolean' },
  businessHas1099NEC: { label: 'Business có 1099-NEC', section: 'expenses', format: 'boolean' },
  hasInterestIncome: { label: 'Có Interest Income', section: 'expenses', format: 'boolean' },
  businessHasRentalIncome: { label: 'Business có Rental Income', section: 'expenses', format: 'boolean' },
  hasInventory: { label: 'Có Inventory', section: 'expenses', format: 'boolean' },
  businessHasEmployees: { label: 'Business có nhân viên', section: 'expenses', format: 'boolean' },
  businessHasContractors: { label: 'Business có contractors', section: 'expenses', format: 'boolean' },
  hasOfficerCompensation: { label: 'Có Officer Compensation', section: 'expenses', format: 'boolean' },
  officerCompensationAmount: { label: 'Số tiền Officer Compensation', section: 'expenses', format: 'currency' },
  hasGuaranteedPayments: { label: 'Có Guaranteed Payments', section: 'expenses', format: 'boolean' },
  guaranteedPaymentsAmount: { label: 'Số tiền Guaranteed Payments', section: 'expenses', format: 'currency' },
  hasRetirementPlan: { label: 'Có Retirement Plan', section: 'expenses', format: 'boolean' },
  hasHealthInsuranceOwners: { label: 'Có Health Insurance cho owners', section: 'expenses', format: 'boolean' },

  // Assets
  hasAssetPurchases: { label: 'Có mua tài sản', section: 'assets', format: 'boolean' },
  hasAssetDisposals: { label: 'Có bán tài sản', section: 'assets', format: 'boolean' },
  hasDepreciation: { label: 'Có khấu hao', section: 'assets', format: 'boolean' },
  hasVehicles: { label: 'Có vehicles', section: 'assets', format: 'boolean' },

  // State
  statesWithNexus: { label: 'Tiểu bang có nexus', section: 'state', format: 'text' },
  hasMultistateIncome: { label: 'Có thu nhập đa tiểu bang', section: 'state', format: 'boolean' },
  businessHasForeignActivity: { label: 'Business có hoạt động nước ngoài', section: 'state', format: 'boolean' },
  hasForeignOwners: { label: 'Có chủ sở hữu nước ngoài', section: 'state', format: 'boolean' },
  shareholderBasisTracking: { label: 'Có theo dõi Shareholder Basis', section: 'state', format: 'boolean' },
  partnerCapitalMethod: {
    label: 'Phương pháp Partner Capital',
    section: 'state',
    format: 'select',
    options: [
      { value: 'TAX', label: 'Tax' },
      { value: 'GAAP', label: 'GAAP' },
      { value: '704B', label: '704(b)' },
    ]
  },

  // Filing
  deliveryPreference: {
    label: 'Preference giao nhận',
    section: 'filing',
    format: 'select',
    options: [
      { value: 'EMAIL', label: 'Email' },
      { value: 'MAIL', label: 'Mail' },
      { value: 'PICKUP', label: 'Pick up' },
    ]
  },
  followUpNotes: { label: 'Ghi chú follow-up', section: 'filing', format: 'text' },
  refundBankAccount: { label: 'Tài khoản nhận refund', section: 'filing', format: 'text' },
  refundRoutingNumber: { label: 'Routing Number', section: 'filing', format: 'text' },

  // Tax Info (display only, from client/taxCase)
  taxYear: { label: 'Năm thuế', section: 'tax_info', format: 'number' },
  filingStatus: { label: 'Tình trạng khai thuế', section: 'tax_info', format: 'select' },
  refundMethod: { label: 'Phương thức nhận refund', section: 'tax_info', format: 'select' },
}

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
  taxpayerDLState: Object.fromEntries(US_STATES_OPTIONS.map(s => [s.value, s.label])),
  spouseDLState: Object.fromEntries(US_STATES_OPTIONS.map(s => [s.value, s.label])),
  // Dependent relationships
  relationship: Object.fromEntries(RELATIONSHIP_OPTIONS.map(r => [r.value, r.label])),
}
