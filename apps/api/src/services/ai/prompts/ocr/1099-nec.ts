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
  return `You are an OCR system. Your task is to READ and EXTRACT text from this IRS Form 1099-NEC image.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in this specific document image
- DO NOT invent, guess, or generate any data
- DO NOT use example or placeholder values
- If a field is blank, empty, or unreadable, use null
- READ the actual text from the image carefully

FORM LAYOUT - Extract these fields by reading the actual document:

PAYER SECTION (Top left box labeled "PAYER'S name, street address, city or town..."):
- payerName: Read the payer's name exactly as printed
- payerAddress: Read the complete address exactly as printed
- payerTIN: Read from "PAYER'S TIN" box (format: XX-XXXXXXX)
- payerPhone: Read phone number if present, otherwise null

RECIPIENT SECTION (Left side, below payer):
- recipientName: Read from "RECIPIENT'S name" line exactly as printed
- recipientAddress: Read the street address and city/state/ZIP as printed
- recipientTIN: Read from "RECIPIENT'S TIN" box (format: XXX-XX-XXXX)
- accountNumber: Read from "Account number" if present, otherwise null

NUMBERED BOXES (Right side):
- nonemployeeCompensation: Read the dollar amount from Box 1 (number only, no $ sign)
- payerMadeDirectSales: true if Box 2 checkbox is marked, false if not
- federalIncomeTaxWithheld: Read amount from Box 4, or null if empty

STATE SECTION (Boxes 5-7, bottom):
- stateTaxInfo: Array with one entry per state listed:
  - state: Read 2-letter state code from Box 5
  - statePayerStateNo: Read ID from Box 6
  - stateIncome: Read amount from Box 7

METADATA:
- taxYear: Read the year shown (look for "20XX" near top)
- corrected: true if "CORRECTED" box is checked

OUTPUT FORMAT (JSON):
{
  "payerName": "[exact text from document]",
  "payerAddress": "[exact text from document]",
  "payerTIN": "[exact TIN from document]",
  "payerPhone": null,
  "recipientName": "[exact text from document]",
  "recipientAddress": "[exact text from document]",
  "recipientTIN": "[exact TIN from document]",
  "accountNumber": null,
  "nonemployeeCompensation": [number from Box 1],
  "payerMadeDirectSales": false,
  "federalIncomeTaxWithheld": null,
  "stateTaxInfo": [],
  "taxYear": [year],
  "corrected": false
}

IMPORTANT REMINDERS:
- Monetary values: numbers only (1570.00 not "$1,570.00")
- TINs: include dashes (XX-XXXXXXX or XXX-XX-XXXX)
- Empty fields: use null, NOT made-up values
- READ the actual document - do not generate fake data`
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
