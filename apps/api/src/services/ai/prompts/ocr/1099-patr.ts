/**
 * 1099-PATR OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-PATR (Taxable Distributions Received From Cooperatives)
 * Reports patronage dividends, non-patronage distributions, per-unit retain allocations, etc.
 */

/**
 * 1099-PATR extracted data structure
 * Matches IRS Form 1099-PATR box layout
 */
export interface Form1099PATRExtractedData {
  // Cooperative Information (Payer)
  cooperativeName: string | null
  cooperativeAddress: string | null
  cooperativeTIN: string | null

  // Recipient Information
  recipientName: string | null
  recipientAddress: string | null
  recipientTIN: string | null // SSN or EIN
  accountNumber: string | null

  // Distributions (Boxes 1-9)
  patronageDividends: number | null // Box 1 - Patronage dividends (CRITICAL)
  nonpatronageDistributions: number | null // Box 2 - Nonpatronage distributions
  perUnitRetainAllocations: number | null // Box 3 - Per-unit retain allocations
  federalIncomeTaxWithheld: number | null // Box 4 - Federal income tax withheld
  redemptionAmount: number | null // Box 5 - Redemption of nonqualified notices/retain allocations
  domesticProductionDeduction: number | null // Box 6 - Domestic production activities deduction
  investmentCredit: number | null // Box 7 - Investment credit
  workOpportunityCredit: number | null // Box 8 - Work opportunity credit
  patronsAMTAdjustment: number | null // Box 9 - Patron's AMT adjustment

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
 * Generate 1099-PATR OCR extraction prompt
 */
export function get1099PATRExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-PATR (Taxable Distributions Received From Cooperatives).

IMPORTANT: This form reports distributions from cooperatives to patrons. Accuracy is critical for tax reporting.

Extract the following fields:

COOPERATIVE INFORMATION (Payer):
- cooperativeName: Cooperative's name
- cooperativeAddress: Cooperative's address
- cooperativeTIN: Cooperative's EIN

RECIPIENT INFORMATION:
- recipientName: Patron's name
- recipientAddress: Patron's address
- recipientTIN: Patron's SSN or EIN (XXX-XX-XXXX or XX-XXXXXXX)
- accountNumber: Account number if present

DISTRIBUTIONS:
- patronageDividends: Box 1 - Patronage dividends
  (CRITICAL - primary taxable amount from cooperative patronage)
- nonpatronageDistributions: Box 2 - Nonpatronage distributions
- perUnitRetainAllocations: Box 3 - Per-unit retain allocations
- federalIncomeTaxWithheld: Box 4 - Federal income tax withheld
- redemptionAmount: Box 5 - Redemption of nonqualified notices and retain allocations
- domesticProductionDeduction: Box 6 - Domestic production activities deduction
- investmentCredit: Box 7 - Investment credit
- workOpportunityCredit: Box 8 - Work opportunity credit
- patronsAMTAdjustment: Box 9 - Patron's AMT adjustment

STATE TAX:
- stateTaxInfo: Array of { state, stateId, stateTaxWithheld }

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "cooperativeName": "ABC Farmers Cooperative",
  "cooperativeAddress": "200 Farm Rd, City, ST 12345",
  "cooperativeTIN": "XX-XXXXXXX",
  "recipientName": "JOHN DOE",
  "recipientAddress": "123 Main St, City, ST 12345",
  "recipientTIN": "XXX-XX-XXXX",
  "accountNumber": "PATR-123456",
  "patronageDividends": 5000.00,
  "nonpatronageDistributions": null,
  "perUnitRetainAllocations": null,
  "federalIncomeTaxWithheld": 500.00,
  "redemptionAmount": null,
  "domesticProductionDeduction": null,
  "investmentCredit": null,
  "workOpportunityCredit": null,
  "patronsAMTAdjustment": null,
  "stateTaxInfo": [
    {"state": "CA", "stateId": "XXX-XXXX", "stateTaxWithheld": 250.00}
  ],
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 1 (patronage dividends) is the primary taxable amount — extract with highest accuracy
2. Box 4 withholding reduces tax owed
3. Credits in Boxes 7-8 flow to Schedule F or Schedule C
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-PATR extracted data
 */
export function validate1099PATRData(data: unknown): data is Form1099PATRExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['cooperativeName', 'recipientTIN']
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
 * Vietnamese field labels for 1099-PATR
 */
export const FORM_1099_PATR_FIELD_LABELS_VI: Record<string, string> = {
  cooperativeName: 'Tên Hợp tác xã',
  cooperativeAddress: 'Địa chỉ Hợp tác xã',
  cooperativeTIN: 'EIN Hợp tác xã',
  recipientName: 'Tên Người nhận',
  recipientAddress: 'Địa chỉ Người nhận',
  recipientTIN: 'SSN/EIN Người nhận',
  accountNumber: 'Số tài khoản',
  patronageDividends: 'Cổ tức bảo trợ (Box 1)',
  nonpatronageDistributions: 'Phân phối ngoài bảo trợ (Box 2)',
  perUnitRetainAllocations: 'Phân bổ giữ lại theo đơn vị (Box 3)',
  federalIncomeTaxWithheld: 'Thuế Liên bang đã khấu trừ (Box 4)',
  redemptionAmount: 'Số tiền mua lại (Box 5)',
  domesticProductionDeduction: 'Khấu trừ sản xuất trong nước (Box 6)',
  investmentCredit: 'Tín dụng đầu tư (Box 7)',
  workOpportunityCredit: 'Tín dụng cơ hội việc làm (Box 8)',
  patronsAMTAdjustment: 'Điều chỉnh AMT của nhà bảo trợ (Box 9)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
