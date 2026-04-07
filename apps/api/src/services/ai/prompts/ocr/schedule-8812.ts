/**
 * Schedule 8812 (Form 1040) OCR Extraction Prompt
 * Extracts structured data from Schedule 8812 - Credits for Qualifying Children
 * Child Tax Credit (CTC) and Additional Child Tax Credit (ACTC)
 */

export interface Schedule8812ExtractedData {
  taxYear: number | null
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: Child Tax Credit / Credit for Other Dependents
  numberOfQualifyingChildren: number | null // Line 4a
  numberOfOtherDependents: number | null // Line 4b
  childTaxCreditAmount: number | null // Line 5a (children x $2,000)
  otherDependentCreditAmount: number | null // Line 5b (dependents x $500)
  modifiedAGI: number | null // Line 8
  creditLimitWorksheet: number | null // Line 12
  childTaxCredit: number | null // Line 14 (CRITICAL) -> 1040 line 19

  // Part II-A: Additional Child Tax Credit
  additionalChildTaxCredit: number | null // Line 27 (CRITICAL) -> 1040 line 28

  // Key calculation fields
  earnedIncome: number | null // Line 18a
  nonTaxCombatPay: number | null // Line 18b
  taxableEarnedIncome: number | null // Line 19
}

export function getSchedule8812ExtractionPrompt(): string {
  return `You are an OCR system. Extract data from IRS Schedule 8812 (Form 1040) - Credits for Qualifying Children and Other Dependents.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in the document
- If a field is blank or not visible, return null (never invent data)
- Monetary amounts: return as numbers without $ or commas (e.g., 2000.00)
- Count fields: return as integers (e.g., 2)

TAXPAYER INFO (top):
- Name as shown on Form 1040
- Social security number

PART I - CHILD TAX CREDIT AND CREDIT FOR OTHER DEPENDENTS:
- Line 4a: Number of qualifying children under age 17 with SSN
- Line 4b: Number of other dependents
- Line 5a: Child tax credit amount (qualifying children x $2,000)
- Line 5b: Other dependent credit amount (other dependents x $500)
- Line 8: Modified adjusted gross income
- Line 12: Credit limit from worksheet
- Line 14: Child tax credit -> goes to Form 1040 line 19 (CRITICAL)

PART II-A - ADDITIONAL CHILD TAX CREDIT (refundable):
- Line 18a: Earned income
- Line 18b: Nontaxable combat pay
- Line 19: Taxable earned income
- Line 27: Additional child tax credit -> goes to Form 1040 line 28 (CRITICAL)

OUTPUT FORMAT (JSON):
{
  "taxYear": 2023,
  "taxpayerName": "John Doe",
  "taxpayerSSN": "XXX-XX-XXXX",
  "numberOfQualifyingChildren": 2,
  "numberOfOtherDependents": null,
  "childTaxCreditAmount": 4000.00,
  "otherDependentCreditAmount": null,
  "modifiedAGI": 85000.00,
  "creditLimitWorksheet": 4000.00,
  "childTaxCredit": 4000.00,
  "additionalChildTaxCredit": null,
  "earnedIncome": 85000.00,
  "nonTaxCombatPay": null,
  "taxableEarnedIncome": 85000.00
}

IMPORTANT:
- Return null for any field not found or blank
- Line 14 (childTaxCredit) -> Form 1040 line 19
- Line 27 (additionalChildTaxCredit) -> Form 1040 line 28
- Each qualifying child = $2,000 credit (2023); other dependents = $500`
}

export function validateSchedule8812Data(data: unknown): data is Schedule8812ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const hasCTC = d.childTaxCredit !== null && d.childTaxCredit !== undefined && typeof d.childTaxCredit === 'number'
  const hasACTC = d.additionalChildTaxCredit !== null && d.additionalChildTaxCredit !== undefined && typeof d.additionalChildTaxCredit === 'number'
  const hasChildren = d.numberOfQualifyingChildren !== null && d.numberOfQualifyingChildren !== undefined && typeof d.numberOfQualifyingChildren === 'number'
  return hasCTC || hasACTC || hasChildren
}

export const SCHEDULE_8812_FIELD_LABELS_VI: Record<string, string> = {
  taxYear: 'Năm thuế',
  taxpayerName: 'Tên người nộp thuế',
  taxpayerSSN: 'Số an sinh xã hội',
  numberOfQualifyingChildren: 'Số trẻ đủ điều kiện (Line 4a)',
  numberOfOtherDependents: 'Số người phụ thuộc khác (Line 4b)',
  childTaxCreditAmount: 'Số tiền tín dụng trẻ em',
  otherDependentCreditAmount: 'Tín dụng người phụ thuộc khác',
  modifiedAGI: 'AGI điều chỉnh (Line 8)',
  creditLimitWorksheet: 'Giới hạn tín dụng (Line 12)',
  childTaxCredit: 'Tín dụng thuế trẻ em (Line 14)',
  additionalChildTaxCredit: 'Tín dụng trẻ em bổ sung (Line 27)',
  earnedIncome: 'Thu nhập kiếm được (Line 18a)',
  nonTaxCombatPay: 'Lương chiến đấu miễn thuế (Line 18b)',
  taxableEarnedIncome: 'Thu nhập chịu thuế (Line 19)',
}
