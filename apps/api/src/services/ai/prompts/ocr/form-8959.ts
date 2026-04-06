/**
 * Form 8959 OCR Extraction Prompt
 * Additional Medicare Tax
 */

export interface Form8959ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: Additional Medicare Tax on Medicare Wages
  medicareWages: number | null               // Line 1 (from W-2 Box 5)
  unreportedMedicareWages: number | null     // Line 2
  wageThreshold: number | null               // Line 3 ($200k/$250k/$125k)
  excessWages: number | null                 // Line 4
  additionalMedicareTaxOnWages: number | null // Line 7 (0.9%)

  // Part II: Additional Medicare Tax on Self-Employment Income
  selfEmploymentIncome: number | null        // Line 8
  excessSEIncome: number | null              // Line 10
  additionalMedicareTaxOnSE: number | null   // Line 11 (0.9%)

  // Part III: Additional Medicare Tax on RRTA Compensation
  rrtaCompensation: number | null            // Line 12
  additionalMedicareTaxOnRRTA: number | null // Line 14

  // Part IV: Total Additional Medicare Tax
  totalAdditionalMedicareTax: number | null  // Line 18 (CRITICAL → Schedule 2)
  medicareTaxWithheld: number | null         // Line 19 (from W-2 Box 6)
  excessWithholding: number | null           // Line 22 → Form 1040

  taxYear: number | null
}

export function getForm8959ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8959 (Additional Medicare Tax).

IMPORTANT: 0.9% additional Medicare tax on earnings above threshold. Required for high earners.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

PART I - MEDICARE WAGES:
- medicareWages: Line 1 (from W-2 Box 5)
- unreportedMedicareWages: Line 2
- wageThreshold: Line 3 ($200,000 Single, $250,000 MFJ, $125,000 MFS)
- excessWages: Line 4 (wages above threshold)
- additionalMedicareTaxOnWages: Line 7 (0.9% of excess)

PART II - SELF-EMPLOYMENT INCOME:
- selfEmploymentIncome: Line 8 (from Schedule SE)
- excessSEIncome: Line 10
- additionalMedicareTaxOnSE: Line 11 (0.9% of excess)

PART III - RRTA COMPENSATION:
- rrtaCompensation: Line 12
- additionalMedicareTaxOnRRTA: Line 14

PART IV - TOTALS:
- totalAdditionalMedicareTax: Line 18 (CRITICAL → Schedule 2)
- medicareTaxWithheld: Line 19 (regular Medicare withheld from W-2)
- excessWithholding: Line 22 (credited against income tax)

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "medicareWages": 275000.00,
  "unreportedMedicareWages": null,
  "wageThreshold": 200000.00,
  "excessWages": 75000.00,
  "additionalMedicareTaxOnWages": 675.00,
  "selfEmploymentIncome": null,
  "excessSEIncome": null,
  "additionalMedicareTaxOnSE": null,
  "rrtaCompensation": null,
  "additionalMedicareTaxOnRRTA": null,
  "totalAdditionalMedicareTax": 675.00,
  "medicareTaxWithheld": 3987.50,
  "excessWithholding": 1087.50,
  "taxYear": 2024
}

Rules:
1. Tax rate: 0.9% on earnings above threshold
2. Thresholds: $200k (Single/HoH), $250k (MFJ), $125k (MFS)
3. Line 18 flows to Schedule 2
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

export function validateForm8959Data(data: unknown): data is Form8959ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (d.totalAdditionalMedicareTax !== null && d.totalAdditionalMedicareTax !== undefined && typeof d.totalAdditionalMedicareTax !== 'number') return false
  return true
}

export const FORM_8959_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  medicareWages: 'Tiền lương Medicare (Dòng 1)',
  unreportedMedicareWages: 'Tiền lương chưa báo cáo (Dòng 2)',
  wageThreshold: 'Ngưỡng tiền lương (Dòng 3)',
  excessWages: 'Tiền lương vượt ngưỡng (Dòng 4)',
  additionalMedicareTaxOnWages: 'Thuế Medicare bổ sung - lương (Dòng 7)',
  selfEmploymentIncome: 'Thu nhập tự làm chủ (Dòng 8)',
  excessSEIncome: 'Thu nhập SE vượt ngưỡng (Dòng 10)',
  additionalMedicareTaxOnSE: 'Thuế Medicare bổ sung - SE (Dòng 11)',
  rrtaCompensation: 'Bồi thường RRTA (Dòng 12)',
  additionalMedicareTaxOnRRTA: 'Thuế Medicare bổ sung - RRTA (Dòng 14)',
  totalAdditionalMedicareTax: 'Tổng thuế Medicare bổ sung (Dòng 18)',
  medicareTaxWithheld: 'Thuế Medicare đã khấu trừ (Dòng 19)',
  excessWithholding: 'Khấu trừ thừa (Dòng 22)',
  taxYear: 'Năm thuế',
}
