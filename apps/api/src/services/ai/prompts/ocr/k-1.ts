/**
 * Schedule K-1 OCR Extraction Prompt
 * Extracts structured data from Schedule K-1 (Form 1065) - Partner's Share of Income
 * Used for partnership income reporting
 */

/**
 * Schedule K-1 extracted data structure
 * Matches IRS Schedule K-1 box layout
 */
export interface ScheduleK1ExtractedData {
  // Partnership Information (Part I)
  partnershipName: string | null
  partnershipAddress: string | null
  partnershipEIN: string | null
  irsCenter: string | null // Where partnership filed return

  // Partner Information (Part II)
  partnerName: string | null
  partnerAddress: string | null
  partnerSSN: string | null // Or EIN if partner is entity

  // Partner's Share Info
  generalPartner: boolean
  limitedPartner: boolean
  domesticPartner: boolean
  foreignPartner: boolean

  profitShareBeginning: number | null // Beginning profit %
  profitShareEnding: number | null // Ending profit %
  lossShareBeginning: number | null // Beginning loss %
  lossShareEnding: number | null // Ending loss %
  capitalShareBeginning: number | null // Beginning capital %
  capitalShareEnding: number | null // Ending capital %

  // Partner's Share of Income/Deductions (Part III)
  ordinaryBusinessIncome: number | null // Box 1 - Ordinary business income (loss)
  netRentalRealEstateIncome: number | null // Box 2 - Net rental real estate income (loss)
  otherNetRentalIncome: number | null // Box 3 - Other net rental income (loss)
  guaranteedPayments: number | null // Box 4 - Guaranteed payments
  interestIncome: number | null // Box 5 - Interest income
  dividends: number | null // Box 6a - Ordinary dividends
  qualifiedDividends: number | null // Box 6b - Qualified dividends
  royalties: number | null // Box 7 - Royalties
  netShortTermCapitalGain: number | null // Box 8 - Net short-term capital gain (loss)
  netLongTermCapitalGain: number | null // Box 9a - Net long-term capital gain (loss)
  collectibles28Gain: number | null // Box 9b - Collectibles (28%) gain (loss)
  unrecaptured1250Gain: number | null // Box 9c - Unrecaptured section 1250 gain
  net1231Gain: number | null // Box 10 - Net section 1231 gain (loss)
  otherIncome: string | null // Box 11 - Other income (loss) with codes
  section179Deduction: number | null // Box 12 - Section 179 deduction
  otherDeductions: string | null // Box 13 - Other deductions with codes
  selfEmploymentEarnings: number | null // Box 14 - Self-employment earnings (loss)

  // Capital Account (Part II, L)
  beginningCapitalAccount: number | null
  currentYearIncrease: number | null
  currentYearDecrease: number | null
  withdrawalsDistributions: number | null
  endingCapitalAccount: number | null

  // Metadata
  taxYear: number | null
  amended: boolean
  formType: 'K-1_1065' | 'K-1_1120S' | null // Partnership vs S-Corp
}

/**
 * Generate Schedule K-1 OCR extraction prompt
 */
export function getScheduleK1ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from Schedule K-1 (Form 1065) - Partner's Share of Income, Deductions, Credits. This form reports a partner's distributive share from a partnership.

IMPORTANT: This is a tax document. Accuracy is critical. If a value is unclear or not present, use null rather than guessing.

Extract the following fields:

PART I - PARTNERSHIP INFORMATION:
- partnershipName: Partnership's name
- partnershipAddress: Partnership's complete address
- partnershipEIN: Partnership's EIN (XX-XXXXXXX format)
- irsCenter: IRS Center where partnership filed

PART II - PARTNER INFORMATION:
- partnerName: Partner's name
- partnerAddress: Partner's address
- partnerSSN: Partner's identifying number (SSN or EIN)

PARTNER TYPE (checkboxes):
- generalPartner: true if "General partner" is checked
- limitedPartner: true if "Limited partner" is checked
- domesticPartner: true if "Domestic partner" is checked
- foreignPartner: true if "Foreign partner" is checked

