/**
 * 1099-A OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-A (Acquisition or Abandonment of Secured Property)
 * Reports when a lender acquires an interest in secured property or knows property has been abandoned.
 */

/**
 * 1099-A extracted data structure
 * Matches IRS Form 1099-A box layout
 */
export interface Form1099AExtractedData {
  // Lender Information
  lenderName: string | null
  lenderAddress: string | null
  lenderTIN: string | null

  // Borrower Information
  borrowerName: string | null
  borrowerAddress: string | null
  borrowerTIN: string | null // SSN
  accountNumber: string | null

  // Property Details (Boxes 1-6)
  acquisitionDate: string | null // Box 1 - Date of lender's acquisition or knowledge of abandonment
  balanceOwed: number | null // Box 2 - Balance of principal outstanding (CRITICAL)
  fmvProperty: number | null // Box 4 - Fair market value of property (CRITICAL)
  personallyLiable: boolean // Box 5 - Borrower was personally liable for repayment
  propertyDescription: string | null // Box 6 - Description of property

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate 1099-A OCR extraction prompt
 */
export function get1099AExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-A (Acquisition or Abandonment of Secured Property).

IMPORTANT: This form reports when a lender acquires secured property (foreclosure) or the borrower has abandoned it. Accuracy is critical for determining gain/loss on disposition.

Extract the following fields:

LENDER INFORMATION:
- lenderName: Lender's name (e.g., "First National Bank")
- lenderAddress: Lender's address
- lenderTIN: Lender's EIN

BORROWER INFORMATION:
- borrowerName: Borrower's name
- borrowerAddress: Borrower's address
- borrowerTIN: Borrower's SSN (XXX-XX-XXXX)
- accountNumber: Loan or account number

PROPERTY DETAILS:
- acquisitionDate: Box 1 - Date lender acquired the property or learned of abandonment (MM/DD/YYYY)
- balanceOwed: Box 2 - Balance of principal outstanding at time of acquisition/abandonment
  (CRITICAL - used to calculate gain or loss)
- fmvProperty: Box 4 - Fair market value of the property at acquisition
  (CRITICAL - used to calculate gain or loss; Box 3 is reserved for future use)
- personallyLiable: Box 5 - Checked if borrower was personally liable for repayment of the debt
- propertyDescription: Box 6 - Brief description of the property (address or type)

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "lenderName": "First National Bank",
  "lenderAddress": "100 Bank St, City, ST 12345",
  "lenderTIN": "XX-XXXXXXX",
  "borrowerName": "JOHN DOE",
  "borrowerAddress": "789 Elm Rd, City, ST 12345",
  "borrowerTIN": "XXX-XX-XXXX",
  "accountNumber": "LN-000123456",
  "acquisitionDate": "06/15/2024",
  "balanceOwed": 185000.00,
  "fmvProperty": 160000.00,
  "personallyLiable": true,
  "propertyDescription": "789 Elm Rd, City, ST 12345 - Single family residence",
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 2 (balance owed) and Box 4 (FMV) are the most critical fields — extract carefully
2. Difference between Box 2 and Box 4 may result in cancellation of debt income
3. Box 5 (personally liable) affects whether COD income is recognized — extract as boolean
4. Box 3 is reserved by IRS and should not appear; do not create a field for it
5. acquisitionDate should be in MM/DD/YYYY format if present
6. All monetary values as numbers without $ or commas
7. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-A extracted data
 */
export function validate1099AData(data: unknown): data is Form1099AExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['lenderName', 'borrowerTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false
  if (typeof d.personallyLiable !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for 1099-A
 */
export const FORM_1099_A_FIELD_LABELS_VI: Record<string, string> = {
  lenderName: 'Tên Người cho vay',
  lenderAddress: 'Địa chỉ Người cho vay',
  lenderTIN: 'EIN Người cho vay',
  borrowerName: 'Tên Người vay',
  borrowerAddress: 'Địa chỉ Người vay',
  borrowerTIN: 'SSN Người vay',
  accountNumber: 'Số tài khoản/Khoản vay',
  acquisitionDate: 'Ngày tiếp nhận tài sản (Box 1)',
  balanceOwed: 'Số dư gốc còn lại (Box 2)',
  fmvProperty: 'Giá trị thị trường hợp lý (Box 4)',
  personallyLiable: 'Chịu trách nhiệm cá nhân (Box 5)',
  propertyDescription: 'Mô tả tài sản (Box 6)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
