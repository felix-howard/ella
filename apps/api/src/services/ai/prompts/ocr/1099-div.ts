/**
 * 1099-DIV OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-DIV (Dividends and Distributions)
 */

/**
 * 1099-DIV extracted data structure
 * Matches IRS Form 1099-DIV box layout
 */
export interface Form1099DivExtractedData {
  // Payer Information
  payerName: string | null
  payerAddress: string | null
  payerTIN: string | null

  // Recipient Information
  recipientName: string | null
  recipientAddress: string | null
  recipientTIN: string | null
  accountNumber: string | null

  // Dividend Income (Boxes 1-12)
  totalOrdinaryDividends: number | null // Box 1a - Total ordinary dividends
  qualifiedDividends: number | null // Box 1b - Qualified dividends
  totalCapitalGainDistr: number | null // Box 2a - Total capital gain distr.
  unrecap1250Gain: number | null // Box 2b - Unrecap. Sec. 1250 gain
  section1202Gain: number | null // Box 2c - Section 1202 gain
  collectibles28Gain: number | null // Box 2d - Collectibles (28%) gain
  section897OrdinaryDividends: number | null // Box 2e
  section897CapitalGain: number | null // Box 2f
  nondividendDistributions: number | null // Box 3 - Nondividend distributions
  federalIncomeTaxWithheld: number | null // Box 4 - Federal income tax withheld
  section199ADividends: number | null // Box 5 - Section 199A dividends
  investmentExpenses: number | null // Box 6 - Investment expenses
  foreignTaxPaid: number | null // Box 7 - Foreign tax paid
  foreignCountry: string | null // Box 8 - Foreign country
  cashLiquidationDistr: number | null // Box 9 - Cash liquidation distr.
  noncashLiquidationDistr: number | null // Box 10 - Noncash liquidation distr.
  exemptInterestDividends: number | null // Box 12 - Exempt-interest dividends
  specifiedPABInterestDiv: number | null // Box 13 - Specified PAB interest div.

  // State Tax Information
  stateTaxInfo: Array<{
    state: string | null
    stateId: string | null
    stateTaxWithheld: number | null
  }>

  // Metadata
  taxYear: number | null
  corrected: boolean
  fatcaFilingRequirement: boolean
}

/**
 * Generate 1099-DIV OCR extraction prompt
 */
export function get1099DivExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-DIV (Dividends and Distributions).

IMPORTANT: This is a tax document. Accuracy is critical. If a value is unclear or not present, use null rather than guessing.

Extract the following fields:

PAYER INFORMATION:
- payerName, payerAddress, payerTIN

RECIPIENT INFORMATION:
- recipientName, recipientAddress, recipientTIN, accountNumber

DIVIDEND INCOME:
- totalOrdinaryDividends: Box 1a - Total ordinary dividends (MOST IMPORTANT)
- qualifiedDividends: Box 1b - Qualified dividends (taxed at lower rate)
- totalCapitalGainDistr: Box 2a - Total capital gain distributions
- unrecap1250Gain: Box 2b
- section1202Gain: Box 2c
- collectibles28Gain: Box 2d
- section897OrdinaryDividends: Box 2e
- section897CapitalGain: Box 2f
- nondividendDistributions: Box 3 - Return of capital
- federalIncomeTaxWithheld: Box 4
- section199ADividends: Box 5 - For REIT/qualified cooperatives
- investmentExpenses: Box 6
- foreignTaxPaid: Box 7
- foreignCountry: Box 8
- cashLiquidationDistr: Box 9
- noncashLiquidationDistr: Box 10
- exemptInterestDividends: Box 12
- specifiedPABInterestDiv: Box 13

STATE TAX (Boxes 14-16):
- stateTaxInfo: Array of { state, stateId, stateTaxWithheld }

METADATA:
- taxYear, corrected, fatcaFilingRequirement

Respond in JSON format:
{
  "payerName": "Vanguard Group",
  "payerAddress": "100 Vanguard Blvd, Malvern, PA 19355",
  "payerTIN": "XX-XXXXXXX",
  "recipientName": "JOHN DOE",
  "recipientAddress": "123 Main St, City, ST 12345",
  "recipientTIN": "XXX-XX-XXXX",
  "accountNumber": "XXXX1234",
  "totalOrdinaryDividends": 1500.00,
  "qualifiedDividends": 1200.00,
  "totalCapitalGainDistr": 500.00,
  "unrecap1250Gain": null,
  "section1202Gain": null,
  "collectibles28Gain": null,
  "section897OrdinaryDividends": null,
  "section897CapitalGain": null,
  "nondividendDistributions": null,
  "federalIncomeTaxWithheld": null,
  "section199ADividends": null,
  "investmentExpenses": null,
  "foreignTaxPaid": 25.00,
  "foreignCountry": "Various",
  "cashLiquidationDistr": null,
  "noncashLiquidationDistr": null,
  "exemptInterestDividends": null,
  "specifiedPABInterestDiv": null,
  "stateTaxInfo": [],
  "taxYear": 2024,
  "corrected": false,
  "fatcaFilingRequirement": false
}

Rules:
1. All monetary values as numbers without $ or commas
2. Box 1a (totalOrdinaryDividends) is the key field
3. Box 1b (qualifiedDividends) is always <= Box 1a
4. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-DIV extracted data
 */
export function validate1099DivData(data: unknown): data is Form1099DivExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['payerName', 'recipientTIN', 'totalOrdinaryDividends']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate arrays
  if (!Array.isArray(d.stateTaxInfo)) return false

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false
  if (typeof d.fatcaFilingRequirement !== 'boolean') return false

  // Validate key numeric field (allow null or number)
  if (d.totalOrdinaryDividends !== null && typeof d.totalOrdinaryDividends !== 'number') return false

  return true
}

/**
 * Vietnamese field labels for 1099-DIV
 */
export const FORM_1099_DIV_FIELD_LABELS_VI: Record<string, string> = {
  payerName: 'Tên Công ty trả cổ tức',
  payerAddress: 'Địa chỉ Công ty',
  payerTIN: 'EIN Công ty',
  recipientName: 'Tên Người nhận',
  recipientAddress: 'Địa chỉ Người nhận',
  recipientTIN: 'SSN Người nhận',
  accountNumber: 'Số tài khoản',
  totalOrdinaryDividends: 'Tổng cổ tức thường (Box 1a)',
  qualifiedDividends: 'Cổ tức đủ điều kiện (Box 1b)',
  totalCapitalGainDistr: 'Phân phối lãi vốn (Box 2a)',
  nondividendDistributions: 'Hoàn vốn (Box 3)',
  federalIncomeTaxWithheld: 'Thuế Liên bang đã khấu trừ (Box 4)',
  section199ADividends: 'Cổ tức Section 199A (Box 5)',
  foreignTaxPaid: 'Thuế nước ngoài (Box 7)',
  foreignCountry: 'Quốc gia (Box 8)',
  exemptInterestDividends: 'Cổ tức lãi miễn thuế (Box 12)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
