/**
 * 1099-R OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-R (Distributions From Pensions, Annuities, Retirement)
 */

/**
 * 1099-R extracted data structure
 * Matches IRS Form 1099-R box layout
 */
export interface Form1099RExtractedData {
  // Payer Information
  payerName: string | null
  payerAddress: string | null
  payerTIN: string | null

  // Recipient Information
  recipientName: string | null
  recipientAddress: string | null
  recipientTIN: string | null
  accountNumber: string | null

  // Distribution Information (Boxes 1-11)
  grossDistribution: number | null // Box 1 - Gross distribution
  taxableAmount: number | null // Box 2a - Taxable amount
  taxableAmountNotDetermined: boolean // Box 2b checkbox
  totalDistribution: boolean // Box 2b checkbox
  capitalGain: number | null // Box 3 - Capital gain
  federalIncomeTaxWithheld: number | null // Box 4 - Federal income tax withheld
  employeeContributions: number | null // Box 5 - Employee contributions
  netUnrealizedAppreciation: number | null // Box 6 - Net unrealized appreciation
  distributionCodes: string | null // Box 7 - Distribution code(s)
  otherAmount: number | null // Box 8 - Other (%)
  yourPercentOfTotal: number | null // Box 9a - Your % of total
  totalEmployeeContributions: number | null // Box 9b - Total employee contributions
  firstYearOfRoth: number | null // Box 11 - 1st year of designated Roth

  // IRA/SEP/SIMPLE (Box 7)
  iraSepSimple: boolean

  // State/Local Tax Information (Boxes 12-17)
  stateTaxInfo: Array<{
    state: string | null
    stateId: string | null
    stateDistribution: number | null
    stateTaxWithheld: number | null
  }>
  localTaxInfo: Array<{
    localityName: string | null
    localDistribution: number | null
    localTaxWithheld: number | null
  }>

  // Metadata
  taxYear: number | null
  corrected: boolean
  fatcaFilingRequirement: boolean
}

/**
 * Generate 1099-R OCR extraction prompt
 */
export function get1099RExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-R (Distributions From Pensions, Annuities, Retirement Plans).

IMPORTANT: This is a tax document for retirement distributions. Accuracy is critical.

Extract the following fields:

PAYER INFORMATION (Payer = retirement plan administrator):
- payerName, payerAddress, payerTIN

RECIPIENT INFORMATION (Recipient = person receiving distribution):
- recipientName, recipientAddress, recipientTIN, accountNumber

DISTRIBUTION INFORMATION:
- grossDistribution: Box 1 - Gross distribution (MOST IMPORTANT)
- taxableAmount: Box 2a - Taxable amount
- taxableAmountNotDetermined: Box 2b - "Taxable amount not determined" checkbox
- totalDistribution: Box 2b - "Total distribution" checkbox
- capitalGain: Box 3 - Capital gain (included in Box 2a)
- federalIncomeTaxWithheld: Box 4 - Federal income tax withheld
- employeeContributions: Box 5 - Employee contributions/Designated Roth contributions
- netUnrealizedAppreciation: Box 6 - Net unrealized appreciation in employer's securities
- distributionCodes: Box 7 - Distribution code(s) - IMPORTANT for tax treatment
  Common codes: 1=Early, 2=Early-exception, 3=Disability, 4=Death, 7=Normal, G=Rollover
- iraSepSimple: Box 7 - IRA/SEP/SIMPLE checkbox
- otherAmount: Box 8 - Other (%)
- yourPercentOfTotal: Box 9a - Your % of total distribution
- totalEmployeeContributions: Box 9b - Total employee contributions
- firstYearOfRoth: Box 11 - 1st year of designated Roth contributions

STATE/LOCAL TAX (Boxes 12-17):
- stateTaxInfo: Array with state, stateId, stateDistribution, stateTaxWithheld
- localTaxInfo: Array with localityName, localDistribution, localTaxWithheld

METADATA:
- taxYear, corrected, fatcaFilingRequirement

Respond in JSON format:
{
  "payerName": "Fidelity Investments",
  "payerAddress": "100 Fidelity Way, Boston, MA 02210",
  "payerTIN": "XX-XXXXXXX",
  "recipientName": "JOHN DOE",
  "recipientAddress": "123 Main St, City, ST 12345",
  "recipientTIN": "XXX-XX-XXXX",
  "accountNumber": "XXXX5678",
  "grossDistribution": 25000.00,
  "taxableAmount": 25000.00,
  "taxableAmountNotDetermined": false,
  "totalDistribution": true,
  "capitalGain": null,
  "federalIncomeTaxWithheld": 5000.00,
  "employeeContributions": null,
  "netUnrealizedAppreciation": null,
  "distributionCodes": "7",
  "iraSepSimple": true,
  "otherAmount": null,
  "yourPercentOfTotal": null,
  "totalEmployeeContributions": null,
  "firstYearOfRoth": null,
  "stateTaxInfo": [
    {"state": "CA", "stateId": "XXX-XXX-XXXX", "stateDistribution": 25000.00, "stateTaxWithheld": 1250.00}
  ],
  "localTaxInfo": [],
  "taxYear": 2024,
  "corrected": false,
  "fatcaFilingRequirement": false
}

Rules:
1. Distribution codes determine tax treatment - extract exactly as shown
2. Box 2a may be blank if "Taxable amount not determined" is checked
3. IRA/SEP/SIMPLE checkbox affects self-employment calculations
4. Key fields: grossDistribution (Box 1), taxableAmount (Box 2a), distributionCodes (Box 7)`
}

/**
 * Validate 1099-R extracted data
 */
export function validate1099RData(data: unknown): data is Form1099RExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['payerName', 'recipientTIN', 'grossDistribution']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate arrays
  if (!Array.isArray(d.stateTaxInfo)) return false
  if (!Array.isArray(d.localTaxInfo)) return false

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false
  if (typeof d.iraSepSimple !== 'boolean') return false
  if (typeof d.taxableAmountNotDetermined !== 'boolean') return false
  if (typeof d.totalDistribution !== 'boolean') return false

  // Validate key numeric field (allow null or number)
  if (d.grossDistribution !== null && typeof d.grossDistribution !== 'number') return false

  return true
}

/**
 * Vietnamese field labels for 1099-R
 */
export const FORM_1099_R_FIELD_LABELS_VI: Record<string, string> = {
  payerName: 'Tên Quỹ hưu trí',
  payerAddress: 'Địa chỉ Quỹ hưu trí',
  payerTIN: 'EIN Quỹ hưu trí',
  recipientName: 'Tên Người nhận',
  recipientAddress: 'Địa chỉ Người nhận',
  recipientTIN: 'SSN Người nhận',
  accountNumber: 'Số tài khoản',
  grossDistribution: 'Tổng phân phối (Box 1)',
  taxableAmount: 'Số tiền chịu thuế (Box 2a)',
  taxableAmountNotDetermined: 'Số thuế chưa xác định (Box 2b)',
  totalDistribution: 'Phân phối toàn bộ (Box 2b)',
  capitalGain: 'Lãi vốn (Box 3)',
  federalIncomeTaxWithheld: 'Thuế Liên bang đã khấu trừ (Box 4)',
  employeeContributions: 'Đóng góp nhân viên (Box 5)',
  distributionCodes: 'Mã phân phối (Box 7)',
  iraSepSimple: 'IRA/SEP/SIMPLE',
  stateTaxWithheld: 'Thuế Tiểu bang đã khấu trừ',
  localTaxWithheld: 'Thuế địa phương đã khấu trừ',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
