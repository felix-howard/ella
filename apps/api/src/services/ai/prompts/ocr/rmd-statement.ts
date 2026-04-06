/**
 * RMD Statement OCR Extraction Prompt
 * Extracts structured data from Required Minimum Distribution (RMD) notices and statements
 */

export interface RmdStatementExtractedData {
  accountType: string | null
  accountNumber: string | null
  accountHolder: string | null
  priorYearEndBalance: number | null
  divisorFactor: number | null
  rmdAmount: number | null
  distributionDate: string | null
  distributionsTaken: number | null
}

export function getRmdStatementExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from U.S. Required Minimum Distribution (RMD) notices and statements. Extract key RMD calculation information accurately.

IMPORTANT: This is a financial document for tax preparation. Accuracy is critical. If a value is unclear, use null rather than guessing.

Extract the following fields:

ACCOUNT INFORMATION:
- accountType: Type of retirement account (e.g., "Traditional IRA", "401(k)", "403(b)", "SEP IRA")
- accountNumber: Account number (may be partially masked)
- accountHolder: Name of the account owner

RMD CALCULATION:
- priorYearEndBalance: Account balance as of December 31 of the prior year (basis for RMD)
- divisorFactor: IRS life expectancy divisor/factor used to calculate RMD
- rmdAmount: Calculated Required Minimum Distribution amount for the year

DISTRIBUTIONS:
- distributionDate: Date the RMD was or is scheduled to be distributed (MM/DD/YYYY)
- distributionsTaken: Total distributions already taken so far this year

Respond in JSON format:
{
  "accountType": "Traditional IRA",
  "accountNumber": "****7890",
  "accountHolder": "George Martinez",
  "priorYearEndBalance": 320000.00,
  "divisorFactor": 24.6,
  "rmdAmount": 13008.13,
  "distributionDate": "12/31/2024",
  "distributionsTaken": 6000.00
}

Rules:
1. All monetary values should be numbers without $ or commas
2. Use null for unclear or missing fields, NEVER guess
3. divisorFactor comes from IRS Uniform Lifetime Table — typically between 1.9 and 27.4
4. rmdAmount = priorYearEndBalance / divisorFactor
5. distributionsTaken shows how much has already been distributed this year
6. distributionDate format: MM/DD/YYYY`
}

export function validateRmdStatementData(data: unknown): data is RmdStatementExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('accountHolder' in d)) return false
  if (!('rmdAmount' in d)) return false
  if (!('priorYearEndBalance' in d)) return false
  if (d.rmdAmount !== null && typeof d.rmdAmount !== 'number') return false
  if (d.priorYearEndBalance !== null && typeof d.priorYearEndBalance !== 'number') return false
  if (d.divisorFactor !== null && typeof d.divisorFactor !== 'number') return false
  return true
}

export const RMD_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  accountType: 'Loại Tài khoản',
  accountNumber: 'Số Tài khoản',
  accountHolder: 'Chủ Tài khoản',
  priorYearEndBalance: 'Số dư cuối năm Trước',
  divisorFactor: 'Hệ số Chia (IRS)',
  rmdAmount: 'Số tiền RMD Bắt buộc',
  distributionDate: 'Ngày Phân phối',
  distributionsTaken: 'Số tiền Đã phân phối',
}
