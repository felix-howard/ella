/**
 * RRB-1099 OCR Extraction Prompt
 * Extracts structured data from Form RRB-1099 (Payments by the Railroad Retirement Board)
 * Reports Social Security Equivalent Benefits paid by the Railroad Retirement Board
 */

/**
 * RRB-1099 extracted data structure
 * Matches Form RRB-1099 box layout
 */
export interface RRB1099ExtractedData {
  // Payer Information
  payerName: string | null // Railroad Retirement Board

  // Recipient Information
  recipientName: string | null
  recipientAddress: string | null
  recipientTIN: string | null // SSN
  claimNumber: string | null

  // Benefit Information
  ssBenefitEquivalent: number | null // Box 3 - Social Security Equivalent Benefit (CRITICAL)
  medicarePremiumDeducted: number | null // Box 4 - Medicare premium deducted
  netSsBenefits: number | null // Box 5 - Net Social Security Equivalent Benefit (CRITICAL)
  workerCompOffset: number | null // Box 6 - Workers' compensation offset
  federalIncomeTaxWithheld: number | null // Box 9 - Federal income tax withheld
  repayments: number | null // Box 10 - Repayments

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate RRB-1099 OCR extraction prompt
 */
export function getRRB1099ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from Form RRB-1099 (Payments by the Railroad Retirement Board).

IMPORTANT: This form reports Social Security Equivalent Benefits (SSEB) paid by the RRB. Boxes 3 and 5 are critical for tax reporting.

Extract the following fields:

PAYER INFORMATION:
- payerName: Always "Railroad Retirement Board" or "U.S. Railroad Retirement Board"

RECIPIENT INFORMATION:
- recipientName: Beneficiary's name
- recipientAddress: Beneficiary's address
- recipientTIN: Beneficiary's SSN (XXX-XX-XXXX)
- claimNumber: RRB claim/case number

BENEFIT INFORMATION:
- ssBenefitEquivalent: Box 3 - Gross Social Security Equivalent Benefit paid
  (CRITICAL - used to determine taxable portion of SSEB)
- medicarePremiumDeducted: Box 4 - Medicare premium deducted from benefits
- netSsBenefits: Box 5 - Net Social Security Equivalent Benefit
  (CRITICAL - gross SSEB minus Medicare premium)
- workerCompOffset: Box 6 - Workers' compensation offset amount
- federalIncomeTaxWithheld: Box 9 - Federal income tax withheld
- repayments: Box 10 - Amount repaid to RRB

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "payerName": "U.S. Railroad Retirement Board",
  "recipientName": "JANE DOE",
  "recipientAddress": "789 Railroad Ave, City, ST 12345",
  "recipientTIN": "XXX-XX-XXXX",
  "claimNumber": "RRB-123456789",
  "ssBenefitEquivalent": 12000.00,
  "medicarePremiumDeducted": 1700.00,
  "netSsBenefits": 10300.00,
  "workerCompOffset": null,
  "federalIncomeTaxWithheld": 1200.00,
  "repayments": null,
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 3 (SSEB gross) and Box 5 (net SSEB) are the most critical fields
2. Up to 85% of SSEB may be taxable depending on combined income
3. Box 9 withholding reduces total tax owed
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

/**
 * Validate RRB-1099 extracted data
 */
export function validateRRB1099Data(data: unknown): data is RRB1099ExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['recipientTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for RRB-1099
 */
export const RRB_1099_FIELD_LABELS_VI: Record<string, string> = {
  payerName: 'Tên Cơ quan Hưu trí Đường sắt',
  recipientName: 'Tên Người thụ hưởng',
  recipientAddress: 'Địa chỉ Người thụ hưởng',
  recipientTIN: 'SSN Người thụ hưởng',
  claimNumber: 'Số hồ sơ RRB',
  ssBenefitEquivalent: 'Trợ cấp tương đương ASXH gộp (Box 3)',
  medicarePremiumDeducted: 'Phí Medicare đã khấu trừ (Box 4)',
  netSsBenefits: 'Trợ cấp tương đương ASXH ròng (Box 5)',
  workerCompOffset: 'Bù đắp bồi thường lao động (Box 6)',
  federalIncomeTaxWithheld: 'Thuế Liên bang đã khấu trừ (Box 9)',
  repayments: 'Hoàn trả (Box 10)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
