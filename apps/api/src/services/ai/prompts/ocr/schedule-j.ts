/**
 * Schedule J (Form 1040) OCR Extraction Prompt
 * Extracts structured data from Schedule J - Income Averaging for Farmers and Fishermen
 * Computes tax using 3-year income averaging
 */

export interface ScheduleJExtractedData {
  taxYear: number | null
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Current Year
  taxableIncome: number | null // Line 1
  electiveFarmIncome: number | null // Line 2a
  electiveFishingIncome: number | null // Line 2b

  // Prior Year Incomes (3-year lookback)
  priorYear1TaxableIncome: number | null // Line 3 (1 year back)
  priorYear2TaxableIncome: number | null // Line 7 (2 years back)
  priorYear3TaxableIncome: number | null // Line 11 (3 years back)

  // Allocated Amounts
  allocatedAmount1: number | null // Line 5
  allocatedAmount2: number | null // Line 9
  allocatedAmount3: number | null // Line 13

  // Tax Calculations
  taxOnCurrentYear: number | null // Line 15
  taxOnPriorYear1: number | null // Line 16
  taxOnPriorYear2: number | null // Line 17
  taxOnPriorYear3: number | null // Line 18

  // Result
  averagedTax: number | null // Line 23 (CRITICAL) -> 1040 line 16
}

export function getScheduleJExtractionPrompt(): string {
  return `You are an OCR system. Extract data from IRS Schedule J (Form 1040) - Income Averaging for Farmers and Fishermen.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in the document
- If a field is blank or not visible, return null (never invent data)
- Monetary amounts: return as numbers without $ or commas (e.g., 50000.00)

TAXPAYER INFO (top):
- Name as shown on Form 1040
- Social security number

CURRENT YEAR:
- Line 1: Taxable income from Form 1040
- Line 2a: Elected farm income
- Line 2b: Elected fishing income

PRIOR YEAR TAXABLE INCOMES (3-year lookback):
- Line 3: Taxable income from 1 year ago
- Line 7: Taxable income from 2 years ago
- Line 11: Taxable income from 3 years ago

ALLOCATED AMOUNTS:
- Line 5: Allocated elected farm/fishing income to year 1
- Line 9: Allocated elected farm/fishing income to year 2
- Line 13: Allocated elected farm/fishing income to year 3

TAX CALCULATIONS:
- Line 15: Tax on current year income
- Line 16: Tax on prior year 1 amount
- Line 17: Tax on prior year 2 amount
- Line 18: Tax on prior year 3 amount

RESULT:
- Line 23: Averaged tax - MOST IMPORTANT -> Form 1040 line 16

OUTPUT FORMAT (JSON):
{
  "taxYear": 2023,
  "taxpayerName": "John Doe",
  "taxpayerSSN": "XXX-XX-XXXX",
  "taxableIncome": 120000.00,
  "electiveFarmIncome": 80000.00,
  "electiveFishingIncome": null,
  "priorYear1TaxableIncome": 45000.00,
  "priorYear2TaxableIncome": 38000.00,
  "priorYear3TaxableIncome": 42000.00,
  "allocatedAmount1": 26667.00,
  "allocatedAmount2": 26667.00,
  "allocatedAmount3": 26666.00,
  "taxOnCurrentYear": 5000.00,
  "taxOnPriorYear1": 3200.00,
  "taxOnPriorYear2": 2800.00,
  "taxOnPriorYear3": 3000.00,
  "averagedTax": 14000.00
}

IMPORTANT:
- Return null for any field not found or blank
- Line 23 (averagedTax) -> Form 1040 line 16
- This form is only for farmers and fishermen with fluctuating income`
}

export function validateScheduleJData(data: unknown): data is ScheduleJExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const hasAveraged = d.averagedTax !== null && d.averagedTax !== undefined && typeof d.averagedTax === 'number'
  const hasElectiveFarm = d.electiveFarmIncome !== null && d.electiveFarmIncome !== undefined && typeof d.electiveFarmIncome === 'number'
  const hasElectiveFishing = d.electiveFishingIncome !== null && d.electiveFishingIncome !== undefined && typeof d.electiveFishingIncome === 'number'
  return hasAveraged || hasElectiveFarm || hasElectiveFishing
}

export const SCHEDULE_J_FIELD_LABELS_VI: Record<string, string> = {
  taxYear: 'Năm thuế',
  taxpayerName: 'Tên người nộp thuế',
  taxpayerSSN: 'Số an sinh xã hội',
  taxableIncome: 'Thu nhập chịu thuế (Line 1)',
  electiveFarmIncome: 'Thu nhập nông trại chọn (Line 2a)',
  electiveFishingIncome: 'Thu nhập đánh cá chọn (Line 2b)',
  priorYear1TaxableIncome: 'Thu nhập năm trước 1 (Line 3)',
  priorYear2TaxableIncome: 'Thu nhập năm trước 2 (Line 7)',
  priorYear3TaxableIncome: 'Thu nhập năm trước 3 (Line 11)',
  allocatedAmount1: 'Phân bổ năm 1 (Line 5)',
  allocatedAmount2: 'Phân bổ năm 2 (Line 9)',
  allocatedAmount3: 'Phân bổ năm 3 (Line 13)',
  taxOnCurrentYear: 'Thuế năm hiện tại (Line 15)',
  taxOnPriorYear1: 'Thuế năm trước 1 (Line 16)',
  taxOnPriorYear2: 'Thuế năm trước 2 (Line 17)',
  taxOnPriorYear3: 'Thuế năm trước 3 (Line 18)',
  averagedTax: 'Thuế bình quân (Line 23)',
}
