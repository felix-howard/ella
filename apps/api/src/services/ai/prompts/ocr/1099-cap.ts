/**
 * 1099-CAP OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-CAP (Changes in Corporate Control and Capital Structure)
 * Reports cash, stock, and other property received by shareholders in corporate restructuring events.
 */

/**
 * 1099-CAP extracted data structure
 * Matches IRS Form 1099-CAP box layout
 */
export interface Form1099CAPExtractedData {
  // Corporation Information (Payer)
  corporationName: string | null
  corporationAddress: string | null
  corporationTIN: string | null

  // Shareholder Information (Recipient)
  shareholderName: string | null
  shareholderAddress: string | null
  shareholderTIN: string | null // SSN or EIN
  accountNumber: string | null

  // Transaction Details (Boxes 1-4)
  dateOfChange: string | null // Box 1 - Date of change in control or capital structure
  cashReceived: number | null // Box 2 - Aggregate amount received (CRITICAL)
  fmvOtherProperty: number | null // Box 3 - Fair market value of other property received
  classesOfStockExchanged: string | null // Box 4 - Classes of stock exchanged

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate 1099-CAP OCR extraction prompt
 */
export function get1099CAPExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-CAP (Changes in Corporate Control and Capital Structure).

IMPORTANT: This form reports amounts received by shareholders during corporate control changes or capital restructuring. Accuracy is critical for capital gain/loss reporting.

Extract the following fields:

CORPORATION INFORMATION (Payer):
- corporationName: Corporation's name
- corporationAddress: Corporation's address
- corporationTIN: Corporation's EIN

SHAREHOLDER INFORMATION (Recipient):
- shareholderName: Shareholder's name
- shareholderAddress: Shareholder's address
- shareholderTIN: Shareholder's SSN or EIN (XXX-XX-XXXX or XX-XXXXXXX)
- accountNumber: Account number if present

TRANSACTION DETAILS:
- dateOfChange: Box 1 - Date of change in corporate control or capital structure (MM/DD/YYYY)
- cashReceived: Box 2 - Aggregate amount received (cash and FMV of stock/securities)
  (CRITICAL - total consideration shareholder received; used to compute gain or loss)
- fmvOtherProperty: Box 3 - Fair market value of other property received
- classesOfStockExchanged: Box 4 - Description of classes of stock exchanged

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "corporationName": "XYZ Corporation",
  "corporationAddress": "500 Corporate Blvd, City, ST 12345",
  "corporationTIN": "XX-XXXXXXX",
  "shareholderName": "JOHN DOE",
  "shareholderAddress": "123 Main St, City, ST 12345",
  "shareholderTIN": "XXX-XX-XXXX",
  "accountNumber": "CAP-987654",
  "dateOfChange": "06/15/2024",
  "cashReceived": 25000.00,
  "fmvOtherProperty": null,
  "classesOfStockExchanged": "Common Stock",
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 2 (cash received) is the primary amount — extract with highest accuracy
2. Box 1 date must be in MM/DD/YYYY format if visible; otherwise use the string as printed
3. Box 4 is descriptive text, not a monetary value
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-CAP extracted data
 */
export function validate1099CAPData(data: unknown): data is Form1099CAPExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['corporationName', 'shareholderTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for 1099-CAP
 */
export const FORM_1099_CAP_FIELD_LABELS_VI: Record<string, string> = {
  corporationName: 'Tên Công ty',
  corporationAddress: 'Địa chỉ Công ty',
  corporationTIN: 'EIN Công ty',
  shareholderName: 'Tên Cổ đông',
  shareholderAddress: 'Địa chỉ Cổ đông',
  shareholderTIN: 'SSN/EIN Cổ đông',
  accountNumber: 'Số tài khoản',
  dateOfChange: 'Ngày thay đổi (Box 1)',
  cashReceived: 'Tổng số tiền nhận được (Box 2)',
  fmvOtherProperty: 'Giá trị thị trường tài sản khác (Box 3)',
  classesOfStockExchanged: 'Loại cổ phiếu trao đổi (Box 4)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
