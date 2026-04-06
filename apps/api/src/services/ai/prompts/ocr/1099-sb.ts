/**
 * 1099-SB OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-SB (Seller's Investment in Life Insurance Contract)
 * Reports seller's investment when a life insurance contract is transferred
 */

/**
 * 1099-SB extracted data structure
 * Matches IRS Form 1099-SB box layout
 */
export interface Form1099SBExtractedData {
  // Issuer Information (Insurance company)
  issuerName: string | null
  issuerAddress: string | null
  issuerTIN: string | null

  // Seller Information
  sellerName: string | null
  sellerAddress: string | null
  sellerTIN: string | null // SSN or EIN
  accountNumber: string | null

  // Contract Information (Boxes 1-2)
  cashSurrenderValue: number | null // Box 1 - Cash surrender value (CRITICAL)
  investmentInContract: number | null // Box 2 - Investment in contract
  policyNumber: string | null

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate 1099-SB OCR extraction prompt
 */
export function get1099SBExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-SB (Seller's Investment in Life Insurance Contract).

IMPORTANT: This form reports the seller's investment when a life insurance contract is sold or transferred. Box 1 cash surrender value is critical.

Extract the following fields:

ISSUER INFORMATION (Insurance company):
- issuerName: Insurance company name
- issuerAddress: Insurance company address
- issuerTIN: Insurance company's EIN

SELLER INFORMATION:
- sellerName: Seller's name
- sellerAddress: Seller's address
- sellerTIN: Seller's SSN or EIN (XXX-XX-XXXX or XX-XXXXXXX)
- accountNumber: Policy or account number

CONTRACT INFORMATION:
- cashSurrenderValue: Box 1 - Cash surrender value of the contract
  (CRITICAL - used to determine gain or loss on sale)
- investmentInContract: Box 2 - Seller's investment in the contract
- policyNumber: Life insurance policy number

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "issuerName": "ABC Life Insurance Company",
  "issuerAddress": "500 Insurance Blvd, City, ST 12345",
  "issuerTIN": "XX-XXXXXXX",
  "sellerName": "JOHN DOE",
  "sellerAddress": "123 Main St, City, ST 12345",
  "sellerTIN": "XXX-XX-XXXX",
  "accountNumber": "POL-123456789",
  "cashSurrenderValue": 50000.00,
  "investmentInContract": 30000.00,
  "policyNumber": "LI-987654",
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 1 (cash surrender value) is the most critical field for tax computation
2. Box 2 (investment) represents the seller's basis in the contract
3. The difference between sale proceeds and investment may be taxable
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-SB extracted data
 */
export function validate1099SBData(data: unknown): data is Form1099SBExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['issuerName', 'sellerTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for 1099-SB
 */
export const FORM_1099_SB_FIELD_LABELS_VI: Record<string, string> = {
  issuerName: 'Tên Công ty Bảo hiểm',
  issuerAddress: 'Địa chỉ Công ty Bảo hiểm',
  issuerTIN: 'EIN Công ty Bảo hiểm',
  sellerName: 'Tên Người bán',
  sellerAddress: 'Địa chỉ Người bán',
  sellerTIN: 'SSN/EIN Người bán',
  accountNumber: 'Số tài khoản/hợp đồng',
  cashSurrenderValue: 'Giá trị hoàn trả tiền mặt (Box 1)',
  investmentInContract: 'Đầu tư vào hợp đồng (Box 2)',
  policyNumber: 'Số hợp đồng bảo hiểm',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
