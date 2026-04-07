/**
 * 1099-QA OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-QA (Distributions from ABLE Accounts)
 * Reports distributions from Achieving a Better Life Experience (ABLE) accounts
 */

/**
 * 1099-QA extracted data structure
 * Matches IRS Form 1099-QA box layout
 */
export interface Form1099QAExtractedData {
  // Payer Information (Program trustee)
  payerName: string | null
  payerAddress: string | null
  payerTIN: string | null

  // Recipient Information
  recipientName: string | null
  recipientAddress: string | null
  recipientTIN: string | null // SSN
  accountNumber: string | null

  // Distribution Information (Boxes 1-4)
  grossDistribution: number | null // Box 1 - Gross distribution (CRITICAL)
  earnings: number | null // Box 2 - Earnings
  basis: number | null // Box 3 - Basis
  programToProgram: boolean // Box 4 - Program-to-program transfer

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate 1099-QA OCR extraction prompt
 */
export function get1099QAExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-QA (Distributions from ABLE Accounts).

IMPORTANT: This form reports distributions from ABLE accounts. Box 1 gross distribution is critical for tax reporting.

Extract the following fields:

PAYER INFORMATION (Program trustee):
- payerName: Trustee/program name (e.g., "State ABLE Program")
- payerAddress: Trustee address
- payerTIN: Trustee's EIN

RECIPIENT INFORMATION:
- recipientName: Account owner's name
- recipientAddress: Account owner's address
- recipientTIN: Account owner's SSN (XXX-XX-XXXX)
- accountNumber: ABLE account number

DISTRIBUTION INFORMATION:
- grossDistribution: Box 1 - Gross distribution amount
  (CRITICAL - total amount distributed from ABLE account)
- earnings: Box 2 - Earnings portion of distribution
- basis: Box 3 - Basis (contributions) portion of distribution
- programToProgram: Box 4 - Checked if this is a program-to-program transfer (not taxable)

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "payerName": "State ABLE Program",
  "payerAddress": "200 ABLE Ave, City, ST 12345",
  "payerTIN": "XX-XXXXXXX",
  "recipientName": "JANE DOE",
  "recipientAddress": "456 Oak St, City, ST 12345",
  "recipientTIN": "XXX-XX-XXXX",
  "accountNumber": "ABLE-987654321",
  "grossDistribution": 5000.00,
  "earnings": 500.00,
  "basis": 4500.00,
  "programToProgram": false,
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 1 (gross distribution) is the most critical field
2. Box 4 program-to-program transfers are generally not taxable
3. Earnings in Box 2 may be taxable if not used for qualified disability expenses
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-QA extracted data
 */
export function validate1099QAData(data: unknown): data is Form1099QAExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['payerName', 'recipientTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false
  if (typeof d.programToProgram !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for 1099-QA
 */
export const FORM_1099_QA_FIELD_LABELS_VI: Record<string, string> = {
  payerName: 'Tên Người ủy thác Chương trình',
  payerAddress: 'Địa chỉ Người ủy thác',
  payerTIN: 'EIN Người ủy thác',
  recipientName: 'Tên Chủ tài khoản',
  recipientAddress: 'Địa chỉ Chủ tài khoản',
  recipientTIN: 'SSN Chủ tài khoản',
  accountNumber: 'Số tài khoản ABLE',
  grossDistribution: 'Tổng phân phối (Box 1)',
  earnings: 'Thu nhập (Box 2)',
  basis: 'Cơ sở (Box 3)',
  programToProgram: 'Chuyển giữa chương trình (Box 4)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
