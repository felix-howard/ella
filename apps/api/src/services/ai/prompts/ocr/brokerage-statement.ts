/**
 * Brokerage Statement OCR Extraction Prompt
 * Extracts structured data from brokerage/investment account statements
 */

export interface BrokerageStatementExtractedData {
  brokerName: string | null
  accountNumber: string | null
  accountHolderName: string | null
  statementPeriod: string | null
  beginningBalance: number | null
  endingBalance: number | null
  totalDeposits: number | null
  totalWithdrawals: number | null
  dividendsReceived: number | null
  interestReceived: number | null
  realizedGains: number | null
  realizedLosses: number | null
  unrealizedGains: number | null
}

export function getBrokerageStatementExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from U.S. brokerage and investment account statements. Extract key financial summary information accurately.

IMPORTANT: This is a financial document for tax preparation. Accuracy is critical. If a value is unclear, use null rather than guessing.

Extract the following fields:

BROKER AND ACCOUNT INFO:
- brokerName: Name of the brokerage firm (e.g., "Fidelity", "Charles Schwab", "Vanguard", "TD Ameritrade")
- accountNumber: Account number (usually partially masked like "****1234")
- accountHolderName: Name on the account
- statementPeriod: Statement period (e.g., "January 1 - December 31, 2024")

SUMMARY BALANCES:
- beginningBalance: Portfolio value at start of period
- endingBalance: Portfolio value at end of period
- totalDeposits: Total cash deposits/contributions during period
- totalWithdrawals: Total cash withdrawals during period

INCOME:
- dividendsReceived: Total dividends received during period
- interestReceived: Total interest received during period

GAINS AND LOSSES:
- realizedGains: Total realized capital gains from sales
- realizedLosses: Total realized capital losses from sales
- unrealizedGains: Total unrealized gains (paper gains on current holdings)

Respond in JSON format:
{
  "brokerName": "Fidelity Investments",
  "accountNumber": "****5678",
  "accountHolderName": "John Smith",
  "statementPeriod": "January 1 - December 31, 2024",
  "beginningBalance": 50000.00,
  "endingBalance": 62500.00,
  "totalDeposits": 6000.00,
  "totalWithdrawals": 0.00,
  "dividendsReceived": 1200.00,
  "interestReceived": 150.00,
  "realizedGains": 4800.00,
  "realizedLosses": 550.00,
  "unrealizedGains": 900.00
}

Rules:
1. All monetary values should be numbers without $ or commas
2. Use null for unclear or missing fields, NEVER guess
3. Focus on SUMMARY data from account summary section
4. Realized gains/losses come from the trade confirmation or gains/losses section
5. Unrealized gains reflect current open positions`
}

export function validateBrokerageStatementData(data: unknown): data is BrokerageStatementExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('accountHolderName' in d)) return false
  if (!('brokerName' in d)) return false
  if (!('endingBalance' in d)) return false
  if (d.beginningBalance !== null && typeof d.beginningBalance !== 'number') return false
  if (d.endingBalance !== null && typeof d.endingBalance !== 'number') return false
  return true
}

export const BROKERAGE_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  brokerName: 'Tên Công ty Môi giới',
  accountNumber: 'Số Tài khoản',
  accountHolderName: 'Tên Chủ Tài khoản',
  statementPeriod: 'Kỳ Sao kê',
  beginningBalance: 'Số dư đầu kỳ',
  endingBalance: 'Số dư cuối kỳ',
  totalDeposits: 'Tổng tiền gửi',
  totalWithdrawals: 'Tổng tiền rút',
  dividendsReceived: 'Cổ tức nhận được',
  interestReceived: 'Lãi suất nhận được',
  realizedGains: 'Lãi vốn đã thực hiện',
  realizedLosses: 'Lỗ vốn đã thực hiện',
  unrealizedGains: 'Lãi vốn chưa thực hiện',
}
