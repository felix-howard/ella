/**
 * 1099-H OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-H (Health Coverage Tax Credit (HCTC) Advance Payments)
 * Reports advance payments of HCTC made on behalf of eligible recipients.
 */

/**
 * 1099-H extracted data structure
 * Matches IRS Form 1099-H box layout
 */
export interface Form1099HExtractedData {
  // Insurer Information
  insurerName: string | null
  insurerAddress: string | null
  insurerTIN: string | null

  // Recipient Information
  recipientName: string | null
  recipientAddress: string | null
  recipientTIN: string | null // SSN
  accountNumber: string | null

  // HCTC Payments (Boxes 1-2)
  hctcAdvancePayments: number | null // Box 1 - Total HCTC advance payments (CRITICAL)
  numberOfMonthsCovered: number | null // Box 2 - Number of months of HCTC coverage

  // Coverage Months (checkboxes)
  monthsCovered: string[] // Months with coverage (e.g., ["January", "February"])

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate 1099-H OCR extraction prompt
 */
export function get1099HExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-H (Health Coverage Tax Credit (HCTC) Advance Payments).

IMPORTANT: This form reports advance payments of the Health Coverage Tax Credit made to insurers on behalf of eligible recipients. Accuracy is critical.

Extract the following fields:

INSURER INFORMATION:
- insurerName: Insurance company name
- insurerAddress: Insurer's address
- insurerTIN: Insurer's EIN

RECIPIENT INFORMATION:
- recipientName: Taxpayer's name
- recipientAddress: Taxpayer's address
- recipientTIN: Taxpayer's SSN (XXX-XX-XXXX)
- accountNumber: Account or policy number

HCTC PAYMENTS:
- hctcAdvancePayments: Box 1 - Total HCTC advance payments made to insurer
  (CRITICAL - amount of advance credit paid on recipient's behalf)
- numberOfMonthsCovered: Box 2 - Number of months recipient had HCTC coverage

COVERAGE MONTHS (checkboxes):
- monthsCovered: Array of month names checked on form
  (e.g., ["January", "February", "March"])
  Possible values: January, February, March, April, May, June,
  July, August, September, October, November, December

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "insurerName": "ABC Health Insurance Co.",
  "insurerAddress": "200 Insurance Blvd, City, ST 12345",
  "insurerTIN": "XX-XXXXXXX",
  "recipientName": "JOHN DOE",
  "recipientAddress": "123 Main St, City, ST 12345",
  "recipientTIN": "XXX-XX-XXXX",
  "accountNumber": "POL-123456",
  "hctcAdvancePayments": 4800.00,
  "numberOfMonthsCovered": 4,
  "monthsCovered": ["January", "February", "March", "April"],
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 1 (hctcAdvancePayments) is the total advance HCTC paid to insurer — most critical field
2. Box 2 (numberOfMonthsCovered) should match the count of checked month boxes
3. monthsCovered must only include months actually checked on the form
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-H extracted data
 */
export function validate1099HData(data: unknown): data is Form1099HExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['insurerName', 'recipientTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate arrays
  if (!Array.isArray(d.monthsCovered)) return false

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for 1099-H
 */
export const FORM_1099_H_FIELD_LABELS_VI: Record<string, string> = {
  insurerName: 'Tên Công ty Bảo hiểm',
  insurerAddress: 'Địa chỉ Công ty Bảo hiểm',
  insurerTIN: 'EIN Công ty Bảo hiểm',
  recipientName: 'Tên Người nhận',
  recipientAddress: 'Địa chỉ Người nhận',
  recipientTIN: 'SSN Người nhận',
  accountNumber: 'Số tài khoản/Hợp đồng',
  hctcAdvancePayments: 'Thanh toán trước HCTC (Box 1)',
  numberOfMonthsCovered: 'Số tháng được bảo hiểm (Box 2)',
  monthsCovered: 'Các tháng được bảo hiểm',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
