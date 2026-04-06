/**
 * 1099-SA OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-SA (Distributions From an HSA,
 * Archer MSA, or Medicare Advantage MSA)
 * Reports distributions from health savings accounts.
 */

/**
 * 1099-SA extracted data structure
 * Matches IRS Form 1099-SA box layout
 */
export interface Form1099SAExtractedData {
  // Trustee/Payer Information
  trusteeName: string | null
  trusteeAddress: string | null
  trusteeTIN: string | null

  // Recipient Information
  recipientName: string | null
  recipientAddress: string | null
  recipientTIN: string | null // SSN
  accountNumber: string | null

  // Distribution Details
  distributionAmount: number | null // Box 1 - Gross distribution (CRITICAL)
  earningsOnExcess: number | null // Box 2 - Earnings on excess contributions
  distributionCode: string | null // Box 3 - Distribution code (CRITICAL)
  fmvOnDeath: number | null // Box 4 - FMV of account on date of death
  accountType: 'HSA' | 'ARCHER_MSA' | 'MA_MSA' | null // Box 5 - Account type

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate 1099-SA OCR extraction prompt
 */
export function get1099SAExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-SA (Distributions From an HSA, Archer MSA, or Medicare Advantage MSA).

IMPORTANT: This form reports distributions from health savings accounts. Distribution codes determine taxability. Accuracy is critical.

Extract the following fields:

TRUSTEE/PAYER INFORMATION:
- trusteeName: Trustee or custodian name (e.g., "Fidelity HSA")
- trusteeAddress: Trustee's address
- trusteeTIN: Trustee's EIN

RECIPIENT INFORMATION:
- recipientName: Account holder's name
- recipientAddress: Account holder's address
- recipientTIN: Account holder's SSN (XXX-XX-XXXX)
- accountNumber: HSA or MSA account number

DISTRIBUTION DETAILS:
- distributionAmount: Box 1 - Gross distribution amount
  (CRITICAL - total amount distributed from the account)
- earningsOnExcess: Box 2 - Earnings on excess contributions
  (Taxable and subject to 6% excise tax)
- distributionCode: Box 3 - Distribution code
  (CRITICAL - 1=Normal distribution, 2=Excess contributions, 3=Disability,
  4=Death distribution to estate, 5=Prohibited transaction, 6=Death distribution to beneficiary)
- fmvOnDeath: Box 4 - Fair market value of the account on date of death
  (Only if account holder died)
- accountType: Box 5 - Type of account (HSA, ARCHER_MSA, or MA_MSA)
  (Use "HSA" for Health Savings Account, "ARCHER_MSA" for Archer MSA,
  "MA_MSA" for Medicare Advantage MSA)

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "trusteeName": "Fidelity HSA Trustee",
  "trusteeAddress": "100 Trust Way, Boston, MA 02101",
  "trusteeTIN": "XX-XXXXXXX",
  "recipientName": "JOHN DOE",
  "recipientAddress": "789 Oak Ave, City, ST 12345",
  "recipientTIN": "XXX-XX-XXXX",
  "accountNumber": "HSA-123456789",
  "distributionAmount": 3200.00,
  "earningsOnExcess": null,
  "distributionCode": "1",
  "fmvOnDeath": null,
  "accountType": "HSA",
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 1 (distribution amount) is the total gross distribution — extract precisely
2. Box 3 distribution code must be a single digit 1 through 6
3. Box 5 account type must be exactly "HSA", "ARCHER_MSA", or "MA_MSA"
4. Box 4 only applies when the account holder is deceased
5. Qualified medical distributions (code 1) are generally tax-free
6. All monetary values as numbers without $ or commas
7. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-SA extracted data
 */
export function validate1099SAData(data: unknown): data is Form1099SAExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['trusteeName', 'recipientTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for 1099-SA
 */
export const FORM_1099_SA_FIELD_LABELS_VI: Record<string, string> = {
  trusteeName: 'Tên Người được ủy thác',
  trusteeAddress: 'Địa chỉ Người được ủy thác',
  trusteeTIN: 'EIN Người được ủy thác',
  recipientName: 'Tên Người nhận',
  recipientAddress: 'Địa chỉ Người nhận',
  recipientTIN: 'SSN Người nhận',
  accountNumber: 'Số tài khoản',
  distributionAmount: 'Tổng số tiền phân phối (Box 1)',
  earningsOnExcess: 'Thu nhập từ đóng góp vượt mức (Box 2)',
  distributionCode: 'Mã phân phối (Box 3)',
  fmvOnDeath: 'Giá trị thị trường khi qua đời (Box 4)',
  accountType: 'Loại tài khoản (Box 5)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
