/**
 * 1099-G OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-G (Certain Government Payments)
 * Reports unemployment compensation, state/local tax refunds, etc.
 */

/**
 * 1099-G extracted data structure
 * Matches IRS Form 1099-G box layout
 */
export interface Form1099GExtractedData {
  // Payer Information (Government agency)
  payerName: string | null
  payerAddress: string | null
  payerTIN: string | null
  payerPhone: string | null

  // Recipient Information
  recipientName: string | null
  recipientAddress: string | null
  recipientTIN: string | null // SSN
  accountNumber: string | null

  // Government Payments (Boxes 1-8)
  unemploymentCompensation: number | null // Box 1 - Unemployment compensation (MOST IMPORTANT)
  stateTaxRefund: number | null // Box 2 - State or local income tax refunds
  taxRefundYear: number | null // Box 3 - Tax year of refund (Box 2)
  federalIncomeTaxWithheld: number | null // Box 4 - Federal income tax withheld
  rtaaPayments: number | null // Box 5 - RTAA payments
  taxableGrants: number | null // Box 6 - Taxable grants
  agriculturePayments: number | null // Box 7 - Agriculture payments
  marketGain: boolean // Box 8 - Check if Box 2 is trade/business income

  // State Information (Boxes 9-11)
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
 * Generate 1099-G OCR extraction prompt
 */
export function get1099GExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-G (Certain Government Payments).

IMPORTANT: This form reports government payments including unemployment compensation and state tax refunds. Accuracy is critical.

Extract the following fields:

PAYER INFORMATION (Government agency):
- payerName: Agency name (e.g., "State Unemployment Agency")
- payerAddress: Agency address
- payerTIN: Agency's EIN
- payerPhone: Contact phone

RECIPIENT INFORMATION:
- recipientName: Taxpayer's name
- recipientAddress: Taxpayer's address
- recipientTIN: Taxpayer's SSN (XXX-XX-XXXX)
- accountNumber: Account/case number

GOVERNMENT PAYMENTS:
- unemploymentCompensation: Box 1 - Unemployment compensation
  (MOST IMPORTANT - taxable income)
- stateTaxRefund: Box 2 - State or local income tax refunds, credits, or offsets
  (May be taxable if itemized deductions were claimed in prior year)
- taxRefundYear: Box 3 - Which tax year the refund in Box 2 applies to
- federalIncomeTaxWithheld: Box 4 - Federal income tax withheld
- rtaaPayments: Box 5 - Reemployment Trade Adjustment Assistance (RTAA) payments
- taxableGrants: Box 6 - Taxable grants
- agriculturePayments: Box 7 - Agriculture payments
- marketGain: Box 8 - Checked if Box 2 is related to trade/business income

STATE TAX (Boxes 9-11):
- stateTaxInfo: Array of { state, stateId, stateTaxWithheld }

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "payerName": "State Unemployment Insurance Agency",
  "payerAddress": "100 Gov Center, City, ST 12345",
  "payerTIN": "XX-XXXXXXX",
  "payerPhone": "(555) 123-4567",
  "recipientName": "JOHN DOE",
  "recipientAddress": "123 Main St, City, ST 12345",
  "recipientTIN": "XXX-XX-XXXX",
  "accountNumber": "UI-123456789",
  "unemploymentCompensation": 15000.00,
  "stateTaxRefund": null,
  "taxRefundYear": null,
  "federalIncomeTaxWithheld": 1500.00,
  "rtaaPayments": null,
  "taxableGrants": null,
  "agriculturePayments": null,
  "marketGain": false,
  "stateTaxInfo": [
    {"state": "CA", "stateId": "XXX-XXXX", "stateTaxWithheld": 750.00}
  ],
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 1 (unemployment) is taxable income
2. Box 2 (state refund) may be taxable if you itemized in prior year
3. Box 4 withholding reduces tax owed
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-G extracted data
 */
export function validate1099GData(data: unknown): data is Form1099GExtractedData {
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
  if (typeof d.marketGain !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for 1099-G
 */
export const FORM_1099_G_FIELD_LABELS_VI: Record<string, string> = {
  payerName: 'Tên Cơ quan Chính phủ',
  payerAddress: 'Địa chỉ Cơ quan',
  payerTIN: 'EIN Cơ quan',
  payerPhone: 'Điện thoại',
  recipientName: 'Tên Người nhận',
  recipientAddress: 'Địa chỉ Người nhận',
  recipientTIN: 'SSN Người nhận',
  accountNumber: 'Số tài khoản/Hồ sơ',
  unemploymentCompensation: 'Trợ cấp thất nghiệp (Box 1)',
  stateTaxRefund: 'Hoàn thuế Tiểu bang (Box 2)',
  taxRefundYear: 'Năm hoàn thuế (Box 3)',
  federalIncomeTaxWithheld: 'Thuế Liên bang đã khấu trừ (Box 4)',
  rtaaPayments: 'Thanh toán RTAA (Box 5)',
  taxableGrants: 'Trợ cấp chịu thuế (Box 6)',
  agriculturePayments: 'Thanh toán nông nghiệp (Box 7)',
  marketGain: 'Thu nhập kinh doanh (Box 8)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
