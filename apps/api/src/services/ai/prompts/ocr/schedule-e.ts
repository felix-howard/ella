/**
 * Schedule E (Form 1040) OCR Extraction Prompt
 * Extracts structured data from Schedule E - Supplemental Income and Loss
 * Part I: Rental real estate and royalties
 * Part II: Partnerships and S corporations
 * Part III: Estates and trusts
 * Line 41 -> Schedule 1 Line 5 (Rental real estate, royalties, partnerships, etc.)
 */

/**
 * Rental property detail structure (Part I)
 * Schedule E supports up to 3 properties (columns A, B, C)
 */
export interface RentalPropertyDetail {
  column: 'A' | 'B' | 'C'
  propertyAddress: string | null
  propertyType: number | null // 1-8 code
  fairRentalDays: number | null
  personalUseDays: number | null
  qbiDeduction: boolean | null
  rentsReceived: number | null // Line 3
  royaltiesReceived: number | null // Line 4
  advertising: number | null // Line 5
  autoAndTravel: number | null // Line 6
  cleaning: number | null // Line 7
  commissions: number | null // Line 8
  insurance: number | null // Line 9
  legalAndProfessional: number | null // Line 10
  managementFees: number | null // Line 11
  mortgageInterest: number | null // Line 12
  otherInterest: number | null // Line 13
  repairs: number | null // Line 14
  supplies: number | null // Line 15
  taxes: number | null // Line 16
  utilities: number | null // Line 17
  depreciation: number | null // Line 18
  otherExpenses: number | null // Line 19
  totalExpenses: number | null // Line 20
  netRentalIncome: number | null // Line 21
}

/**
 * Partnership/S-Corp detail structure (Part II)
 */
export interface PartnershipDetail {
  name: string | null
  ein: string | null
  passiveIncome: number | null
  passiveLoss: number | null
  nonpassiveIncome: number | null
  nonpassiveLoss: number | null
}

/**
 * Estate/Trust detail structure (Part III)
 */
export interface EstateTrustDetail {
  name: string | null
  ein: string | null
  passiveDeduction: number | null
  otherIncome: number | null
}

/**
 * Schedule E extracted data structure
 */
export interface ScheduleEExtractedData {
  taxYear: number | null
  name: string | null
  ssn: string | null

  // Part I - Rental Real Estate and Royalties
  rentalProperties: RentalPropertyDetail[]
  deductibleRentalLoss: number | null // Line 22
  totalRentalRealEstateIncome: number | null // Line 23a
  totalRoyaltyIncome: number | null // Line 23b
  combinedIncome: number | null // Line 24
  rentalLossAllowed: number | null // Line 25
  totalNetRentalIncome: number | null // Line 26 - KEY

  // Part II - Partnerships and S Corporations
  partnerships: PartnershipDetail[]
  totalPartnershipPassiveIncome: number | null // Line 29a
  totalPartnershipNonpassiveIncome: number | null // Line 29b
  totalPartnershipPassiveLoss: number | null // Line 30
  totalPartnershipNonpassiveLoss: number | null // Line 31
  totalPartnershipIncome: number | null // Line 32

  // Part III - Estates and Trusts
  estatesTrusts: EstateTrustDetail[]
  totalEstateIncome: number | null // Line 37

  // Part IV - REMICs
  remicIncome: number | null // Line 39

  // Part V - Summary
  totalScheduleEIncome: number | null // Line 41 - MOST IMPORTANT
}

/**
 * Generate Schedule E OCR extraction prompt
 */
