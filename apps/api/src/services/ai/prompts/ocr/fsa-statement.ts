/**
 * FSA Statement OCR Extraction Prompt
 * Extracts structured data from Flexible Spending Account (FSA) statements
 */

export interface FsaStatementExtractedData {
  planName: string | null
  employerName: string | null
  participantName: string | null
  accountType: 'HEALTH' | 'DEPENDENT_CARE' | 'LIMITED' | null
  taxYear: number | null
  annualElection: number | null
  contributions: number | null
  claims: number | null
  remainingBalance: number | null
  forfeitedAmount: number | null
}

export function getFsaStatementExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from U.S. Flexible Spending Account (FSA) statements. Extract key account and spending information accurately.

IMPORTANT: This is a financial document for tax preparation. Accuracy is critical. If a value is unclear, use null rather than guessing.

Extract the following fields:

PLAN AND PARTICIPANT INFO:
- planName: Name of the FSA plan (e.g., "ABC Corp Health FSA")
- employerName: Name of the employer sponsoring the FSA
- participantName: Name of the FSA participant/employee
- accountType: "HEALTH" (Healthcare FSA), "DEPENDENT_CARE" (Dependent Care FSA), or "LIMITED" (Limited Purpose FSA) — null if unclear

TAX YEAR:
- taxYear: The plan or tax year this statement covers (e.g., 2024)

ELECTIONS AND CONTRIBUTIONS:
- annualElection: Total annual election amount the participant chose at enrollment
- contributions: Total contributions made year-to-date

CLAIMS AND BALANCES:
- claims: Total claims submitted and approved during the period
- remainingBalance: Available balance remaining in the account
- forfeitedAmount: Amount forfeited under use-it-or-lose-it rule (if applicable, at plan year end)

Respond in JSON format:
{
  "planName": "Acme Corp Healthcare FSA",
  "employerName": "Acme Corporation",
  "participantName": "David Park",
  "accountType": "HEALTH",
  "taxYear": 2024,
  "annualElection": 3050.00,
  "contributions": 2541.67,
  "claims": 1875.00,
  "remainingBalance": 666.67,
  "forfeitedAmount": null
}

Rules:
1. All monetary values should be numbers without $ or commas
2. Use null for unclear or missing fields, NEVER guess
3. taxYear should be a 4-digit integer
4. accountType: "HEALTH" for medical FSA, "DEPENDENT_CARE" for childcare/elder care, "LIMITED" for dental/vision only
5. forfeitedAmount is typically null mid-year; appears at plan year end
6. 2024 Health FSA contribution limit: $3,200; Dependent Care: $5,000`
}

export function validateFsaStatementData(data: unknown): data is FsaStatementExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('participantName' in d)) return false
  if (!('planName' in d)) return false
  if (!('annualElection' in d)) return false
  if (d.taxYear !== null && typeof d.taxYear !== 'number') return false
  if (d.annualElection !== null && typeof d.annualElection !== 'number') return false
  if (d.remainingBalance !== null && typeof d.remainingBalance !== 'number') return false
  if (d.accountType !== undefined && d.accountType !== null && d.accountType !== 'HEALTH' && d.accountType !== 'DEPENDENT_CARE' && d.accountType !== 'LIMITED') return false
  return true
}

export const FSA_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  planName: 'Tên Kế hoạch FSA',
  employerName: 'Tên Nhà tuyển dụng',
  participantName: 'Tên Người tham gia',
  accountType: 'Loại Tài khoản FSA',
  taxYear: 'Năm Thuế',
  annualElection: 'Số tiền Bầu chọn Hàng năm',
  contributions: 'Đóng góp',
  claims: 'Yêu cầu Bồi thường',
  remainingBalance: 'Số dư Còn lại',
  forfeitedAmount: 'Số tiền Bị mất (Use-it-or-lose-it)',
}
