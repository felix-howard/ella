/**
 * 1099-INT OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-INT (Interest Income)
 */

/**
 * 1099-INT extracted data structure
 * Matches IRS Form 1099-INT box layout
 */
export interface Form1099IntExtractedData {
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

  // Interest Income (Boxes 1-13)
  interestIncome: number | null // Box 1 - Interest income
  earlyWithdrawalPenalty: number | null // Box 2 - Early withdrawal penalty
  interestOnUSSavingsBonds: number | null // Box 3 - Interest on U.S. Savings Bonds and Treasury obligations
  federalIncomeTaxWithheld: number | null // Box 4 - Federal income tax withheld
  investmentExpenses: number | null // Box 5 - Investment expenses
  foreignTaxPaid: number | null // Box 6 - Foreign tax paid
  foreignCountry: string | null // Box 7 - Foreign country or U.S. possession
  taxExemptInterest: number | null // Box 8 - Tax-exempt interest
  specifiedPrivateActivityBondInterest: number | null // Box 9 - Specified private activity bond interest
  marketDiscount: number | null // Box 10 - Market discount
  bondPremium: number | null // Box 11 - Bond premium
  bondPremiumOnTreasuryObligations: number | null // Box 12 - Bond premium on Treasury obligations
  bondPremiumOnTaxExemptBond: number | null // Box 13 - Bond premium on tax-exempt bond

  // State Tax Information (Boxes 14-17)
  stateTaxInfo: Array<{
    state: string | null // Box 14 - State
    stateId: string | null // Box 15 - State identification no.
    stateTaxWithheld: number | null // Box 16 - State tax withheld
  }>

  // Metadata
  taxYear: number | null
  corrected: boolean // Is this a corrected form?
  fatcaFilingRequirement: boolean // FATCA filing requirement checkbox
}

/**
 * Generate 1099-INT OCR extraction prompt
 */
export function get1099IntExtractionPrompt(): string {
  return `You are an OCR system. Your task is to READ and EXTRACT text from this IRS Form 1099-INT image.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in this specific document image
- DO NOT invent, guess, or generate any data
- DO NOT use example or placeholder values
- If a field is blank, empty, or unreadable, use null
- READ the actual text from the image carefully

FORM LAYOUT - Extract these fields by reading the actual document:

PAYER SECTION (Top left box):
- payerName: Read the payer/bank name exactly as printed
- payerAddress: Read the complete address exactly as printed
- payerTIN: Read from "PAYER'S TIN" (format: XX-XXXXXXX)
- payerPhone: Read phone if present, otherwise null

RECIPIENT SECTION (Left side, below payer):
- recipientName: Read from "RECIPIENT'S name" exactly as printed
- recipientAddress: Read the address as printed
- recipientTIN: Read from "RECIPIENT'S TIN" (format: XXX-XX-XXXX)
- accountNumber: Read if present, otherwise null

INTEREST BOXES (Right side):
- interestIncome: Read amount from Box 1
- earlyWithdrawalPenalty: Read from Box 2 if present
- interestOnUSSavingsBonds: Read from Box 3 if present
- federalIncomeTaxWithheld: Read from Box 4 if present
- investmentExpenses: Read from Box 5 if present
- foreignTaxPaid: Read from Box 6 if present
- foreignCountry: Read from Box 7 if present
- taxExemptInterest: Read from Box 8 if present
- specifiedPrivateActivityBondInterest: Read from Box 9 if present
- marketDiscount: Read from Box 10 if present
- bondPremium: Read from Box 11 if present
- bondPremiumOnTreasuryObligations: Read from Box 12 if present
- bondPremiumOnTaxExemptBond: Read from Box 13 if present

STATE TAX (Boxes 14-16):
- stateTaxInfo: Array with entries for each state listed

METADATA:
- taxYear: Read the year shown on the form
- corrected: true if "CORRECTED" box is checked
- fatcaFilingRequirement: true if FATCA box is checked

OUTPUT FORMAT (JSON):
{
  "payerName": "[read from document]",
  "payerAddress": "[read from document]",
  "payerTIN": "[read from document]",
  "payerPhone": null,
  "recipientName": "[read from document]",
  "recipientAddress": "[read from document]",
  "recipientTIN": "[read from document]",
  "accountNumber": null,
  "interestIncome": [number from Box 1],
  "earlyWithdrawalPenalty": null,
  "interestOnUSSavingsBonds": null,
  "federalIncomeTaxWithheld": null,
  "investmentExpenses": null,
  "foreignTaxPaid": null,
  "foreignCountry": null,
  "taxExemptInterest": null,
  "specifiedPrivateActivityBondInterest": null,
  "marketDiscount": null,
  "bondPremium": null,
  "bondPremiumOnTreasuryObligations": null,
  "bondPremiumOnTaxExemptBond": null,
  "stateTaxInfo": [],
  "taxYear": [year],
  "corrected": false,
  "fatcaFilingRequirement": false
}

IMPORTANT REMINDERS:
- Monetary values: numbers only (1250.50 not "$1,250.50")
- TINs: include dashes (XX-XXXXXXX or XXX-XX-XXXX)
- Empty fields: use null, NOT made-up values
- READ the actual document - do not generate fake data`
}

/**
 * Validate 1099-INT extracted data
 */
export function validate1099IntData(data: unknown): data is Form1099IntExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists (values can be null)
  const requiredFields = ['payerName', 'recipientName', 'recipientTIN', 'interestIncome']

  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate arrays
  if (!Array.isArray(d.stateTaxInfo)) return false

  return true
}

/**
 * Get field labels in Vietnamese for 1099-INT
 */
export const FORM_1099_INT_FIELD_LABELS_VI: Record<string, string> = {
  payerName: 'Tên Ngân hàng/Người trả',
  payerAddress: 'Địa chỉ Người trả',
  payerTIN: 'TIN Người trả',
  payerPhone: 'Số điện thoại',
  recipientName: 'Tên Người nhận',
  recipientAddress: 'Địa chỉ Người nhận',
  recipientTIN: 'SSN Người nhận',
  accountNumber: 'Số tài khoản',
  interestIncome: 'Thu nhập lãi (Box 1)',
  earlyWithdrawalPenalty: 'Phạt rút sớm (Box 2)',
  interestOnUSSavingsBonds: 'Lãi trái phiếu Mỹ (Box 3)',
  federalIncomeTaxWithheld: 'Thuế Liên bang đã khấu trừ (Box 4)',
  investmentExpenses: 'Chi phí đầu tư (Box 5)',
  foreignTaxPaid: 'Thuế nước ngoài đã trả (Box 6)',
  foreignCountry: 'Quốc gia (Box 7)',
  taxExemptInterest: 'Lãi miễn thuế (Box 8)',
  specifiedPrivateActivityBondInterest: 'Lãi trái phiếu tư nhân (Box 9)',
  marketDiscount: 'Chiết khấu thị trường (Box 10)',
  bondPremium: 'Phí bảo hiểm trái phiếu (Box 11)',
  bondPremiumOnTreasuryObligations: 'Phí bảo hiểm Treasury (Box 12)',
  bondPremiumOnTaxExemptBond: 'Phí bảo hiểm trái phiếu miễn thuế (Box 13)',
  state: 'Tiểu bang (Box 14)',
  stateId: 'ID Tiểu bang (Box 15)',
  stateTaxWithheld: 'Thuế Tiểu bang đã khấu trừ (Box 16)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
