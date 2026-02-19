/**
 * Schedule 1 (Form 1040) OCR Extraction Prompt
 * Extracts structured data from Schedule 1 - Additional Income and Adjustments to Income
 * Part I: Additional Income -> Line 8 (Form 1040)
 * Part II: Adjustments to Income -> Line 10 (Form 1040)
 */

/**
 * Schedule 1 extracted data structure
 */
export interface Schedule1ExtractedData {
  taxYear: number | null

  // Part I - Additional Income
  taxableRefunds: number | null // Line 1
  alimonyReceived: number | null // Line 2a
  alimonyDivorceDate: string | null // Line 2b - Date of divorce/separation agreement
  businessIncome: number | null // Line 3 (from Schedule C)
  otherGains: number | null // Line 4 (from Form 4797)
  rentalRealEstateIncome: number | null // Line 5 (from Schedule E)
  farmIncome: number | null // Line 6 (from Schedule F)
  unemploymentCompensation: number | null // Line 7
  otherIncomeDescription: string | null // Line 8 description
  otherIncomeAmount: number | null // Line 8z
  totalAdditionalIncome: number | null // Line 10 -> Form 1040 Line 8

  // Part II - Adjustments to Income
  educatorExpenses: number | null // Line 11
  certainBusinessExpenses: number | null // Line 12
  healthSavingsAccount: number | null // Line 13
  movingExpenses: number | null // Line 14
  deductibleSelfEmploymentTax: number | null // Line 15
  selfEmployedSepSimple: number | null // Line 16
  selfEmployedHealthInsurance: number | null // Line 17
  penaltyEarlyWithdrawal: number | null // Line 18
  alimonyPaid: number | null // Line 19a
  iraDeduction: number | null // Line 20
  studentLoanInterest: number | null // Line 21
  otherAdjustmentsDescription: string | null // Line 24 description
  otherAdjustmentsAmount: number | null // Line 24z
  totalAdjustments: number | null // Line 26 -> Form 1040 Line 10
}

/**
 * Generate Schedule 1 OCR extraction prompt
 */
export function getSchedule1ExtractionPrompt(): string {
  return `You are an OCR system. Extract data from IRS Schedule 1 (Form 1040) - Additional Income and Adjustments to Income.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in the document
- If a field is blank or not visible, return null (never invent data)
- Monetary amounts: return as numbers without $ or commas (e.g., 5000.00)
- This schedule has two parts: Additional Income (Part I) and Adjustments (Part II)

PART I - ADDITIONAL INCOME (read carefully):
- Line 1: Taxable refunds, credits, or offsets of state/local income taxes
- Line 2a: Alimony received
- Line 2b: Date of divorce or separation agreement (format: MM/DD/YYYY or text)
- Line 3: Business income or (loss) from Schedule C
- Line 4: Other gains or (losses) from Form 4797
- Line 5: Rental real estate, royalties, partnerships (Schedule E)
- Line 6: Farm income or (loss) from Schedule F
- Line 7: Unemployment compensation
- Line 8: Other income (may have multiple lines 8a-8z, capture description and total)
- Line 10: Total Additional Income (MOST IMPORTANT - goes to Form 1040 Line 8)

PART II - ADJUSTMENTS TO INCOME:
- Line 11: Educator expenses
- Line 12: Certain business expenses of reservists, performing artists, etc.
- Line 13: Health savings account deduction
- Line 14: Moving expenses for members of Armed Forces
- Line 15: Deductible part of self-employment tax (IMPORTANT for self-employed)
- Line 16: Self-employed SEP, SIMPLE, and qualified plans
- Line 17: Self-employed health insurance deduction
- Line 18: Penalty on early withdrawal of savings
- Line 19a: Alimony paid
- Line 20: IRA deduction
- Line 21: Student loan interest deduction
- Line 24: Other adjustments (capture description and total)
- Line 26: Total Adjustments (MOST IMPORTANT - goes to Form 1040 Line 10)

OUTPUT FORMAT (JSON):
{
  "taxYear": 2023,
  "taxableRefunds": null,
  "alimonyReceived": null,
  "alimonyDivorceDate": null,
  "businessIncome": 45000.00,
  "otherGains": null,
  "rentalRealEstateIncome": 12000.00,
  "farmIncome": null,
  "unemploymentCompensation": null,
  "otherIncomeDescription": "Gambling winnings",
  "otherIncomeAmount": 500.00,
  "totalAdditionalIncome": 57500.00,
  "educatorExpenses": 300.00,
  "certainBusinessExpenses": null,
  "healthSavingsAccount": 3650.00,
  "movingExpenses": null,
  "deductibleSelfEmploymentTax": 3178.00,
  "selfEmployedSepSimple": 5000.00,
  "selfEmployedHealthInsurance": 8400.00,
  "penaltyEarlyWithdrawal": null,
  "alimonyPaid": null,
  "iraDeduction": null,
  "studentLoanInterest": 2500.00,
  "otherAdjustmentsDescription": null,
  "otherAdjustmentsAmount": null,
  "totalAdjustments": 23028.00
}

IMPORTANT REMINDERS:
- Return null for any field not found or blank — never guess
- Negative amounts indicate losses — use negative numbers
- Line 10 (totalAdditionalIncome) and Line 26 (totalAdjustments) are the most critical fields
- These totals flow directly to Form 1040 Lines 8 and 10`
}

