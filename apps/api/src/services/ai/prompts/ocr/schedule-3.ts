/**
 * Schedule 3 (Form 1040) OCR Extraction Prompt
 * Extracts structured data from Schedule 3 - Additional Credits and Payments
 * Part I total -> 1040 line 20, Part II total -> 1040 line 31
 */

export interface Schedule3ExtractedData {
  taxYear: number | null
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: Nonrefundable Credits
  foreignTaxCredit: number | null // Line 1
  childDependentCareCredit: number | null // Line 2
  educationCredits: number | null // Line 3
  retirementSavingsCredit: number | null // Line 4
  residentialEnergyCredits: number | null // Line 5
  otherNonrefundableCredits: number | null // Lines 6-7
  totalNonrefundableCredits: number | null // Line 8 -> 1040 line 20

  // Part II: Other Payments and Refundable Credits
  netPremiumTaxCredit: number | null // Line 9
  amountPaidWithExtension: number | null // Line 10
  excessSocialSecurityWithheld: number | null // Line 11
  creditForFederalFuelTax: number | null // Line 12
  otherPayments: number | null // Lines 13-14
  totalOtherPayments: number | null // Line 15 -> 1040 line 31
}

export function getSchedule3ExtractionPrompt(): string {
  return `You are an OCR system. Extract data from IRS Schedule 3 (Form 1040) - Additional Credits and Payments.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in the document
- If a field is blank or not visible, return null (never invent data)
- Monetary amounts: return as numbers without $ or commas (e.g., 1250.00)

TAXPAYER INFO (top):
- Name as shown on Form 1040
- Social security number

PART I - NONREFUNDABLE CREDITS:
- Line 1: Foreign tax credit (Form 1116)
- Line 2: Credit for child and dependent care expenses (Form 2441)
- Line 3: Education credits (Form 8863)
- Line 4: Retirement savings contributions credit (Form 8880)
- Line 5: Residential energy credits (Form 5695)
- Lines 6-7: Other nonrefundable credits
- Line 8: Total nonrefundable credits -> goes to Form 1040 line 20

PART II - OTHER PAYMENTS AND REFUNDABLE CREDITS:
- Line 9: Net premium tax credit (Form 8962)
- Line 10: Amount paid with request for extension to file
- Line 11: Excess social security tax withheld
- Line 12: Credit for federal tax on fuels (Form 4136)
- Lines 13-14: Other payments or refundable credits
- Line 15: Total other payments and refundable credits -> goes to Form 1040 line 31

OUTPUT FORMAT (JSON):
{
  "taxYear": 2023,
  "taxpayerName": "John Doe",
  "taxpayerSSN": "XXX-XX-XXXX",
  "foreignTaxCredit": 500.00,
  "childDependentCareCredit": 2000.00,
  "educationCredits": null,
  "retirementSavingsCredit": null,
  "residentialEnergyCredits": 1500.00,
  "otherNonrefundableCredits": null,
  "totalNonrefundableCredits": 4000.00,
  "netPremiumTaxCredit": null,
  "amountPaidWithExtension": null,
  "excessSocialSecurityWithheld": null,
  "creditForFederalFuelTax": null,
  "otherPayments": null,
  "totalOtherPayments": null
}

IMPORTANT:
- Return null for any field not found or blank
- Line 8 (totalNonrefundableCredits) -> Form 1040 line 20
- Line 15 (totalOtherPayments) -> Form 1040 line 31`
}

export function validateSchedule3Data(data: unknown): data is Schedule3ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const hasCredits = d.totalNonrefundableCredits !== null && d.totalNonrefundableCredits !== undefined && typeof d.totalNonrefundableCredits === 'number'
  const hasPayments = d.totalOtherPayments !== null && d.totalOtherPayments !== undefined && typeof d.totalOtherPayments === 'number'
  return hasCredits || hasPayments
}

export const SCHEDULE_3_FIELD_LABELS_VI: Record<string, string> = {
  taxYear: 'Năm thuế',
  taxpayerName: 'Tên người nộp thuế',
  taxpayerSSN: 'Số an sinh xã hội',
  foreignTaxCredit: 'Tín dụng thuế nước ngoài (Line 1)',
  childDependentCareCredit: 'Tín dụng chăm sóc trẻ (Line 2)',
  educationCredits: 'Tín dụng giáo dục (Line 3)',
  retirementSavingsCredit: 'Tín dụng tiết kiệm hưu trí (Line 4)',
  residentialEnergyCredits: 'Tín dụng năng lượng nhà ở (Line 5)',
  otherNonrefundableCredits: 'Tín dụng không hoàn lại khác (Lines 6-7)',
  totalNonrefundableCredits: 'Tổng tín dụng không hoàn lại (Line 8)',
  netPremiumTaxCredit: 'Tín dụng thuế bảo hiểm ròng (Line 9)',
  amountPaidWithExtension: 'Số tiền nộp khi gia hạn (Line 10)',
  excessSocialSecurityWithheld: 'SS khấu trừ thừa (Line 11)',
  creditForFederalFuelTax: 'Tín dụng thuế nhiên liệu (Line 12)',
  otherPayments: 'Thanh toán khác (Lines 13-14)',
  totalOtherPayments: 'Tổng thanh toán khác (Line 15)',
}