export function getScheduleEExtractionPrompt(): string {
  return `You are an OCR system. Extract data from IRS Schedule E (Form 1040) - Supplemental Income and Loss.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in the document
- If a field is blank or not visible, return null (never invent data)
- Monetary amounts: return as numbers without $ or commas (e.g., 12000.00)
- Negative amounts (losses) use negative numbers (e.g., -5000.00)
- This schedule reports rental income, royalties, and pass-through income

PART I - RENTAL REAL ESTATE AND ROYALTIES:
Schedule E can have up to 3 rental properties (columns A, B, C).

For each property, extract:
- Property address (top of Part I)
- Property type (1=Single Family, 2=Multi-Family, 3=Vacation/Short-Term, etc.)
- Fair rental days and personal use days
- Line 3: Rents received
- Line 4: Royalties received
- Lines 5-19: Individual expense categories
- Line 20: Total expenses
- Line 21: Net income or loss per property

Summary Lines:
- Line 22: Deductible rental real estate loss
- Line 23a: Total rental real estate income
- Line 23b: Total royalty income
- Line 24: Combined income or loss
- Line 25: Rental real estate loss allowed
- Line 26: TOTAL NET RENTAL INCOME (KEY FIELD - goes to Schedule 1 Line 5)

PART II - PARTNERSHIPS AND S CORPORATIONS (if present):
For each entity, extract:
- Name of partnership or S corporation
- Employer identification number (EIN)
- Passive income/loss columns
- Nonpassive income/loss columns
- Line 32: Total partnership/S-corp income

PART III - ESTATES AND TRUSTS (if present):
- Line 37: Total estate and trust income

PART V - SUMMARY:
- Line 41: TOTAL SUPPLEMENTAL INCOME/LOSS (MOST IMPORTANT - combines all parts)

OUTPUT FORMAT (JSON):
{
  "taxYear": 2024,
  "name": "NGUYEN VAN ANH",
  "ssn": "XXX-XX-1234",
  "rentalProperties": [
    {
      "column": "A",
      "propertyAddress": "123 Main St, Houston TX 77001",
      "propertyType": 1,
      "fairRentalDays": 365,
      "personalUseDays": 0,
      "qbiDeduction": true,
      "rentsReceived": 24000.00,
      "royaltiesReceived": null,
      "advertising": 200.00,
      "autoAndTravel": 500.00,
      "cleaning": 800.00,
      "commissions": null,
      "insurance": 1200.00,
      "legalAndProfessional": 300.00,
      "managementFees": null,
      "mortgageInterest": 8000.00,
      "otherInterest": null,
      "repairs": 1500.00,
      "supplies": 200.00,
      "taxes": 3000.00,
      "utilities": null,
      "depreciation": 4000.00,
      "otherExpenses": 300.00,
      "totalExpenses": 20000.00,
      "netRentalIncome": 4000.00
    }
  ],
  "deductibleRentalLoss": null,
  "totalRentalRealEstateIncome": 24000.00,
  "totalRoyaltyIncome": null,
  "combinedIncome": 4000.00,
  "rentalLossAllowed": null,
  "totalNetRentalIncome": 4000.00,
  "partnerships": [],
  "totalPartnershipPassiveIncome": null,
  "totalPartnershipNonpassiveIncome": null,
  "totalPartnershipPassiveLoss": null,
  "totalPartnershipNonpassiveLoss": null,
  "totalPartnershipIncome": null,
  "estatesTrusts": [],
  "totalEstateIncome": null,
  "remicIncome": null,
  "totalScheduleEIncome": 4000.00
}

IMPORTANT REMINDERS:
- Return null for any field not found or blank - never guess
- Return empty array [] for rentalProperties/partnerships/estatesTrusts if none present
- Line 26 (totalNetRentalIncome) flows to Schedule 1 Line 5
- Line 41 (totalScheduleEIncome) is the MOST CRITICAL field
- Property type codes: 1=Single Family, 2=Multi-Family, 3=Vacation/Short-Term, 4=Commercial, 5=Land, 6=Royalties, 7=Self-Rental, 8=Other`
}

/**
 * Validate Schedule E extracted data
 * Requires at least one key income field or rental property
 */
export function validateScheduleEData(data: unknown): data is ScheduleEExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  // Key field: totalScheduleEIncome (Line 41)
  const hasTotalScheduleEIncome =
    d.totalScheduleEIncome !== null &&
    d.totalScheduleEIncome !== undefined &&
    typeof d.totalScheduleEIncome === 'number'

  // Alternative: totalNetRentalIncome (Line 26)
  const hasTotalNetRentalIncome =
    d.totalNetRentalIncome !== null &&
    d.totalNetRentalIncome !== undefined &&
    typeof d.totalNetRentalIncome === 'number'

  // Alternative: has at least one rental property with income
  const hasRentalProperty =
    Array.isArray(d.rentalProperties) &&
    d.rentalProperties.length > 0 &&
    (d.rentalProperties as Array<Record<string, unknown>>).some(
      (p) => p.rentsReceived !== null && typeof p.rentsReceived === 'number'
    )

  return hasTotalScheduleEIncome || hasTotalNetRentalIncome || hasRentalProperty
}