PARTNER'S SHARE PERCENTAGES:
- profitShareBeginning/Ending: Profit share %
- lossShareBeginning/Ending: Loss share %
- capitalShareBeginning/Ending: Capital share %

PART III - PARTNER'S SHARE OF INCOME/DEDUCTIONS:
- ordinaryBusinessIncome: Box 1 - Ordinary business income (MOST IMPORTANT)
- netRentalRealEstateIncome: Box 2 - Net rental real estate income
- otherNetRentalIncome: Box 3 - Other net rental income
- guaranteedPayments: Box 4 - Guaranteed payments
- interestIncome: Box 5 - Interest income
- dividends: Box 6a - Ordinary dividends
- qualifiedDividends: Box 6b - Qualified dividends
- royalties: Box 7 - Royalties
- netShortTermCapitalGain: Box 8 - Net short-term capital gain
- netLongTermCapitalGain: Box 9a - Net long-term capital gain
- collectibles28Gain: Box 9b - Collectibles (28%) gain
- unrecaptured1250Gain: Box 9c - Unrecaptured section 1250 gain
- net1231Gain: Box 10 - Net section 1231 gain
- otherIncome: Box 11 - Other income (loss) - include code letters
- section179Deduction: Box 12 - Section 179 deduction
- otherDeductions: Box 13 - Other deductions - include code letters
- selfEmploymentEarnings: Box 14 - Self-employment earnings

CAPITAL ACCOUNT:
- beginningCapitalAccount: Beginning capital account
- currentYearIncrease: Current year increase (decrease)
- currentYearDecrease: Current year decrease
- withdrawalsDistributions: Withdrawals & distributions
- endingCapitalAccount: Ending capital account

METADATA:
- taxYear: Tax year
- amended: true if "Amended" is marked
- formType: "K-1_1065" for partnership, "K-1_1120S" for S-Corp

Respond in JSON format:
{
  "partnershipName": "ABC Partners LLC",
  "partnershipAddress": "123 Business Blvd, City, ST 12345",
  "partnershipEIN": "XX-XXXXXXX",
  "irsCenter": "Ogden, UT",
  "partnerName": "John Doe",
  "partnerAddress": "456 Main St, City, ST 67890",
  "partnerSSN": "XXX-XX-XXXX",
  "generalPartner": false,
  "limitedPartner": true,
  "domesticPartner": true,
  "foreignPartner": false,
  "profitShareBeginning": 25.00,
  "profitShareEnding": 25.00,
  "lossShareBeginning": 25.00,
  "lossShareEnding": 25.00,
  "capitalShareBeginning": 25.00,
  "capitalShareEnding": 25.00,
  "ordinaryBusinessIncome": 50000.00,
  "netRentalRealEstateIncome": null,
  "otherNetRentalIncome": null,
  "guaranteedPayments": 12000.00,
  "interestIncome": null,
  "dividends": null,
  "qualifiedDividends": null,
  "royalties": null,
  "netShortTermCapitalGain": null,
  "netLongTermCapitalGain": 5000.00,
  "collectibles28Gain": null,
  "unrecaptured1250Gain": null,
  "net1231Gain": null,
  "otherIncome": "A - 1,500",
  "section179Deduction": null,
  "otherDeductions": "R - 2,000",
  "selfEmploymentEarnings": 62000.00,
  "beginningCapitalAccount": 100000.00,
  "currentYearIncrease": 55000.00,
  "currentYearDecrease": null,
  "withdrawalsDistributions": 30000.00,
  "endingCapitalAccount": 125000.00,
  "taxYear": 2024,
  "amended": false,
  "formType": "K-1_1065"
}

