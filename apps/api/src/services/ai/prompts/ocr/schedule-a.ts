/**
 * Schedule A (Form 1040) OCR Extraction Prompt
 * Extracts structured data from Schedule A - Itemized Deductions
 * Total itemized deductions -> 1040 line 12
 */

export interface ScheduleAExtractedData {
  taxYear: number | null
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Medical and Dental Expenses
  medicalExpenses: number | null // Line 1
  medicalThreshold: number | null // Line 2 (7.5% AGI)
  medicalDeduction: number | null // Line 3

  // Taxes You Paid
  stateLocalIncomeTax: number | null // Line 5a
  stateLocalSalesTax: number | null // Line 5b
  realEstateTaxes: number | null // Line 5c
  personalPropertyTaxes: number | null // Line 5d
  otherTaxesPaid: number | null // Line 5e
  totalTaxesPaid: number | null // Line 7 (max $10,000 SALT)

  // Interest You Paid
  homeMortgageInterest: number | null // Line 8a
  homeMortgagePoints: number | null // Line 8b
  mortgageInterestNotReported: number | null // Line 8c
  mortgageInsurancePremiums: number | null // Line 8d
  investmentInterest: number | null // Line 9
  totalInterest: number | null // Line 10

  // Gifts to Charity
  charityCash: number | null // Line 11
  charityNonCash: number | null // Line 12
  charityCarryover: number | null // Line 13
  totalCharity: number | null // Line 14

  // Casualty and Theft Losses
  casualtyLosses: number | null // Line 15 (FEMA only)

  // Other Itemized Deductions
  otherDeductions: number | null // Line 16

  // Total
  totalItemizedDeductions: number | null // Line 17 (CRITICAL)
}

export function getScheduleAExtractionPrompt(): string {
  return `You are an OCR system. Extract data from IRS Schedule A (Form 1040) - Itemized Deductions.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in the document
- If a field is blank or not visible, return null (never invent data)
- Monetary amounts: return as numbers without $ or commas (e.g., 12500.00)

TAXPAYER INFO (top):
- Name as shown on Form 1040
- Social security number

MEDICAL AND DENTAL EXPENSES:
- Line 1: Medical and dental expenses
- Line 2: Amount from Form 1040 line 11 x 7.5%
- Line 3: Medical deduction (Line 1 minus Line 2, if positive)

TAXES YOU PAID:
- Line 5a: State and local income taxes (or general sales taxes if elected)
- Line 5b: State and local sales taxes (if checked instead of 5a)
- Line 5c: State and local real estate taxes
- Line 5d: State and local personal property taxes
- Line 5e: Other taxes
- Line 7: Total taxes paid (max $10,000 SALT cap - CRITICAL)

INTEREST YOU PAID:
- Line 8a: Home mortgage interest (reported on Form 1098)
- Line 8b: Home mortgage points (reported on Form 1098)
- Line 8c: Home mortgage interest not reported on Form 1098
- Line 8d: Mortgage insurance premiums
- Line 9: Investment interest (Form 4952)
- Line 10: Total interest paid

GIFTS TO CHARITY:
- Line 11: Gifts by cash or check
- Line 12: Other than cash or check
- Line 13: Carryover from prior year
- Line 14: Total gifts to charity

CASUALTY AND THEFT LOSSES:
- Line 15: Casualty and theft losses (FEMA-declared disasters only)

OTHER ITEMIZED DEDUCTIONS:
- Line 16: Other itemized deductions (list type if visible)

TOTAL:
- Line 17: Total itemized deductions - MOST IMPORTANT -> Form 1040 line 12

OUTPUT FORMAT (JSON):
{
  "taxYear": 2023,
  "taxpayerName": "John Doe",
  "taxpayerSSN": "XXX-XX-XXXX",
  "medicalExpenses": 15000.00,
  "medicalThreshold": 6000.00,
  "medicalDeduction": 9000.00,
  "stateLocalIncomeTax": 8000.00,
  "stateLocalSalesTax": null,
  "realEstateTaxes": 4500.00,
  "personalPropertyTaxes": null,
  "otherTaxesPaid": null,
  "totalTaxesPaid": 10000.00,
  "homeMortgageInterest": 12000.00,
  "homeMortgagePoints": null,
  "mortgageInterestNotReported": null,
  "mortgageInsurancePremiums": null,
  "investmentInterest": null,
  "totalInterest": 12000.00,
  "charityCash": 5000.00,
  "charityNonCash": 2000.00,
  "charityCarryover": null,
  "totalCharity": 7000.00,
  "casualtyLosses": null,
  "otherDeductions": null,
  "totalItemizedDeductions": 38000.00
}

IMPORTANT:
- Return null for any field not found or blank
- Line 17 (totalItemizedDeductions) is the MOST CRITICAL field -> Form 1040 line 12
- SALT cap: Line 7 cannot exceed $10,000 ($5,000 if married filing separately)`
}

export function validateScheduleAData(data: unknown): data is ScheduleAExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const hasTotal = d.totalItemizedDeductions !== null && d.totalItemizedDeductions !== undefined && typeof d.totalItemizedDeductions === 'number'
  const hasTaxes = d.totalTaxesPaid !== null && d.totalTaxesPaid !== undefined && typeof d.totalTaxesPaid === 'number'
  return hasTotal || hasTaxes
}

export const SCHEDULE_A_FIELD_LABELS_VI: Record<string, string> = {
  taxYear: 'Năm thuế',
  taxpayerName: 'Tên người nộp thuế',
  taxpayerSSN: 'Số an sinh xã hội',
  medicalExpenses: 'Chi phí y tế (Line 1)',
  medicalThreshold: 'Ngưỡng y tế 7.5% AGI (Line 2)',
  medicalDeduction: 'Khấu trừ y tế (Line 3)',
  stateLocalIncomeTax: 'Thuế thu nhập tiểu bang (Line 5a)',
  stateLocalSalesTax: 'Thuế bán hàng (Line 5b)',
  realEstateTaxes: 'Thuế bất động sản (Line 5c)',
  personalPropertyTaxes: 'Thuế tài sản cá nhân (Line 5d)',
  otherTaxesPaid: 'Thuế khác đã nộp (Line 5e)',
  totalTaxesPaid: 'Tổng thuế đã nộp (Line 7)',
  homeMortgageInterest: 'Lãi thế chấp nhà (Line 8a)',
  homeMortgagePoints: 'Điểm thế chấp (Line 8b)',
  mortgageInterestNotReported: 'Lãi thế chấp không báo cáo (Line 8c)',
  mortgageInsurancePremiums: 'Phí bảo hiểm thế chấp (Line 8d)',
  investmentInterest: 'Lãi đầu tư (Line 9)',
  totalInterest: 'Tổng lãi đã trả (Line 10)',
  charityCash: 'Từ thiện tiền mặt (Line 11)',
  charityNonCash: 'Từ thiện phi tiền mặt (Line 12)',
  charityCarryover: 'Từ thiện chuyển tiếp (Line 13)',
  totalCharity: 'Tổng từ thiện (Line 14)',
  casualtyLosses: 'Tổn thất thiên tai (Line 15)',
  otherDeductions: 'Khấu trừ khác (Line 16)',
  totalItemizedDeductions: 'Tổng khấu trừ chi tiết (Line 17)',
}
