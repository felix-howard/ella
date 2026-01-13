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
  return `You are an expert OCR system for extracting data from IRS Form 1099-INT (Interest Income). Extract all data from this 1099-INT form image accurately.

IMPORTANT: This is a tax document. Accuracy is critical. If a value is unclear or not present, use null rather than guessing.

Extract the following fields:

PAYER INFORMATION (Left side, top):
- payerName: Payer's name
- payerAddress: Payer's complete address
- payerTIN: Payer's TIN (EIN or SSN format)
- payerPhone: Payer's telephone number (if shown)

RECIPIENT INFORMATION (Left side, middle):
- recipientName: Recipient's name
- recipientAddress: Recipient's complete address
- recipientTIN: Recipient's TIN (SSN format: XXX-XX-XXXX)
- accountNumber: Account number (if shown)

INTEREST INCOME (Right side boxes):
- interestIncome: Box 1 - Interest income (main amount)
- earlyWithdrawalPenalty: Box 2 - Early withdrawal penalty
- interestOnUSSavingsBonds: Box 3 - Interest on U.S. Savings Bonds and Treasury obligations
- federalIncomeTaxWithheld: Box 4 - Federal income tax withheld
- investmentExpenses: Box 5 - Investment expenses
- foreignTaxPaid: Box 6 - Foreign tax paid
- foreignCountry: Box 7 - Foreign country or U.S. possession
- taxExemptInterest: Box 8 - Tax-exempt interest
- specifiedPrivateActivityBondInterest: Box 9 - Specified private activity bond interest
- marketDiscount: Box 10 - Market discount
- bondPremium: Box 11 - Bond premium
- bondPremiumOnTreasuryObligations: Box 12 - Bond premium on Treasury obligations
- bondPremiumOnTaxExemptBond: Box 13 - Bond premium on tax-exempt bond

STATE TAX INFORMATION (Bottom):
- stateTaxInfo: Array of { state, stateId, stateTaxWithheld }

METADATA:
- taxYear: The tax year shown on the form
- corrected: true if "CORRECTED" checkbox is marked
- fatcaFilingRequirement: true if FATCA checkbox is marked

Respond in JSON format:
{
  "payerName": "First National Bank",
  "payerAddress": "123 Main St, City, ST 12345",
  "payerTIN": "XX-XXXXXXX",
  "payerPhone": null,
  "recipientName": "John Doe",
  "recipientAddress": "456 Oak Ave, City, ST 67890",
  "recipientTIN": "XXX-XX-XXXX",
  "accountNumber": "****1234",
  "interestIncome": 1250.50,
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
  "stateTaxInfo": [
    {
      "state": "CA",
      "stateId": "XXX-XXXX-X",
      "stateTaxWithheld": 125.05
    }
  ],
  "taxYear": 2024,
  "corrected": false,
  "fatcaFilingRequirement": false
}

Rules:
1. All monetary values should be numbers without $ or commas
2. Use null for empty or unclear fields, NEVER guess
3. SSN should include dashes: XXX-XX-XXXX
4. EIN should include dash: XX-XXXXXXX
5. Box 1 (interestIncome) is the most important field
6. Most forms will only have Box 1 filled, other boxes are often empty`
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
