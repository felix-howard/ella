/**
 * 1099-Q OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-Q (Payments From Qualified Education Programs)
 * Reports distributions from 529 plans and Coverdell ESAs.
 */

/**
 * 1099-Q extracted data structure
 * Matches IRS Form 1099-Q box layout
 */
export interface Form1099QExtractedData {
  // Trustee/Program Information
  payerName: string | null
  payerAddress: string | null
  payerTIN: string | null

  // Recipient Information
  recipientName: string | null
  recipientAddress: string | null
  recipientTIN: string | null // SSN
  accountNumber: string | null

  // Distribution Amounts (Boxes 1-3)
  grossDistribution: number | null // Box 1 - Gross distribution (CRITICAL)
  earnings: number | null // Box 2 - Earnings
  basis: number | null // Box 3 - Basis

  // Program Flags (Boxes 4-5)
  trusteeTransfer: boolean // Box 4 - Trustee-to-trustee transfer
  distributionType: '529' | 'COVERDELL' | null // Box 5 - Program type

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate 1099-Q OCR extraction prompt
 */
export function get1099QExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-Q (Payments From Qualified Education Programs).

IMPORTANT: This form reports distributions from qualified tuition programs (529 plans) and Coverdell ESAs. Accuracy is critical.

Extract the following fields:

TRUSTEE/PROGRAM INFORMATION:
- payerName: Trustee or program name (e.g., "State 529 Plan Trustee")
- payerAddress: Trustee address
- payerTIN: Trustee's EIN

RECIPIENT INFORMATION:
- recipientName: Beneficiary or account holder name
- recipientAddress: Recipient's address
- recipientTIN: Recipient's SSN (XXX-XX-XXXX)
- accountNumber: Account number

DISTRIBUTION AMOUNTS:
- grossDistribution: Box 1 - Gross distribution amount
  (CRITICAL - total amount distributed from the program)
- earnings: Box 2 - Earnings (taxable portion if not used for qualified expenses)
- basis: Box 3 - Basis (return of contribution, not taxable)

PROGRAM FLAGS:
- trusteeTransfer: Box 4 - Checked if this is a trustee-to-trustee transfer (not taxable)
- distributionType: Box 5 - "529" if qualified tuition program, "COVERDELL" if Coverdell ESA

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "payerName": "State 529 Plan Trustee",
  "payerAddress": "200 Education Blvd, City, ST 12345",
  "payerTIN": "XX-XXXXXXX",
  "recipientName": "JANE DOE",
  "recipientAddress": "456 Oak Ave, City, ST 12345",
  "recipientTIN": "XXX-XX-XXXX",
  "accountNumber": "529-987654321",
  "grossDistribution": 12000.00,
  "earnings": 3500.00,
  "basis": 8500.00,
  "trusteeTransfer": false,
  "distributionType": "529",
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 1 (gross distribution) is the total amount paid out — always extract if present
2. Earnings (Box 2) are taxable if not used for qualified education expenses
3. Basis (Box 3) is the contribution portion — never taxable
4. If Box 4 is checked, the transfer is non-taxable regardless of amounts
5. Box 5 distinguishes 529 plans from Coverdell ESAs — extract as "529" or "COVERDELL"
6. All monetary values as numbers without $ or commas
7. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-Q extracted data
 */
export function validate1099QData(data: unknown): data is Form1099QExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['payerName', 'recipientTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false
  if (typeof d.trusteeTransfer !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for 1099-Q
 */
export const FORM_1099_Q_FIELD_LABELS_VI: Record<string, string> = {
  payerName: 'Tên Người ủy thác/Chương trình',
  payerAddress: 'Địa chỉ Người ủy thác',
  payerTIN: 'EIN Người ủy thác',
  recipientName: 'Tên Người nhận',
  recipientAddress: 'Địa chỉ Người nhận',
  recipientTIN: 'SSN Người nhận',
  accountNumber: 'Số tài khoản',
  grossDistribution: 'Tổng phân phối (Box 1)',
  earnings: 'Thu nhập (Box 2)',
  basis: 'Cơ sở tính thuế (Box 3)',
  trusteeTransfer: 'Chuyển khoản giữa người ủy thác (Box 4)',
  distributionType: 'Loại chương trình (Box 5)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
