/**
 * 1099-NEC OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-NEC (Nonemployee Compensation)
 */

/**
 * 1099-NEC extracted data structure
 * Matches IRS Form 1099-NEC box layout
 */
export interface Form1099NecExtractedData {
  // Payer Information
  payerName: string | null
  payerAddress: string | null
  payerTIN: string | null // Payer's TIN (EIN or SSN)
  payerPhone: string | null

  // Recipient Information
  recipientName: string | null
  recipientAddress: string | null
  recipientTIN: string | null // Recipient's TIN (SSN or EIN)
  accountNumber: string | null // Account number (if shown)

  // Compensation and Taxes (Boxes 1-7)
  nonemployeeCompensation: number | null // Box 1 - Nonemployee compensation
  payerMadeDirectSales: boolean // Box 2 - Checkbox (if checked, $5,000+ direct sales)
  federalIncomeTaxWithheld: number | null // Box 4 - Federal income tax withheld

  // State Tax Information (Boxes 5-7)
  stateTaxInfo: Array<{
    state: string | null // Box 5 - State
    statePayerStateNo: string | null // Box 6 - State/Payer's state no.
    stateIncome: number | null // Box 7 - State income
  }>

  // Metadata
  taxYear: number | null
  corrected: boolean // Is this a corrected form?
}

/**
 * Generate 1099-NEC OCR extraction prompt
 */
export function get1099NecExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-NEC (Nonemployee Compensation). Extract all data from this 1099-NEC form image accurately.

IMPORTANT: This is a tax document. Accuracy is critical. If a value is unclear or not present, use null rather than guessing.

Extract the following fields:

PAYER INFORMATION (Left side, top):
- payerName: Payer's name (the company/person who paid)
- payerAddress: Payer's complete address
- payerTIN: Payer's TIN (EIN format: XX-XXXXXXX or SSN format: XXX-XX-XXXX)
- payerPhone: Payer's telephone number (if shown)

RECIPIENT INFORMATION (Left side, middle):
- recipientName: Recipient's name (the person who received income)
- recipientAddress: Recipient's complete address
- recipientTIN: Recipient's TIN (SSN format: XXX-XX-XXXX)
- accountNumber: Account number (if shown)

COMPENSATION AND TAXES (Right side boxes):
- nonemployeeCompensation: Box 1 - Nonemployee compensation (this is the main amount - freelance/contract income)
- payerMadeDirectSales: Box 2 - true if checkbox is marked (indicates $5,000+ in direct sales)
- federalIncomeTaxWithheld: Box 4 - Federal income tax withheld

STATE TAX INFORMATION (Bottom section, may have multiple states):
- stateTaxInfo: Array of { state, statePayerStateNo, stateIncome }
  - state: Box 5 - State abbreviation
  - statePayerStateNo: Box 6 - State/Payer's state ID number
  - stateIncome: Box 7 - State income amount

METADATA:
- taxYear: The tax year shown on the form
- corrected: true if "CORRECTED" checkbox is marked

Respond in JSON format:
{
  "payerName": "ABC Consulting LLC",
  "payerAddress": "123 Business St, City, ST 12345",
  "payerTIN": "XX-XXXXXXX",
  "payerPhone": "555-123-4567",
  "recipientName": "John Contractor",
  "recipientAddress": "456 Home Ave, City, ST 67890",
  "recipientTIN": "XXX-XX-XXXX",
  "accountNumber": null,
  "nonemployeeCompensation": 45000.00,
  "payerMadeDirectSales": false,
  "federalIncomeTaxWithheld": null,
  "stateTaxInfo": [
    {
      "state": "CA",
      "statePayerStateNo": "XXX-XXXX-X",
      "stateIncome": 45000.00
    }
  ],
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. All monetary values should be numbers without $ or commas
2. Use null for empty or unclear fields, NEVER guess
3. SSN should include dashes: XXX-XX-XXXX
4. EIN should include dash: XX-XXXXXXX
5. Box 1 (nonemployeeCompensation) is the most important field - this is the contractor/freelance income
6. Box 2 is a checkbox, return true/false based on whether it's checked
7. Most forms will only have Box 1 filled, other boxes are often empty`
}

/**
 * Validate 1099-NEC extracted data
 */
export function validate1099NecData(data: unknown): data is Form1099NecExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists (values can be null)
  const requiredFields = ['payerName', 'recipientName', 'recipientTIN', 'nonemployeeCompensation']

  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate arrays
  if (!Array.isArray(d.stateTaxInfo)) return false

  // Validate boolean field exists
  if (typeof d.payerMadeDirectSales !== 'boolean') return false

  return true
}

/**
 * Get field labels in Vietnamese for 1099-NEC
 */
export const FORM_1099_NEC_FIELD_LABELS_VI: Record<string, string> = {
  payerName: 'Tên Người trả',
  payerAddress: 'Địa chỉ Người trả',
  payerTIN: 'TIN Người trả',
  payerPhone: 'Số điện thoại',
  recipientName: 'Tên Người nhận',
  recipientAddress: 'Địa chỉ Người nhận',
  recipientTIN: 'SSN Người nhận',
  accountNumber: 'Số tài khoản',
  nonemployeeCompensation: 'Thu nhập tự do/Hợp đồng (Box 1)',
  payerMadeDirectSales: 'Bán hàng trực tiếp > $5,000 (Box 2)',
  federalIncomeTaxWithheld: 'Thuế Liên bang đã khấu trừ (Box 4)',
  state: 'Tiểu bang (Box 5)',
  statePayerStateNo: 'ID Tiểu bang (Box 6)',
  stateIncome: 'Thu nhập Tiểu bang (Box 7)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
