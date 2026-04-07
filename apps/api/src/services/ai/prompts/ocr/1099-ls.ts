/**
 * 1099-LS OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-LS (Reportable Life Insurance Sale)
 * Reports the sale of a life insurance policy to a third party.
 */

/**
 * 1099-LS extracted data structure
 * Matches IRS Form 1099-LS box layout
 */
export interface Form1099LSExtractedData {
  // Acquirer Information (buyer/investor)
  acquirerName: string | null
  acquirerAddress: string | null
  acquirerTIN: string | null

  // Seller Information (original policy owner)
  sellerName: string | null
  sellerAddress: string | null
  sellerTIN: string | null // SSN or EIN
  accountNumber: string | null

  // Sale Details (Boxes 1-4)
  grossProceeds: number | null // Box 1 - Gross proceeds from life insurance sale (CRITICAL)
  dateOfSale: string | null // Box 2 - Date of sale (MM/DD/YYYY)
  issuerName: string | null // Box 3 - Name of insurance company that issued the policy
  policyNumber: string | null // Box 4 - Policy number

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate 1099-LS OCR extraction prompt
 */
export function get1099LSExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-LS (Reportable Life Insurance Sale).

IMPORTANT: This form reports the sale of a life insurance policy to a third-party acquirer. Accuracy is critical for tax reporting purposes.

Extract the following fields:

ACQUIRER INFORMATION (buyer/investor who purchased the policy):
- acquirerName: Name of the acquiring entity or individual
- acquirerAddress: Acquirer's address
- acquirerTIN: Acquirer's EIN or SSN

SELLER INFORMATION (original policy owner who sold):
- sellerName: Seller's name
- sellerAddress: Seller's address
- sellerTIN: Seller's SSN or EIN (XXX-XX-XXXX or XX-XXXXXXX)
- accountNumber: Account or reference number

SALE DETAILS:
- grossProceeds: Box 1 - Gross proceeds paid to seller for the life insurance policy
  (CRITICAL - total amount received from the sale)
- dateOfSale: Box 2 - Date the sale was completed (MM/DD/YYYY format)
- issuerName: Box 3 - Name of the insurance company that originally issued the policy
- policyNumber: Box 4 - Life insurance policy number

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "acquirerName": "Life Settlement Investors LLC",
  "acquirerAddress": "500 Finance Ave, City, ST 12345",
  "acquirerTIN": "XX-XXXXXXX",
  "sellerName": "JOHN DOE",
  "sellerAddress": "123 Main St, City, ST 12345",
  "sellerTIN": "XXX-XX-XXXX",
  "accountNumber": "LS-987654321",
  "grossProceeds": 250000.00,
  "dateOfSale": "03/15/2024",
  "issuerName": "XYZ Life Insurance Company",
  "policyNumber": "POL-000123456",
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 1 (grossProceeds) is the total amount paid to the seller — most critical field
2. Box 2 (dateOfSale) must be in MM/DD/YYYY format; convert if shown differently
3. Box 3 (issuerName) is the original insurance company, not the acquirer
4. Box 4 (policyNumber) identifies the specific policy sold
5. All monetary values as numbers without $ or commas
6. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-LS extracted data
 */
export function validate1099LSData(data: unknown): data is Form1099LSExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['acquirerName', 'sellerTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for 1099-LS
 */
export const FORM_1099_LS_FIELD_LABELS_VI: Record<string, string> = {
  acquirerName: 'Tên Bên mua Hợp đồng',
  acquirerAddress: 'Địa chỉ Bên mua',
  acquirerTIN: 'EIN Bên mua',
  sellerName: 'Tên Người bán',
  sellerAddress: 'Địa chỉ Người bán',
  sellerTIN: 'SSN/EIN Người bán',
  accountNumber: 'Số tài khoản',
  grossProceeds: 'Tổng tiền thu được (Box 1)',
  dateOfSale: 'Ngày bán (Box 2)',
  issuerName: 'Tên Công ty Bảo hiểm phát hành (Box 3)',
  policyNumber: 'Số hợp đồng bảo hiểm (Box 4)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
