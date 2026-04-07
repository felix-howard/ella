/**
 * Form 8995-A OCR Extraction Prompt
 * Qualified Business Income Deduction (Complex)
 */

export interface Form8995AExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: Trade or Business QBI
  businesses: Array<{
    businessName: string | null
    businessTIN: string | null
    qualifiedBusinessIncome: number | null
    w2WagesPaid: number | null                // W-2 wages from business
    ubiaOfQualifiedProperty: number | null    // UBIA of qualified property
    qbiComponent: number | null               // Lesser of 20% QBI or wage/UBIA limit
  }>

  // Part II: W-2 Wages and UBIA Limitations
  totalQBI: number | null
  totalW2Wages: number | null
  totalUBIA: number | null
  wageLimit: number | null                    // 50% of W-2 or 25% W-2 + 2.5% UBIA

  // Part III: Phased-In Reduction (if applicable)
  taxableIncomeBeforeQBI: number | null
  threshold: number | null                    // $191,950/$383,900 (2023)
  phaseInRange: number | null                // $50K/$100K
  reductionRatio: number | null

  // Part IV: Total QBI Deduction
  qbiComponentDeduction: number | null
  qualifiedREITDividends: number | null
  qualifiedPTPIncome: number | null
  reitPTPDeduction: number | null
  totalQBIDeduction: number | null
  incomeLimitDeduction: number | null
  qbiDeductionAmount: number | null          // CRITICAL → Form 1040 Line 13

  taxYear: number | null
}

export function getForm8995AExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8995-A (Qualified Business Income Deduction - Complex).

IMPORTANT: Complex QBI deduction for high-income taxpayers. W-2 wage and UBIA limitations apply.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

PART I - BUSINESS QBI:
- businesses: Array of { businessName, businessTIN, qualifiedBusinessIncome, w2WagesPaid, ubiaOfQualifiedProperty, qbiComponent }

PART II - WAGE/UBIA LIMITS:
- totalQBI, totalW2Wages, totalUBIA
- wageLimit (greater of: 50% W-2 wages OR 25% W-2 wages + 2.5% UBIA)

PART III - PHASE-IN (if applicable):
- taxableIncomeBeforeQBI
- threshold ($191,950 single / $383,900 MFJ for 2023)
- phaseInRange ($50K single / $100K MFJ)
- reductionRatio

PART IV - TOTAL DEDUCTION:
- qbiComponentDeduction (sum of QBI components)
- qualifiedREITDividends, qualifiedPTPIncome
- reitPTPDeduction (20% of REIT/PTP)
- totalQBIDeduction
- incomeLimitDeduction (20% of taxable income less capital gains)
- qbiDeductionAmount (CRITICAL - final QBI deduction → Form 1040 Line 13)

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "businesses": [
    {"businessName": "Doe LLC", "businessTIN": "XX-XXXXXXX", "qualifiedBusinessIncome": 200000.00, "w2WagesPaid": 80000.00, "ubiaOfQualifiedProperty": 50000.00, "qbiComponent": 40000.00}
  ],
  "totalQBI": 200000.00,
  "totalW2Wages": 80000.00,
  "totalUBIA": 50000.00,
  "wageLimit": 40000.00,
  "taxableIncomeBeforeQBI": 450000.00,
  "threshold": 383900.00,
  "phaseInRange": 100000.00,
  "reductionRatio": 0.66,
  "qbiComponentDeduction": 40000.00,
  "qualifiedREITDividends": null,
  "qualifiedPTPIncome": null,
  "reitPTPDeduction": null,
  "totalQBIDeduction": 40000.00,
  "incomeLimitDeduction": 90000.00,
  "qbiDeductionAmount": 40000.00,
  "taxYear": 2024
}

Rules:
1. qbiDeductionAmount is most important (flows to Form 1040 Line 13)
2. QBI component limited by W-2 wages and/or UBIA for high-income
3. Phase-in applies between threshold and threshold + range
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

export function validateForm8995AData(data: unknown): data is Form8995AExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (!Array.isArray(d.businesses)) return false
  if (d.qbiDeductionAmount !== null && d.qbiDeductionAmount !== undefined && typeof d.qbiDeductionAmount !== 'number') return false
  return true
}

export const FORM_8995A_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  totalQBI: 'Tổng QBI',
  totalW2Wages: 'Tổng lương W-2',
  totalUBIA: 'Tổng UBIA',
  wageLimit: 'Giới hạn lương',
  qbiComponentDeduction: 'Khấu trừ thành phần QBI',
  totalQBIDeduction: 'Tổng khấu trừ QBI',
  qbiDeductionAmount: 'Khấu trừ QBI cuối cùng',
  taxYear: 'Năm thuế',
}
