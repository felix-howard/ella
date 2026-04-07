/**
 * 1099-B OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-B (Proceeds from Broker and Barter Exchange Transactions)
 * Reports proceeds from sales of stocks, bonds, and other securities.
 */

/**
 * 1099-B extracted data structure
 * Matches IRS Form 1099-B box layout
 */
export interface Form1099BExtractedData {
  // Payer Information (Broker)
  payerName: string | null
  payerAddress: string | null
  payerTIN: string | null

  // Recipient Information
  recipientName: string | null
  recipientAddress: string | null
  recipientTIN: string | null // SSN
  accountNumber: string | null

  // Transaction Details (one or more)
  transactions: Array<{
    description: string | null // Box 1a - Description of property
    dateAcquired: string | null // Box 1b - Date acquired
    dateSold: string | null // Box 1c - Date sold or disposed
    proceeds: number | null // Box 1d - Proceeds (CRITICAL - taxable amount)
    costBasis: number | null // Box 1e - Cost or other basis (CRITICAL - for gain/loss)
    adjustmentCode: string | null // Box 1f - Accrued market discount / wash sale code
    adjustmentAmount: number | null // Box 1g - Adjustment amount
    gainLoss: number | null // Box 1h - Realized gain or loss
    shortTermLongTerm: 'SHORT' | 'LONG' | null // Holding period classification
    coveredSecurity: boolean // Box 5 - Noncovered security checkbox (false = covered)
    reportedToIRS: 'GROSS' | 'NET' | null // Box 6 - Reported to IRS: gross or net proceeds
  }>

  // Summary / Other Boxes
  federalIncomeTaxWithheld: number | null // Box 4 - Federal income tax withheld
  profitOnClosedContracts: number | null // Box 8 - Profit or (loss) realized in current year on closed contracts
  unrealizedProfitPrior: number | null // Box 9 - Unrealized profit or (loss) on open contracts - prior year
  unrealizedProfitCurrent: number | null // Box 10 - Unrealized profit or (loss) on open contracts - current year

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
 * Generate 1099-B OCR extraction prompt
 */
export function get1099BExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-B (Proceeds from Broker and Barter Exchange Transactions).

IMPORTANT: This form reports proceeds from security sales. Box 1d (proceeds) and Box 1e (cost basis) are critical for gain/loss calculation.

Extract the following fields:

PAYER INFORMATION (Broker):
- payerName: Broker/financial institution name
- payerAddress: Broker address
- payerTIN: Broker's EIN

RECIPIENT INFORMATION:
- recipientName: Taxpayer's name
- recipientAddress: Taxpayer's address
- recipientTIN: Taxpayer's SSN (XXX-XX-XXXX)
- accountNumber: Brokerage account number

TRANSACTIONS (may be single entry or array):
- description: Box 1a - Description of property sold (e.g., "100 SH XYZ CORP")
- dateAcquired: Box 1b - Date acquired (MM/DD/YYYY)
- dateSold: Box 1c - Date sold or disposed (MM/DD/YYYY)
- proceeds: Box 1d - Gross proceeds (CRITICAL - taxable proceeds)
- costBasis: Box 1e - Cost or other basis (CRITICAL - used for gain/loss calculation)
- adjustmentCode: Box 1f - Wash sale loss disallowed or accrued market discount code
- adjustmentAmount: Box 1g - Adjustment amount
- gainLoss: Box 1h - Realized gain or loss
- shortTermLongTerm: "SHORT" if held ≤1 year, "LONG" if held >1 year, null if unknown
- coveredSecurity: Box 5 - false if covered security (broker reports basis), true if noncovered
- reportedToIRS: Box 6 - "GROSS" or "NET" proceeds reported to IRS

OTHER BOXES:
- federalIncomeTaxWithheld: Box 4 - Federal income tax withheld
- profitOnClosedContracts: Box 8 - Profit or (loss) on closed contracts
- unrealizedProfitPrior: Box 9 - Unrealized profit/loss on open contracts (prior year)
- unrealizedProfitCurrent: Box 10 - Unrealized profit/loss on open contracts (current year)

STATE TAX:
- stateTaxInfo: Array of { state, stateId, stateTaxWithheld }

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "payerName": "ACME BROKERAGE LLC",
  "payerAddress": "100 Broker St, New York, NY 10001",
  "payerTIN": "XX-XXXXXXX",
  "recipientName": "JOHN DOE",
  "recipientAddress": "123 Main St, City, ST 12345",
  "recipientTIN": "XXX-XX-XXXX",
  "accountNumber": "1234-5678",
  "transactions": [
    {
      "description": "100 SH XYZ CORP",
      "dateAcquired": "01/15/2023",
      "dateSold": "08/20/2024",
      "proceeds": 5000.00,
      "costBasis": 3500.00,
      "adjustmentCode": null,
      "adjustmentAmount": null,
      "gainLoss": 1500.00,
      "shortTermLongTerm": "LONG",
      "coveredSecurity": false,
      "reportedToIRS": "GROSS"
    }
  ],
  "federalIncomeTaxWithheld": null,
  "profitOnClosedContracts": null,
  "unrealizedProfitPrior": null,
  "unrealizedProfitCurrent": null,
  "stateTaxInfo": [
    {"state": "CA", "stateId": "XXX-XXXX", "stateTaxWithheld": null}
  ],
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 1d (proceeds) is the taxable amount received from the sale
2. Box 1e (cost basis) is subtracted from proceeds to determine gain or loss
3. Transactions may be a single entry or an array — always return as array
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-B extracted data
 */
export function validate1099BData(data: unknown): data is Form1099BExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['payerName', 'recipientTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate arrays
  if (!Array.isArray(d.transactions)) return false
  if (!Array.isArray(d.stateTaxInfo)) return false

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for 1099-B
 */
export const FORM_1099_B_FIELD_LABELS_VI: Record<string, string> = {
  payerName: 'Tên Nhà môi giới/Tổ chức tài chính',
  payerAddress: 'Địa chỉ Nhà môi giới',
  payerTIN: 'EIN Nhà môi giới',
  recipientName: 'Tên Người nhận',
  recipientAddress: 'Địa chỉ Người nhận',
  recipientTIN: 'SSN Người nhận',
  accountNumber: 'Số tài khoản',
  transactions: 'Danh sách giao dịch',
  description: 'Mô tả tài sản (Box 1a)',
  dateAcquired: 'Ngày mua (Box 1b)',
  dateSold: 'Ngày bán (Box 1c)',
  proceeds: 'Tiền thu về (Box 1d)',
  costBasis: 'Giá vốn (Box 1e)',
  adjustmentCode: 'Mã điều chỉnh (Box 1f)',
  adjustmentAmount: 'Số tiền điều chỉnh (Box 1g)',
  gainLoss: 'Lãi/Lỗ thực hiện (Box 1h)',
  shortTermLongTerm: 'Ngắn hạn/Dài hạn',
  coveredSecurity: 'Chứng khoán không được bảo hộ (Box 5)',
  reportedToIRS: 'Báo cáo IRS: Gộp/Ròng (Box 6)',
  federalIncomeTaxWithheld: 'Thuế Liên bang đã khấu trừ (Box 4)',
  profitOnClosedContracts: 'Lãi/Lỗ hợp đồng đã đóng (Box 8)',
  unrealizedProfitPrior: 'Lãi/Lỗ chưa thực hiện - năm trước (Box 9)',
  unrealizedProfitCurrent: 'Lãi/Lỗ chưa thực hiện - năm hiện tại (Box 10)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
