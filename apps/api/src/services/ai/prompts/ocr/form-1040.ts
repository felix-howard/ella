/**
 * Form 1040 OCR Extraction Prompt
 * Extracts structured data from U.S. Individual Income Tax Return (Form 1040 family)
 */

/**
 * Taxpayer address from Form 1040 header
 */
export interface TaxpayerAddress {
  street: string | null
  aptNo: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string | null // For 1040-NR
}

/**
 * Dependent information from Form 1040 dependents section
 */
export interface DependentInfo {
  firstName: string
  lastName: string
  ssn: string | null
  relationship: string | null
  childTaxCreditEligible: boolean
  creditForOtherDependents: boolean
}

export interface Form1040ExtractedData {
  taxYear: number | null
  formVariant: string | null
  filingStatus: string | null
  taxpayerName: string | null
  taxpayerSSN: string | null
  spouseName: string | null
  spouseSSN: string | null
  // New CPA fields (Phase 1)
  taxpayerAddress: TaxpayerAddress | null
  dependents: DependentInfo[]
  adjustmentsToIncome: number | null // Line 10
  digitalAssetsAnswer: boolean | null // Yes/No checkbox
  qualifyingSurvivingSpouseYear: number | null // Year spouse died (QSS only)
  // Income fields
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
- Boolean checkboxes: return true if checked, false if not checked, null if unclear

FORM LAYOUT - READ THESE FIELDS:

PAGE 1 HEADER:
- Tax year (printed at top of form, e.g., "2023")
- Form variant: look for "1040", "1040-SR", "1040-NR", or "1040-X" in title
- Filing status: check the box marked (Single / Married filing jointly / Married filing separately / Head of household / Qualifying surviving spouse)
- If "Qualifying surviving spouse" is checked, extract the year spouse died

TAXPAYER INFORMATION:
- Line: Your first name and last name (primary taxpayer)
- Line: Social security number (primary taxpayer SSN)
- Line: Spouse's first name and last name (if MFJ)
- Line: Spouse's social security number (if MFJ)

TAXPAYER ADDRESS (below name, above filing status):
- Street address (including house/apt number)
- Apartment number (if separate field)
- City
- State (2-letter abbreviation)
- ZIP code
- Foreign country name (for 1040-NR only)

DIGITAL ASSETS QUESTION:
- Near top of income section: "At any time during [year], did you receive, sell, send, exchange, or otherwise acquire any financial interest in any virtual currency?"
- Return true if "Yes" is checked, false if "No" is checked, null if unclear

DEPENDENTS SECTION (table below taxpayer info):
For EACH dependent listed, extract:
- First name and last name
- Social security number (mask as XXX-XX-XXXX)
- Relationship to taxpayer (e.g., "Son", "Daughter", "Parent")
- Column 4: Child tax credit checkbox (checked = true)
- Column 5: Credit for other dependents checkbox (checked = true)

INCOME SECTION:
- Line 1z: Total wages, salaries, tips
- Line 9: Total income (sum of all income sources)
- Line 10: Adjustments to income (critical for CPA - from Schedule 1)
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
- Look for pages titled "Schedule 1", "Schedule A", "Schedule B", "Schedule C", "Schedule D", "Schedule E", "Schedule SE"
- List each attached schedule (e.g., ["1", "C", "SE"])
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
  "taxpayerAddress": {
    "street": "123 MAIN ST",
    "aptNo": "APT 4B",
    "city": "HOUSTON",
    "state": "TX",
    "zip": "77001",
    "country": null
  },
  "dependents": [
    {
      "firstName": "NGUYEN",
      "lastName": "MINH",
      "ssn": "XXX-XX-9012",
      "relationship": "Son",
      "childTaxCreditEligible": true,
      "creditForOtherDependents": false
    }
  ],
  "digitalAssetsAnswer": false,
  "qualifyingSurvivingSpouseYear": null,
  "adjustmentsToIncome": 2500.00,
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
  "attachedSchedules": ["1", "C", "SE"]
}

IMPORTANT REMINDERS:
- Return null for any field not found or blank — never guess
- SSNs on tax returns are often masked (XXX-XX-XXXX) — return the masked version as-is
- For dependent SSNs: ALWAYS mask as "XXX-XX-XXXX" format — never return unmasked SSNs
- taxYear must be a 4-digit number (e.g., 2023), not null if visible in header
- attachedSchedules must be an array (empty [] if no schedules attached)
- dependents must be an array (empty [] if no dependents listed)
- taxpayerAddress: return object with null fields if address not found, or null if entire section missing
- Do NOT extract Schedule data itself — only detect which schedules are present`
}

export function validateForm1040Data(data: unknown): data is Form1040ExtractedData {
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

  // Validate dependents if present (must be array)
  if (d.dependents !== undefined && !Array.isArray(d.dependents)) return false

  // Validate taxpayerAddress if present (must be object or null)
  if (
    d.taxpayerAddress !== undefined &&
    d.taxpayerAddress !== null &&
    typeof d.taxpayerAddress !== 'object'
  ) {
    return false
  }

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
  // New CPA fields (Phase 2)
  taxpayerAddress: 'Địa chỉ người nộp thuế',
  dependents: 'Người phụ thuộc',
  adjustmentsToIncome: 'Điều chỉnh thu nhập (Line 10)',
  digitalAssetsAnswer: 'Tài sản kỹ thuật số',
  qualifyingSurvivingSpouseYear: 'Năm vợ/chồng mất (QSS)',
  // Income fields
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
