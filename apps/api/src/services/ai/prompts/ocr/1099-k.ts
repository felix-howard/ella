/**
 * 1099-K OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-K (Payment Card and Third Party Network Transactions)
 * Common sources: Square, Clover, PayPal, Stripe, Venmo Business
 */

/**
 * 1099-K extracted data structure
 * Matches IRS Form 1099-K box layout
 */
export interface Form1099KExtractedData {
  // Filer Information (Payment Settlement Entity)
  filerName: string | null
  filerAddress: string | null
  filerTIN: string | null // EIN
  filerPhone: string | null

  // Payee Information (Business Owner)
  payeeName: string | null
  payeeAddress: string | null
  payeeTIN: string | null // SSN or EIN
  accountNumber: string | null

  // Payment Information (Boxes 1-4)
  grossAmount: number | null // Box 1a - Gross amount of payment card/third party network transactions
  cardNotPresent: number | null // Box 1b - Card not present transactions
  numberOfPaymentTransactions: number | null // Box 2 - Number of payment transactions
  federalIncomeTaxWithheld: number | null // Box 4 - Federal income tax withheld

  // Monthly Gross Amounts (Box 5a-5l)
  monthlyAmounts: {
    january: number | null
    february: number | null
    march: number | null
    april: number | null
    may: number | null
    june: number | null
    july: number | null
    august: number | null
    september: number | null
    october: number | null
    november: number | null
    december: number | null
  }

  // State Tax Information (Boxes 6-8)
  stateTaxInfo: Array<{
    state: string | null // Box 6 - State
    stateId: string | null // Box 7 - State identification no.
    stateGrossAmount: number | null // Box 8 - State gross amount
  }>

  // Checkboxes and Metadata
  pseName: string | null // Payment Settlement Entity name
  psePhone: string | null // PSE phone number
  transactionReportingType: 'PAYMENT_CARD' | 'THIRD_PARTY_NETWORK' | null
  corrected: boolean
  taxYear: number | null
}

/**
 * Generate 1099-K OCR extraction prompt
 */
export function get1099KExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-K (Payment Card and Third Party Network Transactions). This form reports payment card transactions from processors like Square, Clover, PayPal, Stripe.

IMPORTANT: This is a tax document. Accuracy is critical. If a value is unclear or not present, use null rather than guessing.

Extract the following fields:

FILER INFORMATION (Left side, top - Payment Settlement Entity):
- filerName: Name of the filer (e.g., "Square Inc", "Clover Network")
- filerAddress: Complete address
- filerTIN: Filer's TIN (EIN format: XX-XXXXXXX)
- filerPhone: Phone number if shown

PAYEE INFORMATION (Left side, middle - Business receiving payments):
- payeeName: Business or person name receiving payments
- payeeAddress: Complete address
- payeeTIN: Payee's TIN (SSN: XXX-XX-XXXX or EIN: XX-XXXXXXX)
- accountNumber: Merchant/account number

PAYMENT AMOUNTS (Right side boxes):
- grossAmount: Box 1a - Gross amount of payment card/third party transactions (MOST IMPORTANT)
- cardNotPresent: Box 1b - Card not present transactions
- numberOfPaymentTransactions: Box 2 - Number of payment transactions
- federalIncomeTaxWithheld: Box 4 - Federal income tax withheld

MONTHLY BREAKDOWN (Box 5a-5l):
- monthlyAmounts: Object with january through december amounts

STATE TAX INFORMATION (Bottom):
- stateTaxInfo: Array of { state, stateId, stateGrossAmount }

PSE INFORMATION:
- pseName: Payment Settlement Entity name
- psePhone: PSE telephone number
- transactionReportingType: "PAYMENT_CARD" or "THIRD_PARTY_NETWORK"

METADATA:
- corrected: true if "CORRECTED" checkbox is marked
- taxYear: Tax year shown on form

