/**
 * Form 6251 OCR Extraction Prompt
 * Alternative Minimum Tax - Individuals
 */

export interface Form6251ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: AMT Income
  regularTaxableIncome: number | null        // Line 1 (from 1040)
  stateLocalTaxDeduction: number | null      // Line 2a (add back SALT)
  miscellaneousDeductions: number | null     // Line 2b
  privateActivityBondInterest: number | null // Line 2c
  incentiveStockOptions: number | null       // Line 2i
  otherAdjustments: number | null            // Lines 2-3
  alternativeMinimumTaxableIncome: number | null // Line 4 (CRITICAL)

  // Part II: AMT Calculation
  exemptionAmount: number | null             // Line 5
  phaseoutThreshold: number | null           // Line 6
  exemptionPhaseout: number | null           // Line 7
  amtiLessExemption: number | null           // Line 8
  tentativeMinimumTax: number | null         // Line 9
  regularTax: number | null                  // Line 10
  alternativeMinimumTax: number | null       // Line 11 (CRITICAL → Schedule 2)

  taxYear: number | null
}

export function getForm6251ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 6251 (Alternative Minimum Tax - Individuals).

IMPORTANT: AMT ensures high-income taxpayers pay minimum tax. Key add-backs: SALT, ISO exercises.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

PART I - AMT INCOME:
- regularTaxableIncome: Line 1 (from Form 1040)
- stateLocalTaxDeduction: Line 2a (SALT deduction added back)
- miscellaneousDeductions: Line 2b
- privateActivityBondInterest: Line 2c
- incentiveStockOptions: Line 2i (ISO bargain element)
- otherAdjustments: Lines 2-3 (other adjustments/preferences)
- alternativeMinimumTaxableIncome: Line 4 (AMTI - sum of all adjustments)

PART II - AMT CALCULATION:
- exemptionAmount: Line 5 (indexed annually, e.g., $85,700 single / $133,300 MFJ for 2024)
- phaseoutThreshold: Line 6
- exemptionPhaseout: Line 7 (25% of AMTI over threshold)
- amtiLessExemption: Line 8
- tentativeMinimumTax: Line 9 (26%/28% of AMTI less exemption)
- regularTax: Line 10
- alternativeMinimumTax: Line 11 (CRITICAL - tentative minus regular → Schedule 2)

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "regularTaxableIncome": 350000.00,
  "stateLocalTaxDeduction": 10000.00,
  "miscellaneousDeductions": null,
  "privateActivityBondInterest": null,
  "incentiveStockOptions": 50000.00,
  "otherAdjustments": null,
  "alternativeMinimumTaxableIncome": 410000.00,
  "exemptionAmount": 81300.00,
  "phaseoutThreshold": 578150.00,
  "exemptionPhaseout": null,
  "amtiLessExemption": 328700.00,
  "tentativeMinimumTax": 87062.00,
  "regularTax": 82500.00,
  "alternativeMinimumTax": 4562.00,
  "taxYear": 2024
}

Rules:
1. alternativeMinimumTax (Line 11) is most important (flows to Schedule 2)
2. AMT = tentative minimum tax minus regular tax (if positive)
3. SALT add-back capped at $10,000 under TCJA
4. ISO add-back = spread at exercise (FMV minus exercise price)
5. All monetary values as numbers without $ or commas
6. Use null for empty fields, NEVER guess`
}

export function validateForm6251Data(data: unknown): data is Form6251ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (d.alternativeMinimumTax !== null && d.alternativeMinimumTax !== undefined && typeof d.alternativeMinimumTax !== 'number') return false
  return true
}

export const FORM_6251_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  regularTaxableIncome: 'Thu nhập chịu thuế thường (Dòng 1)',
  stateLocalTaxDeduction: 'Khấu trừ SALT (Dòng 2a)',
  incentiveStockOptions: 'Quyền chọn cổ phiếu ISO (Dòng 2i)',
  alternativeMinimumTaxableIncome: 'AMTI (Dòng 4)',
  exemptionAmount: 'Số miễn thuế (Dòng 5)',
  tentativeMinimumTax: 'Thuế tối thiểu dự kiến (Dòng 9)',
  regularTax: 'Thuế thường (Dòng 10)',
  alternativeMinimumTax: 'Thuế tối thiểu thay thế (Dòng 11)',
  taxYear: 'Năm thuế',
}
