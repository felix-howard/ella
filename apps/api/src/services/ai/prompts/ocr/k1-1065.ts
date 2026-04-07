/**
 * Schedule K-1 (Form 1065) OCR Extraction Prompt
 * Partnership K-1 - Partner's Share of Income, Deductions, Credits
 */

export interface ScheduleK1_1065ExtractedData {
  partnershipName: string | null
  partnershipEIN: string | null
  partnershipAddress: string | null
  partnerName: string | null
  partnerSSN: string | null
  partnerAddress: string | null
  partnerType: 'GENERAL' | 'LIMITED' | 'LLC_MEMBER' | null
  profitShareBeginning: number | null
  profitShareEnding: number | null
  lossShareBeginning: number | null
  lossShareEnding: number | null
  capitalShareBeginning: number | null
  capitalShareEnding: number | null
  ordinaryBusinessIncome: number | null     // Box 1
  netRentalRealEstateIncome: number | null  // Box 2
  otherNetRentalIncome: number | null       // Box 3
  guaranteedPaymentsServices: number | null // Box 4a
  guaranteedPaymentsCapital: number | null  // Box 4b
  interestIncome: number | null             // Box 5
  ordinaryDividends: number | null          // Box 6a
  qualifiedDividends: number | null         // Box 6b
  royalties: number | null                  // Box 7
  netShortTermCapitalGain: number | null    // Box 8
  netLongTermCapitalGain: number | null     // Box 9a
  collectiblesGain: number | null           // Box 9b
  unrecapturedSection1250: number | null    // Box 9c
  netSection1231Gain: number | null         // Box 10
  otherIncome: string | null                // Box 11
  section179Deduction: number | null        // Box 12
  otherDeductions: string | null            // Box 13
  selfEmploymentEarnings: number | null     // Box 14
  foreignTaxCredit: number | null           // Box 15
  otherCredits: string | null               // Box 15 other
  capitalAccountBeginning: number | null
  capitalAccountEnding: number | null
  capitalAccountMethod: 'TAX' | 'GAAP' | 'SECTION_704' | null
  taxYear: number | null
  finalK1: boolean
  amendedK1: boolean
}

export function getK1_1065ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from Schedule K-1 (Form 1065) - Partner's Share of Income from a Partnership.

IMPORTANT: This is a tax document. Accuracy is critical. If a value is unclear or not present, use null rather than guessing.

Extract the following fields:

PART I - PARTNERSHIP INFO:
- partnershipName, partnershipEIN (XX-XXXXXXX), partnershipAddress

PART II - PARTNER INFO:
- partnerName, partnerSSN (XXX-XX-XXXX or EIN), partnerAddress
- partnerType: "GENERAL", "LIMITED", or "LLC_MEMBER" based on checkbox

OWNERSHIP PERCENTAGES:
- profitShareBeginning/Ending, lossShareBeginning/Ending, capitalShareBeginning/Ending

PART III - INCOME/DEDUCTIONS:
- ordinaryBusinessIncome: Box 1 (MOST IMPORTANT)
- netRentalRealEstateIncome: Box 2
- otherNetRentalIncome: Box 3
- guaranteedPaymentsServices: Box 4a
- guaranteedPaymentsCapital: Box 4b
- interestIncome: Box 5
- ordinaryDividends: Box 6a, qualifiedDividends: Box 6b
- royalties: Box 7
- netShortTermCapitalGain: Box 8
- netLongTermCapitalGain: Box 9a, collectiblesGain: Box 9b, unrecapturedSection1250: Box 9c
- netSection1231Gain: Box 10
- otherIncome: Box 11 (include code letters)
- section179Deduction: Box 12
- otherDeductions: Box 13 (include code letters)
- selfEmploymentEarnings: Box 14 (CRITICAL for SE tax)
- foreignTaxCredit: Box 15, otherCredits: Box 15 other codes

CAPITAL ACCOUNT:
- capitalAccountBeginning, capitalAccountEnding
- capitalAccountMethod: "TAX", "GAAP", or "SECTION_704"

METADATA:
- taxYear, finalK1 (boolean), amendedK1 (boolean)

