/**
 * Form 1040 OCR Extraction Prompt
 * Extracts structured data from U.S. Individual Income Tax Return (Form 1040 family)
 */

export interface Form1040ExtractedData {
  taxYear: number | null
  formVariant: string | null
  filingStatus: string | null
  taxpayerName: string | null
  taxpayerSSN: string | null
  spouseName: string | null
  spouseSSN: string | null
  totalWages: number | null
  totalIncome: number | null
  adjustedGrossIncome: number | null
  standardOrItemizedDeduction: number | null
  taxableIncome: number | null
  totalTax: number | null
  childTaxCredit: number | null
  earnedIncomeCredit: number | null
  totalWithheld: number | null
  totalPayments: number | null
  refundAmount: number | null
  amountOwed: number | null
  attachedSchedules: string[]
}

export function getForm1040ExtractionPrompt(): string {
  return `You are an OCR system. Your task is to READ and EXTRACT text from this IRS Form 1040 (or variant: 1040-SR, 1040-NR, 1040-X).

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in the document
- If a field is blank or not visible, return null (never invent data)
- Monetary amounts: return as numbers without $ or commas (e.g., 45000.00)
- SSN format: return as string "XXX-XX-XXXX"
- For 1040-X (amended return): extract the CORRECTED column C values

FORM LAYOUT - READ THESE FIELDS:

PAGE 1 HEADER:
- Tax year (printed at top of form, e.g., "2023")
- Form variant: look for "1040", "1040-SR", "1040-NR", or "1040-X" in title
- Filing status: check the box marked (Single / Married filing jointly / Married filing separately / Head of household / Qualifying surviving spouse)

TAXPAYER INFORMATION:
- Line: Your first name and last name (primary taxpayer)
- Line: Social security number (primary taxpayer SSN)
- Line: Spouse's first name and last name (if MFJ)
- Line: Spouse's social security number (if MFJ)

INCOME SECTION:
- Line 1z: Total wages, salaries, tips
- Line 9: Total income (sum of all income sources)
- Line 11: Adjusted gross income (AGI) — MOST IMPORTANT FIELD

DEDUCTIONS:
- Line 12: Standard deduction OR itemized deductions (from Schedule A)

TAXABLE INCOME & TAX:
- Line 15: Taxable income
- Line 24: Total tax

CREDITS:
- Line 19: Child tax credit or credit for other dependents
- Line 27: Earned income credit (EIC)

PAYMENTS:
- Line 25d: Total federal income tax withheld
- Line 33: Total payments

REFUND OR AMOUNT OWED:
- Line 35a: Amount of refund
- Line 37: Amount you owe

SCHEDULE DETECTION — scan all page headers for schedule titles:
- Look for pages titled "Schedule A", "Schedule B", "Schedule C", "Schedule D", "Schedule E", "Schedule SE"
- List the letter of each attached schedule (e.g., ["A", "C", "SE"])
- If no schedules found, return empty array []

OUTPUT FORMAT (JSON):
{
  "taxYear": 2023,
  "formVariant": "1040",
  "filingStatus": "Married filing jointly",
  "taxpayerName": "NGUYEN VAN ANH",
  "taxpayerSSN": "XXX-XX-1234",
  "spouseName": "TRAN THI HONG",
  "spouseSSN": "XXX-XX-5678",
  "totalWages": 85000.00,
  "totalIncome": 92000.00,
  "adjustedGrossIncome": 88000.00,
  "standardOrItemizedDeduction": 27700.00,
  "taxableIncome": 60300.00,
  "totalTax": 7200.00,
  "childTaxCredit": 2000.00,
  "earnedIncomeCredit": null,
  "totalWithheld": 8500.00,
  "totalPayments": 8500.00,
  "refundAmount": 1300.00,
  "amountOwed": null,
  "attachedSchedules": ["C", "SE"]
}

IMPORTANT REMINDERS:
- Return null for any field not found or blank — never guess
- SSNs on tax returns are often masked (XXX-XX-XXXX) — return the masked version as-is
- taxYear must be a 4-digit number (e.g., 2023), not null if visible in header
- attachedSchedules must be an array (empty [] if no schedules attached)
- Do NOT extract Schedule data itself — only detect which schedules are present`
}

export function validateForm1040Data(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  // Required: at least one of these key fields must be non-null
  const hasMinimumData =
    d.taxYear !== null ||
    d.adjustedGrossIncome !== null ||
    d.totalTax !== null ||
    d.refundAmount !== null

  if (!hasMinimumData) return false

  // attachedSchedules must be an array
  if (!Array.isArray(d.attachedSchedules)) return false

  return true
}

export const FORM_1040_FIELD_LABELS_VI: Record<string, string> = {
  taxYear: 'Năm thuế',
  formVariant: 'Loại mẫu',
  filingStatus: 'Tình trạng khai thuế',
  taxpayerName: 'Tên người nộp thuế',
  taxpayerSSN: 'SSN người nộp thuế',
  spouseName: 'Tên vợ/chồng',
  spouseSSN: 'SSN vợ/chồng',
  totalWages: 'Tổng lương (Line 1z)',
  totalIncome: 'Tổng thu nhập (Line 9)',
  adjustedGrossIncome: 'Thu nhập gộp điều chỉnh - AGI (Line 11)',
  standardOrItemizedDeduction: 'Khấu trừ (Line 12)',
  taxableIncome: 'Thu nhập chịu thuế (Line 15)',
  totalTax: 'Tổng thuế (Line 24)',
  childTaxCredit: 'Tín dụng con (Line 19)',
  earnedIncomeCredit: 'Tín dụng thu nhập lao động (Line 27)',
  totalWithheld: 'Tổng thuế đã khấu lưu (Line 25d)',
  totalPayments: 'Tổng thanh toán (Line 33)',
  refundAmount: 'Số tiền hoàn thuế (Line 35a)',
  amountOwed: 'Số tiền còn nợ (Line 37)',
  attachedSchedules: 'Phụ lục đính kèm',
}
