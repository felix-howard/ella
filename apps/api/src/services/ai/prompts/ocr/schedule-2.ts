/**
 * Schedule 2 (Form 1040) OCR Extraction Prompt
 * Extracts structured data from Schedule 2 - Additional Taxes
 * Part I total -> 1040 line 17, Part II total -> 1040 line 23
 */

export interface Schedule2ExtractedData {
  taxYear: number | null
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: Tax
  excessAdvancePTC: number | null // Line 1
  recaptureTotal: number | null // Line 1z
  alternativeMinimumTax: number | null // Line 2 (Form 6251)
  partITotal: number | null // Line 3 -> 1040 line 17

  // Part II: Other Taxes
  selfEmploymentTax: number | null // Line 4
  unreportedSSTax: number | null // Line 5
  additionalTaxOnIRA: number | null // Line 6 (Form 5329)
  netInvestmentIncomeTax: number | null // Line 7 (Form 8960)
  uncollectedSSTax: number | null // Line 8
  householdEmploymentTax: number | null // Line 9
  repaymentFirstTimeHomebuyer: number | null // Line 10
  additionalMedicareTax: number | null // Line 11 (Form 8959)
  section965Tax: number | null // Line 12
  otherTaxes: number | null // Lines 13-16
  partIITotal: number | null // Line 17 -> 1040 line 23

  totalAdditionalTax: number | null // Line 18
}

export function getSchedule2ExtractionPrompt(): string {
  return `You are an OCR system. Extract data from IRS Schedule 2 (Form 1040) - Additional Taxes.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in the document
- If a field is blank or not visible, return null (never invent data)
- Monetary amounts: return as numbers without $ or commas (e.g., 1250.00)

TAXPAYER INFO (top):
- Name as shown on Form 1040
- Social security number

PART I - TAX:
- Line 1: Excess advance premium tax credit repayment (Form 8962)
- Line 1z: Total of recapture amounts
- Line 2: Alternative minimum tax (Form 6251) - CRITICAL
- Line 3: Add lines 1z and 2 -> goes to Form 1040 line 17

PART II - OTHER TAXES:
- Line 4: Self-employment tax (Schedule SE)
- Line 5: Unreported social security and Medicare tax
- Line 6: Additional tax on IRAs or other tax-favored accounts (Form 5329)
- Line 7: Net investment income tax (Form 8960)
- Line 8: Uncollected SS and Medicare or RRTA tax on tips/group-term life
- Line 9: Household employment taxes (Schedule H)
- Line 10: Repayment of first-time homebuyer credit (Form 5405)
- Line 11: Additional Medicare Tax (Form 8959)
- Line 12: Section 965 net tax liability installment
- Lines 13-16: Other taxes
- Line 17: Total additional taxes -> goes to Form 1040 line 23

TOTAL:
- Line 18: Total (Part I Line 3 + Part II Line 17)

OUTPUT FORMAT (JSON):
{
  "taxYear": 2023,
  "taxpayerName": "John Doe",
  "taxpayerSSN": "XXX-XX-XXXX",
  "excessAdvancePTC": null,
  "recaptureTotal": null,
  "alternativeMinimumTax": 2500.00,
  "partITotal": 2500.00,
  "selfEmploymentTax": 3500.00,
  "unreportedSSTax": null,
  "additionalTaxOnIRA": null,
  "netInvestmentIncomeTax": 1200.00,
  "uncollectedSSTax": null,
  "householdEmploymentTax": null,
  "repaymentFirstTimeHomebuyer": null,
  "additionalTaxOnIRA": null,
  "section965Tax": null,
  "otherTaxes": null,
  "partIITotal": 4700.00,
  "totalAdditionalTax": 7200.00
}

IMPORTANT:
- Return null for any field not found or blank
- Line 3 (partITotal) -> Form 1040 line 17
- Line 17 (partIITotal) -> Form 1040 line 23
- Line 18 is the sum of Line 3 + Line 17`
}

export function validateSchedule2Data(data: unknown): data is Schedule2ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const hasPartI = d.partITotal !== null && d.partITotal !== undefined && typeof d.partITotal === 'number'
  const hasPartII = d.partIITotal !== null && d.partIITotal !== undefined && typeof d.partIITotal === 'number'
  const hasTotal = d.totalAdditionalTax !== null && d.totalAdditionalTax !== undefined && typeof d.totalAdditionalTax === 'number'
  return hasPartI || hasPartII || hasTotal
}

export const SCHEDULE_2_FIELD_LABELS_VI: Record<string, string> = {
  taxYear: 'Năm thuế',
  taxpayerName: 'Tên người nộp thuế',
  taxpayerSSN: 'Số an sinh xã hội',
  excessAdvancePTC: 'Hoàn trả tín dụng bảo hiểm (Line 1)',
  recaptureTotal: 'Tổng thu hồi (Line 1z)',
  alternativeMinimumTax: 'Thuế tối thiểu thay thế (Line 2)',
  partITotal: 'Tổng Phần I (Line 3)',
  selfEmploymentTax: 'Thuế tự kinh doanh (Line 4)',
  unreportedSSTax: 'Thuế SS chưa khai (Line 5)',
  additionalTaxOnIRA: 'Thuế bổ sung IRA (Line 6)',
  netInvestmentIncomeTax: 'Thuế thu nhập đầu tư ròng (Line 7)',
  uncollectedSSTax: 'Thuế SS chưa thu (Line 8)',
  householdEmploymentTax: 'Thuế lao động gia đình (Line 9)',
  repaymentFirstTimeHomebuyer: 'Hoàn trả tín dụng mua nhà (Line 10)',
  additionalMedicareTax: 'Thuế Medicare bổ sung (Line 11)',
  section965Tax: 'Thuế Section 965 (Line 12)',
  otherTaxes: 'Thuế khác (Lines 13-16)',
  partIITotal: 'Tổng Phần II (Line 17)',
  totalAdditionalTax: 'Tổng thuế bổ sung (Line 18)',
}