Respond in JSON format:
{
  "partnershipName": "ABC Partners LLC",
  "partnershipEIN": "XX-XXXXXXX",
  "partnershipAddress": "123 Business Blvd, City, ST 12345",
  "partnerName": "John Doe",
  "partnerSSN": "XXX-XX-XXXX",
  "partnerAddress": "456 Main St, City, ST 67890",
  "partnerType": "LIMITED",
  "profitShareBeginning": 25.00,
  "profitShareEnding": 25.00,
  "lossShareBeginning": 25.00,
  "lossShareEnding": 25.00,
  "capitalShareBeginning": 25.00,
  "capitalShareEnding": 25.00,
  "ordinaryBusinessIncome": 50000.00,
  "netRentalRealEstateIncome": null,
  "otherNetRentalIncome": null,
  "guaranteedPaymentsServices": 12000.00,
  "guaranteedPaymentsCapital": null,
  "interestIncome": null,
  "ordinaryDividends": null,
  "qualifiedDividends": null,
  "royalties": null,
  "netShortTermCapitalGain": null,
  "netLongTermCapitalGain": 5000.00,
  "collectiblesGain": null,
  "unrecapturedSection1250": null,
  "netSection1231Gain": null,
  "otherIncome": "A - 1500",
  "section179Deduction": null,
  "otherDeductions": "R - 2000",
  "selfEmploymentEarnings": 62000.00,
  "foreignTaxCredit": null,
  "otherCredits": null,
  "capitalAccountBeginning": 100000.00,
  "capitalAccountEnding": 125000.00,
  "capitalAccountMethod": "TAX",
  "taxYear": 2024,
  "finalK1": false,
  "amendedK1": false
}

Rules:
1. All monetary values as numbers without $ or commas
2. Percentages as decimal (25% = 25.00)
3. Use null for empty/unclear fields, NEVER guess
4. Box 1 and Box 14 are most important for tax preparation
5. For coded boxes (11, 13), include code letter with amount
6. Negative values indicate losses`
}

export function validateK1_1065Data(data: unknown): data is ScheduleK1_1065ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const requiredFields = ['partnershipName', 'partnershipEIN', 'partnerName', 'partnerSSN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }
  if (typeof d.finalK1 !== 'boolean') return false
  if (typeof d.amendedK1 !== 'boolean') return false
  if (d.ordinaryBusinessIncome !== null && d.ordinaryBusinessIncome !== undefined && typeof d.ordinaryBusinessIncome !== 'number') return false
  return true
}

export const SCHEDULE_K1_1065_FIELD_LABELS_VI: Record<string, string> = {
  partnershipName: 'Tên Công ty hợp danh',
  partnershipEIN: 'EIN Công ty',
  partnershipAddress: 'Địa chỉ Công ty',
  partnerName: 'Tên Thành viên',
  partnerSSN: 'SSN/EIN Thành viên',
  partnerAddress: 'Địa chỉ Thành viên',
  partnerType: 'Loại Thành viên',
  profitShareBeginning: 'Tỷ lệ lợi nhuận đầu kỳ (%)',
  profitShareEnding: 'Tỷ lệ lợi nhuận cuối kỳ (%)',
  lossShareBeginning: 'Tỷ lệ lỗ đầu kỳ (%)',
  lossShareEnding: 'Tỷ lệ lỗ cuối kỳ (%)',
  capitalShareBeginning: 'Tỷ lệ vốn đầu kỳ (%)',
  capitalShareEnding: 'Tỷ lệ vốn cuối kỳ (%)',
  ordinaryBusinessIncome: 'Thu nhập kinh doanh (Box 1)',
  netRentalRealEstateIncome: 'Thu nhập cho thuê BĐS (Box 2)',
  otherNetRentalIncome: 'Thu nhập cho thuê khác (Box 3)',
  guaranteedPaymentsServices: 'Thanh toán đảm bảo - dịch vụ (Box 4a)',
  guaranteedPaymentsCapital: 'Thanh toán đảm bảo - vốn (Box 4b)',
  interestIncome: 'Thu nhập lãi (Box 5)',
  ordinaryDividends: 'Cổ tức thông thường (Box 6a)',
  qualifiedDividends: 'Cổ tức đủ điều kiện (Box 6b)',
  royalties: 'Tiền bản quyền (Box 7)',
  netShortTermCapitalGain: 'Lãi vốn ngắn hạn (Box 8)',
  netLongTermCapitalGain: 'Lãi vốn dài hạn (Box 9a)',
  collectiblesGain: 'Lãi sưu tầm (Box 9b)',
  unrecapturedSection1250: 'Lãi Section 1250 (Box 9c)',
  netSection1231Gain: 'Lãi Section 1231 (Box 10)',
  otherIncome: 'Thu nhập khác (Box 11)',
  section179Deduction: 'Khấu hao Section 179 (Box 12)',
  otherDeductions: 'Khấu trừ khác (Box 13)',
  selfEmploymentEarnings: 'Thu nhập tự làm chủ (Box 14)',
  foreignTaxCredit: 'Tín dụng thuế nước ngoài (Box 15)',
  otherCredits: 'Tín dụng khác (Box 15)',
  capitalAccountBeginning: 'Vốn đầu kỳ',
  capitalAccountEnding: 'Vốn cuối kỳ',
  capitalAccountMethod: 'Phương pháp vốn',
  taxYear: 'Năm thuế',
  finalK1: 'K-1 cuối cùng',
  amendedK1: 'K-1 sửa đổi',
}
