/**
 * Schedule R (Form 1040) OCR Extraction Prompt
 * Extracts structured data from Schedule R - Credit for the Elderly or the Disabled
 * Credit amount -> Schedule 3 Line 6d
 */

export interface ScheduleRExtractedData {
  taxYear: number | null
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: Check Your Filing Status and Age
  filingStatusCheckbox: string | null // Boxes 1-9
  age65OrOlder: boolean | null
  spouseAge65OrOlder: boolean | null
  permanentlyDisabled: boolean | null
  spousePermanentlyDisabled: boolean | null

  // Part II: Statement of Permanent and Total Disability
  disabilityStatementAttached: boolean | null

  // Part III: Figure Your Credit
  initialAmount: number | null // Line 10
  taxableSocialSecurity: number | null // Line 11
  nonTaxablePensions: number | null // Line 12
  taxExemptInterest: number | null // Line 13
  totalLine11to13: number | null // Line 14
  adjustedAmount: number | null // Line 15
  agiFromForm1040: number | null // Line 16
  agiThreshold: number | null // Line 17
  excessAGI: number | null // Line 18
  netAmount: number | null // Line 19
  creditAmount: number | null // Line 20 (CRITICAL) -> Schedule 3 Line 6d
}

export function getScheduleRExtractionPrompt(): string {
  return `You are an OCR system. Extract data from IRS Schedule R (Form 1040) - Credit for the Elderly or the Disabled.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in the document
- If a field is blank or not visible, return null (never invent data)
- Monetary amounts: return as numbers without $ or commas (e.g., 750.00)
- Boolean fields: true/false based on checkboxes

TAXPAYER INFO (top):
- Name as shown on Form 1040
- Social security number

PART I - CHECK YOUR FILING STATUS AND AGE:
- Checkbox 1-9: Filing status and age category
- Whether taxpayer is 65 or older
- Whether spouse is 65 or older
- Whether taxpayer is permanently/totally disabled
- Whether spouse is permanently/totally disabled

PART II - STATEMENT OF PERMANENT AND TOTAL DISABILITY:
- Whether disability statement is attached

PART III - FIGURE YOUR CREDIT:
- Line 10: Initial amount (based on filing status)
- Line 11: Taxable social security benefits
- Line 12: Certain other nontaxable pensions/annuities
- Line 13: Tax-exempt interest
- Line 14: Total of lines 11 through 13
- Line 15: Adjusted initial amount (Line 10 minus Line 14)
- Line 16: Adjusted gross income from Form 1040
- Line 17: AGI threshold amount
- Line 18: Excess AGI (Line 16 minus Line 17)
- Line 19: Net amount for credit calculation
- Line 20: Credit amount (15% of Line 19) - CRITICAL -> Schedule 3 Line 6d

OUTPUT FORMAT (JSON):
{
  "taxYear": 2023,
  "taxpayerName": "John Doe",
  "taxpayerSSN": "XXX-XX-XXXX",
  "filingStatusCheckbox": "1",
  "age65OrOlder": true,
  "spouseAge65OrOlder": null,
  "permanentlyDisabled": false,
  "spousePermanentlyDisabled": null,
  "disabilityStatementAttached": false,
  "initialAmount": 5000.00,
  "taxableSocialSecurity": 1200.00,
  "nonTaxablePensions": 800.00,
  "taxExemptInterest": null,
  "totalLine11to13": 2000.00,
  "adjustedAmount": 3000.00,
  "agiFromForm1040": 22000.00,
  "agiThreshold": 7500.00,
  "excessAGI": 14500.00,
  "netAmount": null,
  "creditAmount": 750.00
}

IMPORTANT:
- Return null for any field not found or blank
- Line 20 (creditAmount) -> Schedule 3 Line 6d
- Credit is 15% of the net amount (Line 19)
- Only available if age 65+ OR permanently/totally disabled`
}

export function validateScheduleRData(data: unknown): data is ScheduleRExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const hasCredit = d.creditAmount !== null && d.creditAmount !== undefined && typeof d.creditAmount === 'number'
  const hasInitial = d.initialAmount !== null && d.initialAmount !== undefined && typeof d.initialAmount === 'number'
  const hasAge = d.age65OrOlder !== null && d.age65OrOlder !== undefined && typeof d.age65OrOlder === 'boolean'
  return hasCredit || hasInitial || hasAge
}

export const SCHEDULE_R_FIELD_LABELS_VI: Record<string, string> = {
  taxYear: 'Năm thuế',
  taxpayerName: 'Tên người nộp thuế',
  taxpayerSSN: 'Số an sinh xã hội',
  filingStatusCheckbox: 'Ô tình trạng khai thuế',
  age65OrOlder: 'Từ 65 tuổi trở lên',
  spouseAge65OrOlder: 'Vợ/chồng từ 65 tuổi',
  permanentlyDisabled: 'Khuyết tật vĩnh viễn',
  spousePermanentlyDisabled: 'Vợ/chồng khuyết tật',
  disabilityStatementAttached: 'Có giấy xác nhận khuyết tật',
  initialAmount: 'Số tiền ban đầu (Line 10)',
  taxableSocialSecurity: 'An sinh xã hội chịu thuế (Line 11)',
  nonTaxablePensions: 'Lương hưu miễn thuế (Line 12)',
  taxExemptInterest: 'Lãi miễn thuế (Line 13)',
  totalLine11to13: 'Tổng Lines 11-13 (Line 14)',
  adjustedAmount: 'Số tiền điều chỉnh (Line 15)',
  agiFromForm1040: 'AGI từ Form 1040 (Line 16)',
  agiThreshold: 'Ngưỡng AGI (Line 17)',
  excessAGI: 'AGI vượt ngưỡng (Line 18)',
  netAmount: 'Số ròng (Line 19)',
  creditAmount: 'Số tiền tín dụng (Line 20)',
}