/**
 * Validate Schedule 1 extracted data
 * Requires at least one financial total field (not just taxYear)
 */
export function validateSchedule1Data(data: unknown): data is Schedule1ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  // Must have at least one key financial field (not just taxYear)
  const hasTotalAdditionalIncome =
    d.totalAdditionalIncome !== null &&
    d.totalAdditionalIncome !== undefined &&
    typeof d.totalAdditionalIncome === 'number'

  const hasTotalAdjustments =
    d.totalAdjustments !== null &&
    d.totalAdjustments !== undefined &&
    typeof d.totalAdjustments === 'number'

  const hasBusinessIncome =
    d.businessIncome !== null &&
    d.businessIncome !== undefined &&
    typeof d.businessIncome === 'number'

  // At least one Part I or Part II total should be present
  return hasTotalAdditionalIncome || hasTotalAdjustments || hasBusinessIncome
}

/**
 * Vietnamese field labels for Schedule 1
 */
export const SCHEDULE_1_FIELD_LABELS_VI: Record<string, string> = {
  taxYear: 'Năm thuế',
  // Part I
  taxableRefunds: 'Hoàn thuế chịu thuế (Line 1)',
  alimonyReceived: 'Tiền cấp dưỡng nhận được (Line 2a)',
  alimonyDivorceDate: 'Ngày ly hôn/ly thân (Line 2b)',
  businessIncome: 'Thu nhập kinh doanh (Line 3)',
  otherGains: 'Lãi/lỗ khác (Line 4)',
  rentalRealEstateIncome: 'Thu nhập cho thuê BĐS (Line 5)',
  farmIncome: 'Thu nhập nông trại (Line 6)',
  unemploymentCompensation: 'Trợ cấp thất nghiệp (Line 7)',
  otherIncomeDescription: 'Mô tả thu nhập khác (Line 8)',
  otherIncomeAmount: 'Thu nhập khác (Line 8z)',
  totalAdditionalIncome: 'Tổng thu nhập bổ sung (Line 10)',
  // Part II
  educatorExpenses: 'Chi phí giáo viên (Line 11)',
  certainBusinessExpenses: 'Chi phí kinh doanh đặc biệt (Line 12)',
  healthSavingsAccount: 'Tài khoản tiết kiệm sức khỏe HSA (Line 13)',
  movingExpenses: 'Chi phí di chuyển (Line 14)',
  deductibleSelfEmploymentTax: 'Thuế tự làm chủ được khấu trừ (Line 15)',
  selfEmployedSepSimple: 'SEP/SIMPLE tự làm chủ (Line 16)',
  selfEmployedHealthInsurance: 'Bảo hiểm y tế tự làm chủ (Line 17)',
  penaltyEarlyWithdrawal: 'Phạt rút sớm (Line 18)',
  alimonyPaid: 'Tiền cấp dưỡng đã trả (Line 19a)',
  iraDeduction: 'Khấu trừ IRA (Line 20)',
  studentLoanInterest: 'Lãi vay sinh viên (Line 21)',
  otherAdjustmentsDescription: 'Mô tả điều chỉnh khác (Line 24)',
  otherAdjustmentsAmount: 'Điều chỉnh khác (Line 24z)',
  totalAdjustments: 'Tổng điều chỉnh (Line 26)',
}
