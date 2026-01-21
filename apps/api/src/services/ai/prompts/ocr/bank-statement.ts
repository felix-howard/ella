/**
 * Bank Statement OCR Extraction Prompt
 * Extracts structured data from bank statements for business expense tracking
 * Critical for nail salon businesses to document cash flow and expenses
 */

/**
 * Bank Statement extracted data structure
 */
export interface BankStatementExtractedData {
  // Bank and Account Information
  bankName: string | null
  bankAddress: string | null
  accountNumber: string | null // Usually last 4 digits shown
  accountType: 'CHECKING' | 'SAVINGS' | 'BUSINESS' | null

  // Account Holder Information
  accountHolderName: string | null
  accountHolderAddress: string | null

  // Statement Period
  statementPeriodStart: string | null // Format: MM/DD/YYYY
  statementPeriodEnd: string | null // Format: MM/DD/YYYY

  // Summary Balances
  beginningBalance: number | null
  endingBalance: number | null
  totalDeposits: number | null
  totalWithdrawals: number | null

  // Transaction Summary (aggregated)
  depositCount: number | null
  withdrawalCount: number | null

  // Key Transactions (top deposits/withdrawals)
  largeDeposits: Array<{
    date: string | null
    description: string | null
    amount: number | null
  }>

  largeWithdrawals: Array<{
    date: string | null
    description: string | null
    amount: number | null
  }>

  // Fees and Interest
  totalFees: number | null
  interestEarned: number | null

  // Metadata
  pageNumber: number | null
  totalPages: number | null
}

/**
 * Generate Bank Statement OCR extraction prompt
 */
export function getBankStatementExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from U.S. bank statements. Extract key financial summary information from this bank statement.

IMPORTANT: This is a financial document for tax preparation. Accuracy is critical. If a value is unclear, use null rather than guessing.

Extract the following fields:

BANK AND ACCOUNT INFO (Header):
- bankName: Name of the bank (e.g., "Chase", "Bank of America", "Wells Fargo")
- bankAddress: Bank address if shown
- accountNumber: Account number (usually last 4 digits shown like "****1234")
- accountType: "CHECKING", "SAVINGS", or "BUSINESS"

ACCOUNT HOLDER:
- accountHolderName: Name on the account
- accountHolderAddress: Account holder's address

STATEMENT PERIOD:
- statementPeriodStart: Start date of statement period
- statementPeriodEnd: End date of statement period

SUMMARY BALANCES (Usually at top or in summary section):
- beginningBalance: Opening/beginning balance for the period
- endingBalance: Closing/ending balance for the period
- totalDeposits: Total deposits/credits for the period
- totalWithdrawals: Total withdrawals/debits for the period

TRANSACTION COUNTS:
- depositCount: Number of deposits
- withdrawalCount: Number of withdrawals

LARGE TRANSACTIONS (Extract up to 5 largest each):
- largeDeposits: Array of largest deposits with {date, description, amount}
- largeWithdrawals: Array of largest withdrawals with {date, description, amount}

FEES AND INTEREST:
- totalFees: Total fees charged
- interestEarned: Interest earned (usually for savings)

METADATA:
- pageNumber: Current page number
- totalPages: Total pages in statement

Respond in JSON format:
{
  "bankName": "Chase Bank",
  "bankAddress": "123 Bank St, City, ST 12345",
  "accountNumber": "****1234",
  "accountType": "BUSINESS",
  "accountHolderName": "ABC Nail Salon LLC",
  "accountHolderAddress": "456 Main St, City, ST 67890",
  "statementPeriodStart": "01/01/2024",
  "statementPeriodEnd": "01/31/2024",
  "beginningBalance": 15000.00,
  "endingBalance": 18500.00,
  "totalDeposits": 25000.00,
  "totalWithdrawals": 21500.00,
  "depositCount": 45,
  "withdrawalCount": 38,
  "largeDeposits": [
    {"date": "01/15/2024", "description": "Square Inc Deposit", "amount": 8500.00},
    {"date": "01/22/2024", "description": "Cash Deposit", "amount": 5000.00}
  ],
  "largeWithdrawals": [
    {"date": "01/05/2024", "description": "Rent Payment", "amount": 3500.00},
    {"date": "01/10/2024", "description": "Supply Purchase", "amount": 2000.00}
  ],
  "totalFees": 25.00,
  "interestEarned": null,
  "pageNumber": 1,
  "totalPages": 3
}

Rules:
1. All monetary values should be numbers without $ or commas
2. Use null for unclear or missing fields, NEVER guess
3. Focus on SUMMARY data, not individual transactions
4. Large transactions: Extract top 5 deposits and withdrawals by amount
5. Account number usually shows only last 4 digits for security
6. Common deposits for nail salons: Square, Clover, PayPal, Cash deposits
7. Common withdrawals: Rent, Supplies, Payroll, Utilities`
}

/**
 * Validate Bank Statement extracted data
 * Checks structure, field existence, and types (allowing null for optional values)
 */
export function validateBankStatementData(data: unknown): data is BankStatementExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists (values can be null)
  const requiredFields = ['bankName', 'accountNumber', 'beginningBalance', 'endingBalance']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate arrays
  if (!Array.isArray(d.largeDeposits)) return false
  if (!Array.isArray(d.largeWithdrawals)) return false

  // Type validation for key numeric fields (allow null or number)
  if (d.beginningBalance !== null && typeof d.beginningBalance !== 'number') return false
  if (d.endingBalance !== null && typeof d.endingBalance !== 'number') return false
  if (d.totalDeposits !== null && d.totalDeposits !== undefined && typeof d.totalDeposits !== 'number') return false
  if (d.totalWithdrawals !== null && d.totalWithdrawals !== undefined && typeof d.totalWithdrawals !== 'number') return false

  return true
}

/**
 * Get field labels in Vietnamese for Bank Statement
 */
export const BANK_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  bankName: 'Tên Ngân hàng',
  bankAddress: 'Địa chỉ Ngân hàng',
  accountNumber: 'Số Tài khoản',
  accountType: 'Loại Tài khoản',
  accountHolderName: 'Tên Chủ Tài khoản',
  accountHolderAddress: 'Địa chỉ Chủ Tài khoản',
  statementPeriodStart: 'Ngày bắt đầu kỳ sao kê',
  statementPeriodEnd: 'Ngày kết thúc kỳ sao kê',
  beginningBalance: 'Số dư đầu kỳ',
  endingBalance: 'Số dư cuối kỳ',
  totalDeposits: 'Tổng tiền gửi',
  totalWithdrawals: 'Tổng tiền rút',
  depositCount: 'Số lần gửi',
  withdrawalCount: 'Số lần rút',
  largeDeposits: 'Các khoản gửi lớn',
  largeWithdrawals: 'Các khoản rút lớn',
  totalFees: 'Tổng phí',
  interestEarned: 'Lãi suất nhận được',
  pageNumber: 'Trang số',
  totalPages: 'Tổng số trang',
}
