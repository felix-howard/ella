/**
 * IRA Statement OCR Extraction Prompt
 * Extracts structured data from Traditional/SEP/SIMPLE IRA account statements
 */

export interface IraStatementExtractedData {
  custodianName: string | null
  accountNumber: string | null
  accountHolderName: string | null
  accountType: 'TRADITIONAL' | 'SEP' | 'SIMPLE' | null
  taxYear: number | null
  contributions: number | null
  rolloversIn: number | null
  distributions: number | null
  fairMarketValue: number | null
  rmdAmount: number | null
}

export function getIraStatementExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from U.S. IRA (Individual Retirement Account) statements. Extract key account and contribution information accurately.

IMPORTANT: This is a financial document for tax preparation. Accuracy is critical. If a value is unclear, use null rather than guessing.

Extract the following fields:

CUSTODIAN AND ACCOUNT INFO:
- custodianName: Name of the financial institution holding the IRA (e.g., "Fidelity", "Vanguard", "Schwab")
- accountNumber: Account number (may be partially masked)
- accountHolderName: Name of the IRA account owner
- accountType: "TRADITIONAL", "SEP", or "SIMPLE" — look for explicit labels on the statement

TAX YEAR AND CONTRIBUTIONS:
- taxYear: The tax year this statement covers (e.g., 2024)
- contributions: Total contributions made during the tax year
- rolloversIn: Total rollover amounts received into this IRA

DISTRIBUTIONS:
- distributions: Total distributions/withdrawals taken during the year

YEAR-END VALUES:
- fairMarketValue: Fair market value of the account at year end (reported on Form 5498)
- rmdAmount: Required Minimum Distribution amount if applicable

Respond in JSON format:
{
  "custodianName": "Vanguard",
  "accountNumber": "****9012",
  "accountHolderName": "Robert Johnson",
  "accountType": "TRADITIONAL",
  "taxYear": 2024,
  "contributions": 7000.00,
  "rolloversIn": 0.00,
  "distributions": 1500.00,
  "fairMarketValue": 145000.00,
  "rmdAmount": null
}

Rules:
1. All monetary values should be numbers without $ or commas
2. Use null for unclear or missing fields, NEVER guess
3. taxYear should be a 4-digit integer
4. accountType must be exactly "TRADITIONAL", "SEP", or "SIMPLE" — null if unclear
5. rmdAmount only applies if account owner is 73+ years old`
}

export function validateIraStatementData(data: unknown): data is IraStatementExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('accountHolderName' in d)) return false
  if (!('custodianName' in d)) return false
  if (!('fairMarketValue' in d)) return false
  if (d.taxYear !== null && typeof d.taxYear !== 'number') return false
  if (d.contributions !== null && typeof d.contributions !== 'number') return false
  if (d.fairMarketValue !== null && typeof d.fairMarketValue !== 'number') return false
  if (d.accountType !== undefined && d.accountType !== null && d.accountType !== 'TRADITIONAL' && d.accountType !== 'SEP' && d.accountType !== 'SIMPLE') return false
  return true
}

export const IRA_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  custodianName: 'Tên Tổ chức Lưu ký',
  accountNumber: 'Số Tài khoản',
  accountHolderName: 'Tên Chủ Tài khoản',
  accountType: 'Loại Tài khoản IRA',
  taxYear: 'Năm Thuế',
  contributions: 'Đóng góp',
  rolloversIn: 'Chuyển vào (Rollover)',
  distributions: 'Phân phối/Rút tiền',
  fairMarketValue: 'Giá trị Thị trường Hợp lý',
  rmdAmount: 'Số tiền RMD Bắt buộc',
}
