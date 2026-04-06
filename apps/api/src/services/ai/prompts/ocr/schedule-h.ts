/**
 * Schedule H (Form 1040) OCR Extraction Prompt
 * Extracts structured data from Schedule H - Household Employment Taxes
 * Total household employment taxes -> Schedule 2 Line 9
 */

export interface ScheduleHExtractedData {
  taxYear: number | null
  taxpayerName: string | null
  taxpayerSSN: string | null
  ein: string | null

  // Part I: Social Security, Medicare, and FUTA Taxes
  cashWagesPaid: number | null // Line 1
  socialSecurityTax: number | null // Line 2
  medicareTax: number | null // Line 3
  additionalMedicareTax: number | null // Line 4
  federalIncomeTaxWithheld: number | null // Line 5
  totalSSMedicareTax: number | null // Line 6
  advanceEIC: number | null // Line 7

  // Part II: FUTA Tax
  futaWages: number | null // Line 10
  futaTax: number | null // Line 15

  // Part III: Total
  totalHouseholdTax: number | null // Line 25 (CRITICAL) -> Schedule 2 Line 9
  estimatedTaxPayments: number | null // Line 23
  amountOwed: number | null // Line 27
}

export function getScheduleHExtractionPrompt(): string {
  return `You are an OCR system. Extract data from IRS Schedule H (Form 1040) - Household Employment Taxes.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in the document
- If a field is blank or not visible, return null (never invent data)
- Monetary amounts: return as numbers without $ or commas (e.g., 2500.00)

TAXPAYER INFO (top):
- Name as shown on Form 1040
- Social security number
- Employer identification number (EIN)

PART I - SOCIAL SECURITY, MEDICARE, AND FUTA TAXES:
- Line 1: Total cash wages paid to household employees
- Line 2: Social security tax (employer + employee shares)
- Line 3: Medicare tax (employer + employee shares)
- Line 4: Additional Medicare tax withholding
- Line 5: Federal income tax withheld
- Line 6: Total social security, Medicare, and withheld taxes
- Line 7: Advance earned income credit payments

PART II - FEDERAL UNEMPLOYMENT (FUTA) TAX:
- Line 10: Total FUTA wages
- Line 15: FUTA tax

PART III - TOTAL HOUSEHOLD EMPLOYMENT TAXES:
- Line 23: Estimated tax payments and amount applied from prior return
- Line 25: Total household employment taxes - CRITICAL -> Schedule 2 Line 9
- Line 27: Amount you owe

OUTPUT FORMAT (JSON):
{
  "taxYear": 2023,
  "taxpayerName": "John Doe",
  "taxpayerSSN": "XXX-XX-XXXX",
  "ein": "XX-XXXXXXX",
  "cashWagesPaid": 24000.00,
  "socialSecurityTax": 2976.00,
  "medicareTax": 696.00,
  "additionalMedicareTax": null,
  "federalIncomeTaxWithheld": 1200.00,
  "totalSSMedicareTax": 4872.00,
  "advanceEIC": null,
  "futaWages": 7000.00,
  "futaTax": 42.00,
  "totalHouseholdTax": 4914.00,
  "estimatedTaxPayments": null,
  "amountOwed": 4914.00
}

IMPORTANT:
- Return null for any field not found or blank
- Line 25 (totalHouseholdTax) -> Schedule 2 Line 9
- EIN may be masked — return as-is`
}

export function validateScheduleHData(data: unknown): data is ScheduleHExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const hasTotal = d.totalHouseholdTax !== null && d.totalHouseholdTax !== undefined && typeof d.totalHouseholdTax === 'number'
  const hasWages = d.cashWagesPaid !== null && d.cashWagesPaid !== undefined && typeof d.cashWagesPaid === 'number'
  return hasTotal || hasWages
}

export const SCHEDULE_H_FIELD_LABELS_VI: Record<string, string> = {
  taxYear: 'Năm thuế',
  taxpayerName: 'Tên người nộp thuế',
  taxpayerSSN: 'Số an sinh xã hội',
  ein: 'Mã số thuế (EIN)',
  cashWagesPaid: 'Tiền lương đã trả (Line 1)',
  socialSecurityTax: 'Thuế an sinh xã hội (Line 2)',
  medicareTax: 'Thuế Medicare (Line 3)',
  additionalMedicareTax: 'Thuế Medicare bổ sung (Line 4)',
  federalIncomeTaxWithheld: 'Thuế liên bang khấu trừ (Line 5)',
  totalSSMedicareTax: 'Tổng thuế SS/Medicare (Line 6)',
  advanceEIC: 'EIC tạm ứng (Line 7)',
  futaWages: 'Lương FUTA (Line 10)',
  futaTax: 'Thuế FUTA (Line 15)',
  totalHouseholdTax: 'Tổng thuế lao động gia đình (Line 25)',
  estimatedTaxPayments: 'Thuế ước tính đã nộp (Line 23)',
  amountOwed: 'Số tiền còn nợ (Line 27)',
}