Respond in JSON format:
{
  "filerName": "Square Inc",
  "filerAddress": "1455 Market St, San Francisco, CA 94103",
  "filerTIN": "XX-XXXXXXX",
  "filerPhone": null,
  "payeeName": "ABC Nail Salon LLC",
  "payeeAddress": "123 Main St, City, ST 12345",
  "payeeTIN": "XX-XXXXXXX",
  "accountNumber": "XXXX-XXXX-1234",
  "grossAmount": 85000.00,
  "cardNotPresent": null,
  "numberOfPaymentTransactions": 2500,
  "federalIncomeTaxWithheld": null,
  "monthlyAmounts": {
    "january": 6500.00,
    "february": 6200.00,
    "march": 7100.00,
    "april": 7300.00,
    "may": 7500.00,
    "june": 7800.00,
    "july": 7400.00,
    "august": 7600.00,
    "september": 7200.00,
    "october": 7000.00,
    "november": 6800.00,
    "december": 6600.00
  },
  "stateTaxInfo": [
    {"state": "CA", "stateId": "XXX-XXXX-X", "stateGrossAmount": 85000.00}
  ],
  "pseName": "Square Inc",
  "psePhone": "1-855-700-6000",
  "transactionReportingType": "PAYMENT_CARD",
  "corrected": false,
  "taxYear": 2024
}

Rules:
1. All monetary values should be numbers without $ or commas
2. Use null for empty or unclear fields, NEVER guess
3. Box 1a (grossAmount) is the most important field
4. Monthly amounts may not equal gross amount (adjustments, fees)
5. Common filers: Square, Clover, PayPal, Stripe, Venmo, Shopify
6. Transaction counts are whole numbers without commas`
}

/**
 * Validate 1099-K extracted data
 * Checks structure, field existence, and types (allowing null for optional values)
 */
export function validate1099KData(data: unknown): data is Form1099KExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists (values can be null)
  const requiredFields = ['filerName', 'payeeName', 'payeeTIN', 'grossAmount']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate arrays
  if (!Array.isArray(d.stateTaxInfo)) return false

  // Validate monthlyAmounts object exists
  if (!d.monthlyAmounts || typeof d.monthlyAmounts !== 'object') return false

  // Type validation for key numeric fields (allow null or number)
  if (d.grossAmount !== null && typeof d.grossAmount !== 'number') return false
  if (d.federalIncomeTaxWithheld !== null && d.federalIncomeTaxWithheld !== undefined && typeof d.federalIncomeTaxWithheld !== 'number') return false

  // Validate boolean field
  if (typeof d.corrected !== 'boolean') return false

  return true
}

/**
 * Get field labels in Vietnamese for 1099-K
 */
export const FORM_1099_K_FIELD_LABELS_VI: Record<string, string> = {
  filerName: 'Tên Công ty Thanh toán',
  filerAddress: 'Địa chỉ Công ty Thanh toán',
  filerTIN: 'EIN Công ty Thanh toán',
  filerPhone: 'Số điện thoại',
  payeeName: 'Tên Người nhận',
  payeeAddress: 'Địa chỉ Người nhận',
  payeeTIN: 'SSN/EIN Người nhận',
  accountNumber: 'Số tài khoản',
  grossAmount: 'Tổng thu nhập thẻ (Box 1a)',
  cardNotPresent: 'Giao dịch không có thẻ (Box 1b)',
  numberOfPaymentTransactions: 'Số giao dịch (Box 2)',
  federalIncomeTaxWithheld: 'Thuế Liên bang đã khấu trừ (Box 4)',
  monthlyAmounts: 'Thu nhập theo tháng (Box 5)',
  state: 'Tiểu bang (Box 6)',
  stateId: 'ID Tiểu bang (Box 7)',
  stateGrossAmount: 'Tổng thu nhập Tiểu bang (Box 8)',
  pseName: 'Tên PSE',
  psePhone: 'Số điện thoại PSE',
  transactionReportingType: 'Loại giao dịch',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
