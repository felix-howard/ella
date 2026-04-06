/**
 * Form 5329 OCR Extraction Prompt
 * Additional Taxes on Qualified Plans and Other Tax-Favored Accounts
 */

export interface Form5329ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null
  taxpayerDOB: string | null

  // Part I: Early Distributions (10% penalty)
  earlyDistributions: number | null          // Line 1
  exceptionCode: string | null               // Line 2
  earlyDistributionTax: number | null        // Line 4 (CRITICAL)

  // Part II: Roth IRA Early Distributions
  rothEarlyDistributions: number | null
  rothPenaltyTax: number | null

  // Part III: Excess Contributions to Traditional IRAs
  excessContributions: number | null         // Line 16
  excessContributionTax: number | null       // Line 23 (6% penalty)

  // Part IV: Excess Contributions to Roth IRAs
  rothExcessContributions: number | null
  rothExcessTax: number | null

  // Part V: HSA Excess Contributions
  hsaExcessContributions: number | null
  hsaExcessTax: number | null

  // Part VII: Required Minimum Distribution (RMD)
  rmdRequired: number | null
  rmdActual: number | null
  rmdShortfall: number | null                // Line 54
  rmdPenalty: number | null                  // Line 55 (25%/10% penalty)

  totalAdditionalTax: number | null          // → Schedule 2

  taxYear: number | null
}

export function getForm5329ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 5329 (Additional Taxes on Qualified Plans and Other Tax-Favored Accounts).

IMPORTANT: Calculates penalty taxes on early withdrawals, excess contributions, and missed RMDs.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX), taxpayerDOB (YYYY-MM-DD)

PART I - EARLY DISTRIBUTIONS (10% penalty):
- earlyDistributions: Line 1
- exceptionCode: Line 2 (e.g., 01=separation from service, 02=disability)
- earlyDistributionTax: Line 4 (10% penalty on taxable amount)

PART II - ROTH IRA EARLY DISTRIBUTIONS:
- rothEarlyDistributions, rothPenaltyTax

PART III - EXCESS TRADITIONAL IRA CONTRIBUTIONS:
- excessContributions: Line 16
- excessContributionTax: Line 23 (6% penalty)

PART IV - EXCESS ROTH IRA CONTRIBUTIONS:
- rothExcessContributions, rothExcessTax

PART V - HSA EXCESS CONTRIBUTIONS:
- hsaExcessContributions, hsaExcessTax

PART VII - MISSED RMD:
- rmdRequired, rmdActual
- rmdShortfall: Line 54
- rmdPenalty: Line 55 (25% penalty, reduced to 10% if corrected timely)

TOTAL:
- totalAdditionalTax (CRITICAL → Schedule 2)

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "taxpayerDOB": "1970-05-15",
  "earlyDistributions": 15000.00,
  "exceptionCode": null,
  "earlyDistributionTax": 1500.00,
  "rothEarlyDistributions": null,
  "rothPenaltyTax": null,
  "excessContributions": null,
  "excessContributionTax": null,
  "rothExcessContributions": null,
  "rothExcessTax": null,
  "hsaExcessContributions": null,
  "hsaExcessTax": null,
  "rmdRequired": null,
  "rmdActual": null,
  "rmdShortfall": null,
  "rmdPenalty": null,
  "totalAdditionalTax": 1500.00,
  "taxYear": 2024
}

Rules:
1. totalAdditionalTax is most important (flows to Schedule 2)
2. Early distribution penalty is 10% unless exception applies
3. Excess contribution penalty is 6% annually until corrected
4. RMD penalty is 25% (10% if corrected within 2 years)
5. All monetary values as numbers without $ or commas
6. Use null for empty fields, NEVER guess`
}

export function validateForm5329Data(data: unknown): data is Form5329ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (d.totalAdditionalTax !== null && d.totalAdditionalTax !== undefined && typeof d.totalAdditionalTax !== 'number') return false
  return true
}

export const FORM_5329_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  taxpayerDOB: 'Ngày sinh',
  earlyDistributions: 'Rút sớm (Dòng 1)',
  exceptionCode: 'Mã ngoại lệ (Dòng 2)',
  earlyDistributionTax: 'Thuế rút sớm (Dòng 4)',
  rothEarlyDistributions: 'Rút sớm Roth IRA',
  rothPenaltyTax: 'Thuế phạt Roth IRA',
  excessContributions: 'Đóng góp dư (Dòng 16)',
  excessContributionTax: 'Thuế đóng góp dư (Dòng 23)',
  rothExcessContributions: 'Đóng góp dư Roth IRA',
  rothExcessTax: 'Thuế đóng góp dư Roth',
  hsaExcessContributions: 'Đóng góp dư HSA',
  hsaExcessTax: 'Thuế đóng góp dư HSA',
  rmdRequired: 'RMD bắt buộc',
  rmdActual: 'RMD thực tế',
  rmdShortfall: 'Thiếu RMD (Dòng 54)',
  rmdPenalty: 'Phạt RMD (Dòng 55)',
  totalAdditionalTax: 'Tổng thuế bổ sung',
  taxYear: 'Năm thuế',
}
