/**
 * Form 8889 OCR Extraction Prompt
 * Health Savings Accounts (HSA)
 */

export interface Form8889ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Coverage Type
  coverageType: 'SELF_ONLY' | 'FAMILY' | null

  // Part I: HSA Contributions & Deduction
  hsaContributions: number | null            // Line 2 (your contributions)
  employerContributions: number | null       // Line 9 (employer/cafeteria plan)
  totalContributions: number | null          // Line 2 + Line 9
  contributionLimit: number | null           // Line 3
  hsaDeduction: number | null               // Line 13 (CRITICAL → Form 1040 Line 13)

  // Part II: HSA Distributions
  totalDistributions: number | null          // Line 14a
  rollovers: number | null                   // Line 14b
  qualifiedDistributions: number | null      // Line 14c (qualified medical expenses)
  taxableDistributions: number | null        // Line 15 (CRITICAL)
  excessDistributions: number | null         // Line 17b

  // Part III: Income Tax / Additional Tax
  excessContributionTax: number | null       // Line 19 (6% penalty)
  additionalTaxOnDistributions: number | null // Line 17a (20% penalty)

  taxYear: number | null
}

export function getForm8889ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8889 (Health Savings Accounts).

IMPORTANT: This form reports HSA contributions, distributions, and deductions. Very common tax form.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)
- coverageType: "SELF_ONLY" or "FAMILY" based on checkbox

PART I - HSA CONTRIBUTIONS & DEDUCTION:
- hsaContributions: Line 2 (your personal contributions)
- employerContributions: Line 9 (employer contributions/cafeteria plan)
- totalContributions: Total of Line 2 + Line 9
- contributionLimit: Line 3 (annual limit based on coverage type)
- hsaDeduction: Line 13 (CRITICAL - flows to Form 1040 Line 13)

PART II - HSA DISTRIBUTIONS:
- totalDistributions: Line 14a (total HSA distributions received)
- rollovers: Line 14b (trustee-to-trustee transfers)
- qualifiedDistributions: Line 14c (used for qualified medical expenses)
- taxableDistributions: Line 15 (CRITICAL - included in income)
- excessDistributions: Line 17b

PART III - TAXES:
- excessContributionTax: Line 19 (6% tax on excess contributions)
- additionalTaxOnDistributions: Line 17a (20% penalty on non-qualified)

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "coverageType": "FAMILY",
  "hsaContributions": 7300.00,
  "employerContributions": 1500.00,
  "totalContributions": 8800.00,
  "contributionLimit": 8300.00,
  "hsaDeduction": 7300.00,
  "totalDistributions": 3000.00,
  "rollovers": null,
  "qualifiedDistributions": 3000.00,
  "taxableDistributions": 0,
  "excessDistributions": null,
  "excessContributionTax": null,
  "additionalTaxOnDistributions": null,
  "taxYear": 2024
}

Rules:
1. HSA deduction (Line 13) is above-the-line deduction
2. 2024 limits: $4,150 self-only, $8,300 family (+$1,000 catch-up if 55+)
3. Non-qualified distributions subject to 20% penalty
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

export function validateForm8889Data(data: unknown): data is Form8889ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (d.hsaDeduction !== null && d.hsaDeduction !== undefined && typeof d.hsaDeduction !== 'number') return false
  if (d.taxableDistributions !== null && d.taxableDistributions !== undefined && typeof d.taxableDistributions !== 'number') return false
  return true
}

export const FORM_8889_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  coverageType: 'Loại bảo hiểm',
  hsaContributions: 'Đóng góp HSA (Dòng 2)',
  employerContributions: 'Đóng góp chủ lao động (Dòng 9)',
  totalContributions: 'Tổng đóng góp',
  contributionLimit: 'Giới hạn đóng góp (Dòng 3)',
  hsaDeduction: 'Khấu trừ HSA (Dòng 13)',
  totalDistributions: 'Tổng phân phối (Dòng 14a)',
  rollovers: 'Chuyển tiếp (Dòng 14b)',
  qualifiedDistributions: 'Phân phối đủ điều kiện (Dòng 14c)',
  taxableDistributions: 'Phân phối chịu thuế (Dòng 15)',
  excessDistributions: 'Phân phối vượt mức (Dòng 17b)',
  excessContributionTax: 'Thuế đóng góp vượt (Dòng 19)',
  additionalTaxOnDistributions: 'Thuế phạt phân phối (Dòng 17a)',
  taxYear: 'Năm thuế',
}
