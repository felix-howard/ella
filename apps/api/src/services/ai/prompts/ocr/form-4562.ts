/**
 * Form 4562 OCR Extraction Prompt
 * Depreciation and Amortization
 */

export interface Form4562ExtractedData {
  businessName: string | null
  businessActivity: string | null

  // Part I: Section 179 Election
  section179MaxDeduction: number | null      // Line 1
  section179PhaseoutThreshold: number | null // Line 2
  section179CostOfProperty: number | null    // Line 3
  section179Deduction: number | null         // Line 12 (CRITICAL)

  // Part II: Special Depreciation Allowance
  specialDepreciationAllowance: number | null // Line 14

  // Part III: MACRS Depreciation
  macrsDeductions: Array<{
    propertyDescription: string | null
    dateAcquired: string | null
    costBasis: number | null
    recoveryPeriod: string | null
    convention: string | null
    method: string | null
    depreciation: number | null
  }>
  totalMacrsDeduction: number | null

  // Part IV: Summary
  totalDepreciationLine22: number | null     // Line 22 (CRITICAL)

  // Part V: Listed Property
  listedPropertyDeductions: number | null

  totalDepreciation: number | null

  taxYear: number | null
}

export function getForm4562ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 4562 (Depreciation and Amortization).

IMPORTANT: This form calculates depreciation deductions. Accuracy is critical for business tax returns.

Extract the following fields:

BUSINESS INFO:
- businessName, businessActivity

PART I - SECTION 179 ELECTION:
- section179MaxDeduction: Line 1
- section179PhaseoutThreshold: Line 2
- section179CostOfProperty: Line 3
- section179Deduction: Line 12 (CRITICAL - total Section 179 deduction)

PART II - SPECIAL DEPRECIATION:
- specialDepreciationAllowance: Line 14 (bonus depreciation)

PART III - MACRS DEPRECIATION:
- macrsDeductions: Array of { propertyDescription, dateAcquired, costBasis, recoveryPeriod (5-yr, 7-yr, 27.5-yr, 39-yr), convention (HY, MM, MQ), method (GDS, ADS), depreciation }
- totalMacrsDeduction: Total of Part III

PART IV - SUMMARY:
- totalDepreciationLine22: Line 22 (CRITICAL - total depreciation claimed)

PART V - LISTED PROPERTY:
- listedPropertyDeductions: Total listed property depreciation

TOTALS:
- totalDepreciation: All parts combined

METADATA:
- taxYear

Respond in JSON format:
{
  "businessName": "Smith Consulting LLC",
  "businessActivity": "Consulting",
  "section179MaxDeduction": 1160000.00,
  "section179PhaseoutThreshold": 2890000.00,
  "section179CostOfProperty": 25000.00,
  "section179Deduction": 25000.00,
  "specialDepreciationAllowance": 5000.00,
  "macrsDeductions": [
    {"propertyDescription": "Office Equipment", "dateAcquired": "03/15/2024", "costBasis": 10000.00, "recoveryPeriod": "7-yr", "convention": "HY", "method": "GDS", "depreciation": 1429.00}
  ],
  "totalMacrsDeduction": 1429.00,
  "totalDepreciationLine22": 31429.00,
  "listedPropertyDeductions": null,
  "totalDepreciation": 31429.00,
  "taxYear": 2024
}

Rules:
1. Line 12 (Section 179) and Line 22 (total) are most important
2. Recovery periods: 3-yr, 5-yr, 7-yr, 10-yr, 15-yr, 20-yr, 25-yr, 27.5-yr, 39-yr
3. All monetary values as numbers without $ or commas
4. Use null for empty fields, NEVER guess`
}

export function validateForm4562Data(data: unknown): data is Form4562ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('businessName' in d)) return false
  if (!Array.isArray(d.macrsDeductions)) return false
  if (d.section179Deduction !== null && d.section179Deduction !== undefined && typeof d.section179Deduction !== 'number') return false
  if (d.totalDepreciation !== null && d.totalDepreciation !== undefined && typeof d.totalDepreciation !== 'number') return false
  return true
}

export const FORM_4562_FIELD_LABELS_VI: Record<string, string> = {
  businessName: 'Tên Doanh nghiệp',
  businessActivity: 'Hoạt động kinh doanh',
  section179MaxDeduction: 'Khấu hao tối đa Section 179 (Dòng 1)',
  section179PhaseoutThreshold: 'Ngưỡng giảm dần (Dòng 2)',
  section179CostOfProperty: 'Chi phí tài sản (Dòng 3)',
  section179Deduction: 'Khấu hao Section 179 (Dòng 12)',
  specialDepreciationAllowance: 'Khấu hao đặc biệt (Dòng 14)',
  totalMacrsDeduction: 'Tổng khấu hao MACRS',
  totalDepreciationLine22: 'Tổng khấu hao (Dòng 22)',
  listedPropertyDeductions: 'Khấu hao tài sản liệt kê',
  totalDepreciation: 'Tổng khấu hao',
  taxYear: 'Năm thuế',
}