Rules:
1. All monetary values should be numbers without $ or commas
2. Percentages should be decimal (25% = 25.00, not 0.25)
3. Use null for empty or unclear fields, NEVER guess
4. Box 1 (ordinaryBusinessIncome) and Box 14 (selfEmploymentEarnings) are most important
5. For boxes with codes (11, 13, etc.), include the code letter with amount
6. Negative values indicate losses - use negative numbers`
}

/**
 * Validate Schedule K-1 extracted data
 * Checks structure, field existence, and types (allowing null for optional values)
 */
export function validateScheduleK1Data(data: unknown): data is ScheduleK1ExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists (values can be null)
  const requiredFields = ['partnershipName', 'partnershipEIN', 'partnerName', 'partnerSSN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate boolean fields exist and are boolean type
  const boolFields = ['generalPartner', 'limitedPartner', 'domesticPartner', 'foreignPartner', 'amended']
  for (const field of boolFields) {
    if (typeof d[field] !== 'boolean') return false
  }

  // Type validation for key numeric fields (allow null or number)
  if (d.ordinaryBusinessIncome !== null && d.ordinaryBusinessIncome !== undefined && typeof d.ordinaryBusinessIncome !== 'number') return false
  if (d.selfEmploymentEarnings !== null && d.selfEmploymentEarnings !== undefined && typeof d.selfEmploymentEarnings !== 'number') return false

  return true
}

/**
 * Get field labels in Vietnamese for Schedule K-1
 */
export const SCHEDULE_K1_FIELD_LABELS_VI: Record<string, string> = {
  partnershipName: 'Tên Công ty hợp danh',
  partnershipAddress: 'Địa chỉ Công ty',
  partnershipEIN: 'EIN Công ty',
  irsCenter: 'Trung tâm IRS',
  partnerName: 'Tên Thành viên',
  partnerAddress: 'Địa chỉ Thành viên',
  partnerSSN: 'SSN/EIN Thành viên',
  generalPartner: 'Thành viên điều hành',
  limitedPartner: 'Thành viên hạn chế',
  domesticPartner: 'Thành viên trong nước',
  foreignPartner: 'Thành viên nước ngoài',
  profitShareBeginning: 'Tỷ lệ lợi nhuận đầu kỳ (%)',
  profitShareEnding: 'Tỷ lệ lợi nhuận cuối kỳ (%)',
  lossShareBeginning: 'Tỷ lệ lỗ đầu kỳ (%)',
  lossShareEnding: 'Tỷ lệ lỗ cuối kỳ (%)',
  capitalShareBeginning: 'Tỷ lệ vốn đầu kỳ (%)',
  capitalShareEnding: 'Tỷ lệ vốn cuối kỳ (%)',
  ordinaryBusinessIncome: 'Thu nhập kinh doanh thông thường (Box 1)',
  netRentalRealEstateIncome: 'Thu nhập cho thuê BĐS (Box 2)',
  otherNetRentalIncome: 'Thu nhập cho thuê khác (Box 3)',
  guaranteedPayments: 'Thanh toán đảm bảo (Box 4)',
  interestIncome: 'Thu nhập lãi (Box 5)',
  dividends: 'Cổ tức thông thường (Box 6a)',
  qualifiedDividends: 'Cổ tức đủ điều kiện (Box 6b)',
  royalties: 'Tiền bản quyền (Box 7)',
  netShortTermCapitalGain: 'Lãi vốn ngắn hạn (Box 8)',
  netLongTermCapitalGain: 'Lãi vốn dài hạn (Box 9a)',
  collectibles28Gain: 'Lãi sưu tầm 28% (Box 9b)',
  unrecaptured1250Gain: 'Lãi section 1250 (Box 9c)',
  net1231Gain: 'Lãi section 1231 (Box 10)',
  otherIncome: 'Thu nhập khác (Box 11)',
  section179Deduction: 'Khấu hao Section 179 (Box 12)',
  otherDeductions: 'Khấu trừ khác (Box 13)',
  selfEmploymentEarnings: 'Thu nhập tự làm chủ (Box 14)',
  beginningCapitalAccount: 'Vốn đầu kỳ',
  currentYearIncrease: 'Tăng trong năm',
  currentYearDecrease: 'Giảm trong năm',
  withdrawalsDistributions: 'Rút vốn/Phân phối',
  endingCapitalAccount: 'Vốn cuối kỳ',
  taxYear: 'Năm thuế',
  amended: 'Đã sửa đổi',
  formType: 'Loại form',
}
