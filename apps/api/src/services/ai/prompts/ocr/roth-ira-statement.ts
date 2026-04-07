/**
 * Roth IRA Statement OCR Extraction Prompt
 * Extracts structured data from Roth IRA account statements
 */

export interface RothIraStatementExtractedData {
  custodianName: string | null
  accountNumber: string | null
  accountHolderName: string | null
  taxYear: number | null
  contributions: number | null
  conversions: number | null
  distributions: number | null
  fairMarketValue: number | null
  totalBasis: number | null
}

export function getRothIraStatementExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from U.S. Roth IRA account statements. Extract key account and contribution information accurately.

IMPORTANT: This is a financial document for tax preparation. Accuracy is critical. If a value is unclear, use null rather than guessing.

Extract the following fields:

CUSTODIAN AND ACCOUNT INFO:
- custodianName: Name of the financial institution holding the Roth IRA (e.g., "Fidelity", "Schwab", "Vanguard")
- accountNumber: Account number (may be partially masked)
- accountHolderName: Name of the Roth IRA account owner

TAX YEAR:
- taxYear: The tax year this statement covers (e.g., 2024)

CONTRIBUTIONS AND CONVERSIONS:
- contributions: Direct Roth IRA contributions made during the tax year
- conversions: Amounts converted from Traditional IRA to Roth IRA during the year

DISTRIBUTIONS:
- distributions: Total distributions/withdrawals taken during the year

YEAR-END VALUES:
- fairMarketValue: Fair market value of the Roth IRA at year end (reported on Form 5498)
- totalBasis: Cumulative total basis (after-tax contributions + conversions) in the Roth IRA

Respond in JSON format:
{
  "custodianName": "Charles Schwab",
  "accountNumber": "****3456",
  "accountHolderName": "Emily Chen",
  "taxYear": 2024,
  "contributions": 7000.00,
  "conversions": 15000.00,
  "distributions": 0.00,
  "fairMarketValue": 92000.00,
  "totalBasis": 55000.00
}

Rules:
1. All monetary values should be numbers without $ or commas
2. Use null for unclear or missing fields, NEVER guess
3. taxYear should be a 4-digit integer
4. conversions come from Form 5498 Box 3 or the "Roth Conversions" section
5. totalBasis is cumulative across all years, not just current year
6. Qualified distributions from Roth IRA are tax-free; note distributions regardless`
}

export function validateRothIraStatementData(data: unknown): data is RothIraStatementExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('accountHolderName' in d)) return false
  if (!('custodianName' in d)) return false
  if (!('fairMarketValue' in d)) return false
  if (d.taxYear !== null && typeof d.taxYear !== 'number') return false
  if (d.contributions !== null && typeof d.contributions !== 'number') return false
  if (d.fairMarketValue !== null && typeof d.fairMarketValue !== 'number') return false
  return true
}

export const ROTH_IRA_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  custodianName: 'Tên Tổ chức Lưu ký',
  accountNumber: 'Số Tài khoản',
  accountHolderName: 'Tên Chủ Tài khoản',
  taxYear: 'Năm Thuế',
  contributions: 'Đóng góp Roth IRA',
  conversions: 'Chuyển đổi sang Roth IRA',
  distributions: 'Phân phối/Rút tiền',
  fairMarketValue: 'Giá trị Thị trường Hợp lý',
  totalBasis: 'Tổng Cơ sở Chi phí',
}
