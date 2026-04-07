/**
 * 1099-OID OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-OID (Original Issue Discount)
 * Reports original issue discount income from bonds and other debt instruments.
 */

/**
 * 1099-OID extracted data structure
 * Matches IRS Form 1099-OID box layout
 */
export interface Form1099OIDExtractedData {
  // Payer Information (Issuer/financial institution)
  payerName: string | null
  payerAddress: string | null
  payerTIN: string | null

  // Recipient Information
  recipientName: string | null
  recipientAddress: string | null
  recipientTIN: string | null // SSN or EIN
  accountNumber: string | null

  // OID Income (Boxes 1-11)
  originalIssueDiscount: number | null // Box 1 - Original issue discount for year (CRITICAL)
  otherPeriodicInterest: number | null // Box 2 - Other periodic interest
  earlyWithdrawalPenalty: number | null // Box 3 - Early withdrawal or forfeiture penalty
  federalIncomeTaxWithheld: number | null // Box 4 - Federal income tax withheld
  marketDiscount: number | null // Box 5 - Market discount
  acquisitionPremium: number | null // Box 6 - Acquisition premium
  description: string | null // Box 7 - Description (bond/instrument info)
  originalIssueDiscountOnTreasury: number | null // Box 8 - OID on U.S. Treasury obligations
  investmentExpenses: number | null // Box 9 - Investment expenses
  bondPremium: number | null // Box 10 - Bond premium
  taxExemptOID: number | null // Box 11 - Tax-exempt OID

  // State Information
  stateTaxInfo: Array<{
    state: string | null
    stateId: string | null
    stateTaxWithheld: number | null
  }>

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate 1099-OID OCR extraction prompt
 */
export function get1099OIDExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-OID (Original Issue Discount).

IMPORTANT: This form reports original issue discount income from bonds, notes, and other debt instruments held during the year. Accuracy is critical.

Extract the following fields:

PAYER INFORMATION (Issuer/financial institution):
- payerName: Issuer or financial institution name
- payerAddress: Issuer address
- payerTIN: Issuer's EIN

RECIPIENT INFORMATION:
- recipientName: Bondholder/taxpayer name
- recipientAddress: Bondholder address
- recipientTIN: Taxpayer's SSN or EIN (XXX-XX-XXXX or XX-XXXXXXX)
- accountNumber: Account number

OID INCOME:
- originalIssueDiscount: Box 1 - Original issue discount for the year
  (CRITICAL - must be reported as taxable interest income)
- otherPeriodicInterest: Box 2 - Other periodic interest
- earlyWithdrawalPenalty: Box 3 - Early withdrawal or forfeiture penalty (reduces income)
- federalIncomeTaxWithheld: Box 4 - Federal income tax withheld
- marketDiscount: Box 5 - Market discount (may be taxable)
- acquisitionPremium: Box 6 - Acquisition premium (reduces OID)
- description: Box 7 - Description of debt instrument (CUSIP, maturity date, rate, etc.)
- originalIssueDiscountOnTreasury: Box 8 - OID on U.S. Treasury obligations (exempt from state tax)
- investmentExpenses: Box 9 - Investment expenses
- bondPremium: Box 10 - Bond premium
- taxExemptOID: Box 11 - Tax-exempt OID

STATE TAX:
- stateTaxInfo: Array of { state, stateId, stateTaxWithheld }

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "payerName": "First National Bank",
  "payerAddress": "100 Bank Plaza, City, ST 12345",
  "payerTIN": "XX-XXXXXXX",
  "recipientName": "JOHN DOE",
  "recipientAddress": "123 Main St, City, ST 12345",
  "recipientTIN": "XXX-XX-XXXX",
  "accountNumber": "BOND-987654321",
  "originalIssueDiscount": 250.00,
  "otherPeriodicInterest": null,
  "earlyWithdrawalPenalty": null,
  "federalIncomeTaxWithheld": null,
  "marketDiscount": null,
  "acquisitionPremium": null,
  "description": "5.25% Corporate Bond due 12/31/2030",
  "originalIssueDiscountOnTreasury": null,
  "investmentExpenses": null,
  "bondPremium": null,
  "taxExemptOID": null,
  "stateTaxInfo": [
    {"state": "CA", "stateId": "XXX-XXXX", "stateTaxWithheld": null}
  ],
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 1 OID is taxable interest income even if not actually received in cash
2. Box 3 penalty reduces taxable income (enter as positive number)
3. Box 8 Treasury OID is exempt from state and local taxes
4. Box 6 acquisition premium offsets OID — capture exactly as shown
5. All monetary values as numbers without $ or commas
6. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-OID extracted data
 */
export function validate1099OIDData(data: unknown): data is Form1099OIDExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['payerName', 'recipientTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate arrays
  if (!Array.isArray(d.stateTaxInfo)) return false

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for 1099-OID
 */
export const FORM_1099_OID_FIELD_LABELS_VI: Record<string, string> = {
  payerName: 'Tên Tổ chức phát hành',
  payerAddress: 'Địa chỉ Tổ chức phát hành',
  payerTIN: 'EIN Tổ chức phát hành',
  recipientName: 'Tên Người nhận',
  recipientAddress: 'Địa chỉ Người nhận',
  recipientTIN: 'SSN/EIN Người nhận',
  accountNumber: 'Số tài khoản',
  originalIssueDiscount: 'Chiết khấu phát hành gốc (Box 1)',
  otherPeriodicInterest: 'Lãi định kỳ khác (Box 2)',
  earlyWithdrawalPenalty: 'Phạt rút trước hạn (Box 3)',
  federalIncomeTaxWithheld: 'Thuế Liên bang đã khấu trừ (Box 4)',
  marketDiscount: 'Chiết khấu thị trường (Box 5)',
  acquisitionPremium: 'Phí mua lại (Box 6)',
  description: 'Mô tả công cụ nợ (Box 7)',
  originalIssueDiscountOnTreasury: 'OID Trái phiếu Kho bạc (Box 8)',
  investmentExpenses: 'Chi phí đầu tư (Box 9)',
  bondPremium: 'Phí trái phiếu (Box 10)',
  taxExemptOID: 'OID miễn thuế (Box 11)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
