/**
 * RRB-1099-R OCR Extraction Prompt
 * Extracts structured data from Form RRB-1099-R (Annuities or Pensions by the Railroad Retirement Board)
 * Reports non-Social Security Equivalent Benefit payments (Tier 1, Tier 2, vested dual benefits)
 */

/**
 * RRB-1099-R extracted data structure
 * Matches Form RRB-1099-R box layout
 */
export interface RRB1099RExtractedData {
  // Payer Information
  payerName: string | null // Railroad Retirement Board

  // Recipient Information
  recipientName: string | null
  recipientAddress: string | null
  recipientTIN: string | null // SSN
  claimNumber: string | null

  // Distribution Information
  grossDistribution: number | null // Box 4 - Gross distribution (CRITICAL)
  employeeContributions: number | null // Box 5 - Employee contributions/designated Roth contributions
  taxableAmount: number | null // Box 7 - Taxable amount (CRITICAL)
  federalIncomeTaxWithheld: number | null // Box 9 - Federal income tax withheld
  totalDistribution: boolean // Box 3 - Total distribution indicator
  capitalGain: number | null // Box 6a - Capital gain included in Box 7

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate RRB-1099-R OCR extraction prompt
 */
export function getRRB1099RExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from Form RRB-1099-R (Annuities or Pensions by the Railroad Retirement Board).

IMPORTANT: This form reports railroad retirement pension/annuity payments (non-SSEB portion). Boxes 4 and 7 are critical for tax reporting.

Extract the following fields:

PAYER INFORMATION:
- payerName: Always "Railroad Retirement Board" or "U.S. Railroad Retirement Board"

RECIPIENT INFORMATION:
- recipientName: Annuitant's name
- recipientAddress: Annuitant's address
- recipientTIN: Annuitant's SSN (XXX-XX-XXXX)
- claimNumber: RRB claim/case number

DISTRIBUTION INFORMATION:
- grossDistribution: Box 4 - Gross distribution amount
  (CRITICAL - total amount of annuity/pension paid)
- employeeContributions: Box 5 - Employee contributions or designated Roth contributions basis
- taxableAmount: Box 7 - Taxable amount of distribution
  (CRITICAL - amount subject to income tax)
- federalIncomeTaxWithheld: Box 9 - Federal income tax withheld
- totalDistribution: Box 3 - Checked if this is a total distribution
- capitalGain: Box 6a - Capital gain included in taxable amount (Box 7)

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "payerName": "U.S. Railroad Retirement Board",
  "recipientName": "JOHN DOE",
  "recipientAddress": "321 Pension Rd, City, ST 12345",
  "recipientTIN": "XXX-XX-XXXX",
  "claimNumber": "RRB-987654321",
  "grossDistribution": 24000.00,
  "employeeContributions": 5000.00,
  "taxableAmount": 20000.00,
  "federalIncomeTaxWithheld": 2400.00,
  "totalDistribution": false,
  "capitalGain": null,
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 4 (gross distribution) and Box 7 (taxable amount) are the most critical fields
2. Box 5 (employee contributions) reduces the taxable amount over the recovery period
3. Box 9 withholding reduces total tax owed
4. Box 3 total distribution may trigger special tax treatment
5. All monetary values as numbers without $ or commas
6. Use null for empty fields, NEVER guess`
}

/**
 * Validate RRB-1099-R extracted data
 */
export function validateRRB1099RData(data: unknown): data is RRB1099RExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['recipientTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false
  if (typeof d.totalDistribution !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for RRB-1099-R
 */
export const RRB_1099_R_FIELD_LABELS_VI: Record<string, string> = {
  payerName: 'Tên Cơ quan Hưu trí Đường sắt',
  recipientName: 'Tên Người thụ hưởng',
  recipientAddress: 'Địa chỉ Người thụ hưởng',
  recipientTIN: 'SSN Người thụ hưởng',
  claimNumber: 'Số hồ sơ RRB',
  grossDistribution: 'Tổng phân phối (Box 4)',
  employeeContributions: 'Đóng góp của nhân viên (Box 5)',
  taxableAmount: 'Số tiền chịu thuế (Box 7)',
  federalIncomeTaxWithheld: 'Thuế Liên bang đã khấu trừ (Box 9)',
  totalDistribution: 'Phân phối toàn bộ (Box 3)',
  capitalGain: 'Lãi vốn (Box 6a)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
