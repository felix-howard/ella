/**
 * 401(k) Statement OCR Extraction Prompt
 * Extracts structured data from 401(k) retirement plan statements
 */

export interface Statement401kExtractedData {
  planName: string | null
  employerName: string | null
  participantName: string | null
  accountBalance: number | null
  employeeContributions: number | null
  employerMatch: number | null
  vestedBalance: number | null
  loanBalance: number | null
  ytdContributions: number | null
  investmentReturns: number | null
}

export function get401kStatementExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from U.S. 401(k) retirement plan statements. Extract key account and contribution information accurately.

IMPORTANT: This is a financial document for tax preparation. Accuracy is critical. If a value is unclear, use null rather than guessing.

Extract the following fields:

PLAN AND PARTICIPANT INFO:
- planName: Name of the 401(k) plan (e.g., "XYZ Corp 401(k) Retirement Plan")
- employerName: Name of the employer sponsoring the plan
- participantName: Name of the plan participant/employee

ACCOUNT BALANCES:
- accountBalance: Total account balance (all sources)
- vestedBalance: Vested portion of total account balance
- loanBalance: Outstanding loan balance if any

CONTRIBUTIONS:
- employeeContributions: Employee's own contribution amount for the period
- employerMatch: Employer matching contribution amount for the period
- ytdContributions: Year-to-date total contributions (employee + employer)

PERFORMANCE:
- investmentReturns: Investment gains/losses for the period

Respond in JSON format:
{
  "planName": "Acme Corp 401(k) Plan",
  "employerName": "Acme Corporation",
  "participantName": "Sarah Williams",
  "accountBalance": 85000.00,
  "employeeContributions": 1500.00,
  "employerMatch": 750.00,
  "vestedBalance": 80000.00,
  "loanBalance": null,
  "ytdContributions": 13500.00,
  "investmentReturns": 6200.00
}

Rules:
1. All monetary values should be numbers without $ or commas
2. Use null for unclear or missing fields, NEVER guess
3. vestedBalance is usually less than or equal to accountBalance
4. loanBalance is null if no loans exist
5. investmentReturns may be negative (a loss) — represent as negative number`
}

export function validate401kStatementData(data: unknown): data is Statement401kExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('participantName' in d)) return false
  if (!('planName' in d)) return false
  if (!('accountBalance' in d)) return false
  if (d.accountBalance !== null && typeof d.accountBalance !== 'number') return false
  if (d.employeeContributions !== null && typeof d.employeeContributions !== 'number') return false
  if (d.vestedBalance !== null && typeof d.vestedBalance !== 'number') return false
  return true
}

export const STATEMENT_401K_FIELD_LABELS_VI: Record<string, string> = {
  planName: 'Tên Kế hoạch 401(k)',
  employerName: 'Tên Nhà tuyển dụng',
  participantName: 'Tên Người tham gia',
  accountBalance: 'Số dư Tài khoản',
  employeeContributions: 'Đóng góp của Nhân viên',
  employerMatch: 'Đóng góp Phù hợp của Chủ lao động',
  vestedBalance: 'Số dư Đã được quyền',
  loanBalance: 'Số dư Khoản vay',
  ytdContributions: 'Đóng góp Từ đầu năm',
  investmentReturns: 'Lợi nhuận Đầu tư',
}
