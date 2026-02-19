/**
 * Schedule SE (Form 1040) OCR Extraction Prompt
 * Extracts structured data from Schedule SE - Self-Employment Tax
 * Calculates self-employment tax from Schedule C net profit
 * Line 6 -> Form 1040 Line 23 (Self-employment tax)
 * Line 13 -> Schedule 1 Line 15 (Deductible part of SE tax)
 */

/**
 * Schedule SE extracted data structure
 */
export interface ScheduleSEExtractedData {
  taxYear: number | null
  name: string | null
  ssn: string | null

  // Short Schedule SE (Part I - most common)
  netProfitScheduleC: number | null // Line 2 (from Schedule C, line 31)
  netProfitScheduleF: number | null // Line 1a (from Schedule F)
  combinedNetProfit: number | null // Line 3
  netEarningsMultiplied: number | null // Line 4 (Line 3 * 0.9235)
  selfEmploymentTax: number | null // Line 6 - MOST IMPORTANT -> Form 1040 Line 23
  deductionHalfSeTax: number | null // Line 13 - IMPORTANT -> Schedule 1 Line 15

  // Long Schedule SE (Part II - optional, complex cases)
  useShortSchedule: boolean | null
  churchEmployeeIncome: number | null // Line 5a
  socialSecurityWages: number | null // Line 8a (W-2 wages subject to SS)
  socialSecurityTips: number | null // Line 8b
  unreportedTips: number | null // Line 8c
  wagesSubjectToSSTax: number | null // Line 8d
  totalSocialSecurityTaxable: number | null // Line 9
  socialSecurityMaximum: number | null // Line 10 (SS wage base for year)
  excessWages: number | null // Line 11
}

/**
 * Generate Schedule SE OCR extraction prompt
 */
export function getScheduleSEExtractionPrompt(): string {
  return `You are an OCR system. Extract data from IRS Schedule SE (Form 1040) - Self-Employment Tax.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in the document
- If a field is blank or not visible, return null (never invent data)
- Monetary amounts: return as numbers without $ or commas (e.g., 6357.00)
- This schedule calculates self-employment tax for sole proprietors and partners

HEADER INFORMATION:
- Name as shown on return
- Social Security Number (may be masked)
- Tax year

SHORT SCHEDULE SE (most taxpayers use this):
- Line 1a: Net farm profit or (loss) from Schedule F
- Line 2: Net profit or (loss) from Schedule C - MOST COMMON
- Line 3: Combined net earnings
- Line 4: Multiply Line 3 by 92.35% (0.9235)
- Line 5: Self-employment tax calculation
- Line 6: SELF-EMPLOYMENT TAX (MOST IMPORTANT - goes to Form 1040 Line 23)

DEDUCTION CALCULATION:
- Line 13: Deductible part of self-employment tax (Line 6 * 50%)
  This goes to Schedule 1, Line 15

LONG SCHEDULE SE (Part II - if needed):
- Line 5a: Church employee income
- Line 8a: Total Social Security wages from W-2
- Line 8b: Social Security tips
- Line 8c: Unreported tips
- Line 8d: Wages subject to Social Security tax
- Line 9: Total subject to SS tax
- Line 10: Maximum Social Security wage base for the year
- Line 11: Excess over wage base

OUTPUT FORMAT (JSON):
{
  "taxYear": 2023,
  "name": "NGUYEN VAN ANH",
  "ssn": "XXX-XX-1234",
  "netProfitScheduleC": 98800.00,
  "netProfitScheduleF": null,
  "combinedNetProfit": 98800.00,
  "netEarningsMultiplied": 91227.08,
  "selfEmploymentTax": 13977.00,
  "deductionHalfSeTax": 6988.50,
  "useShortSchedule": true,
  "churchEmployeeIncome": null,
  "socialSecurityWages": null,
  "socialSecurityTips": null,
  "unreportedTips": null,
  "wagesSubjectToSSTax": null,
  "totalSocialSecurityTaxable": null,
  "socialSecurityMaximum": 160200.00,
  "excessWages": null
}

IMPORTANT REMINDERS:
- Return null for any field not found or blank — never guess
- Line 6 (selfEmploymentTax) is CRITICAL - it flows to Form 1040 Line 23
- Line 13 (deductionHalfSeTax) flows to Schedule 1 Line 15 as an adjustment
- SSN may be masked as XXX-XX-XXXX — return as-is
- Most taxpayers use Short Schedule SE (Part I only)
- Self-employment tax rate is 15.3% (12.4% Social Security + 2.9% Medicare)
- The 92.35% multiplier (0.9235) accounts for employer-equivalent portion`
}

/**
 * Validate Schedule SE extracted data
 * Requires selfEmploymentTax as the critical financial field
 */
export function validateScheduleSEData(data: unknown): data is ScheduleSEExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  // selfEmploymentTax is the MOST critical field (goes to Form 1040 Line 23)
  const hasSelfEmploymentTax =
    d.selfEmploymentTax !== null &&
    d.selfEmploymentTax !== undefined &&
    typeof d.selfEmploymentTax === 'number'

  const hasNetProfitScheduleC =
    d.netProfitScheduleC !== null &&
    d.netProfitScheduleC !== undefined &&
    typeof d.netProfitScheduleC === 'number'

  // At least one of the key fields must be present
  return hasSelfEmploymentTax || hasNetProfitScheduleC
}

/**
 * Vietnamese field labels for Schedule SE
 */
export const SCHEDULE_SE_FIELD_LABELS_VI: Record<string, string> = {
  taxYear: 'Năm thuế',
  name: 'Tên',
  ssn: 'Số An sinh xã hội (SSN)',
  // Short SE
  netProfitScheduleC: 'Lợi nhuận ròng Schedule C (Line 2)',
  netProfitScheduleF: 'Lợi nhuận ròng Schedule F (Line 1a)',
  combinedNetProfit: 'Tổng thu nhập ròng (Line 3)',
  netEarningsMultiplied: 'Thu nhập x 92.35% (Line 4)',
  selfEmploymentTax: 'Thuế tự làm chủ (Line 6)',
  deductionHalfSeTax: 'Khấu trừ 1/2 thuế SE (Line 13)',
  // Long SE
  useShortSchedule: 'Dùng Short Schedule SE',
  churchEmployeeIncome: 'Thu nhập nhân viên nhà thờ (Line 5a)',
  socialSecurityWages: 'Lương chịu thuế SS từ W-2 (Line 8a)',
  socialSecurityTips: 'Tips chịu thuế SS (Line 8b)',
  unreportedTips: 'Tips không báo cáo (Line 8c)',
  wagesSubjectToSSTax: 'Lương chịu thuế SS (Line 8d)',
  totalSocialSecurityTaxable: 'Tổng chịu thuế SS (Line 9)',
  socialSecurityMaximum: 'Trần SS cho năm (Line 10)',
  excessWages: 'Lương vượt trần (Line 11)',
}