/**
 * Vietnamese field labels for Schedule E
 */
export const SCHEDULE_E_FIELD_LABELS_VI: Record<string, string> = {
  taxYear: 'Năm thuế',
  name: 'Tên',
  ssn: 'Số An sinh xã hội (SSN)',
  // Part I - Rental Properties
  rentalProperties: 'Bất động sản cho thuê',
  column: 'Cột',
  propertyAddress: 'Địa chỉ bất động sản',
  propertyType: 'Loại bất động sản',
  fairRentalDays: 'Số ngày cho thuê',
  personalUseDays: 'Số ngày sử dụng cá nhân',
  qbiDeduction: 'Khấu trừ QBI',
  rentsReceived: 'Tiền thuê nhận được (Line 3)',
  royaltiesReceived: 'Tiền bản quyền (Line 4)',
  advertising: 'Quảng cáo (Line 5)',
  autoAndTravel: 'Xe và đi lại (Line 6)',
  cleaning: 'Vệ sinh (Line 7)',
  commissions: 'Hoa hồng (Line 8)',
  insurance: 'Bảo hiểm (Line 9)',
  legalAndProfessional: 'Pháp lý (Line 10)',
  managementFees: 'Phí quản lý (Line 11)',
  mortgageInterest: 'Lãi thế chấp (Line 12)',
  otherInterest: 'Lãi khác (Line 13)',
  repairs: 'Sửa chữa (Line 14)',
  supplies: 'Vật tư (Line 15)',
  taxes: 'Thuế (Line 16)',
  utilities: 'Tiện ích (Line 17)',
  depreciation: 'Khấu hao (Line 18)',
  otherExpenses: 'Chi phí khác (Line 19)',
  totalExpenses: 'Tổng chi phí (Line 20)',
  netRentalIncome: 'Thu nhập ròng cho thuê (Line 21)',
  deductibleRentalLoss: 'Lỗ cho thuê được khấu trừ (Line 22)',
  totalRentalRealEstateIncome: 'Tổng thu nhập BĐS (Line 23a)',
  totalRoyaltyIncome: 'Tổng tiền bản quyền (Line 23b)',
  combinedIncome: 'Thu nhập kết hợp (Line 24)',
  rentalLossAllowed: 'Lỗ cho thuê được phép (Line 25)',
  totalNetRentalIncome: 'Tổng thu nhập cho thuê ròng (Line 26)',
  // Part II - Partnerships
  partnerships: 'Công ty hợp danh/S-Corp',
  ein: 'Mã số EIN',
  passiveIncome: 'Thu nhập thụ động',
  passiveLoss: 'Lỗ thụ động',
  nonpassiveIncome: 'Thu nhập chủ động',
  nonpassiveLoss: 'Lỗ chủ động',
  totalPartnershipPassiveIncome: 'Tổng thu nhập thụ động (Line 29a)',
  totalPartnershipNonpassiveIncome: 'Tổng thu nhập chủ động (Line 29b)',
  totalPartnershipPassiveLoss: 'Tổng lỗ thụ động (Line 30)',
  totalPartnershipNonpassiveLoss: 'Tổng lỗ chủ động (Line 31)',
  totalPartnershipIncome: 'Tổng thu nhập hợp danh (Line 32)',
  // Part III - Estates/Trusts
  estatesTrusts: 'Di sản/Trust',
  passiveDeduction: 'Khấu trừ thụ động',
  otherIncome: 'Thu nhập khác',
  totalEstateIncome: 'Tổng thu nhập di sản (Line 37)',
  // Part IV - REMICs
  remicIncome: 'Thu nhập REMIC (Line 39)',
  // Part V - Summary
  totalScheduleEIncome: 'Tổng thu nhập Schedule E (Line 41)',
}
