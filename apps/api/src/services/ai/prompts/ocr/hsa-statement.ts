/**
 * HSA Statement OCR Extraction Prompt
 * Extracts structured data from Health Savings Account (HSA) statements
 */

export interface HsaStatementExtractedData {
  custodianName: string | null
  accountNumber: string | null
  accountHolderName: string | null
  taxYear: number | null
  employeeContributions: number | null
  employerContributions: number | null
  distributions: number | null
  qualifiedExpenses: number | null
  endingBalance: number | null
  investmentBalance: number | null
}

export function getHsaStatementExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from U.S. Health Savings Account (HSA) statements. Extract key account and contribution information accurately.

IMPORTANT: This is a financial document for tax preparation. Accuracy is critical. If a value is unclear, use null rather than guessing.

Extract the following fields:

CUSTODIAN AND ACCOUNT INFO:
- custodianName: Name of the HSA custodian/trustee (e.g., "HealthEquity", "Optum Bank", "Fidelity", "HSA Bank")
- accountNumber: Account number (may be partially masked)
- accountHolderName: Name of the HSA account holder

TAX YEAR:
- taxYear: The tax year this statement covers (e.g., 2024)

CONTRIBUTIONS:
- employeeContributions: Contributions made by the account holder/employee
- employerContributions: Contributions made by the employer on behalf of the employee

DISTRIBUTIONS:
- distributions: Total distributions/withdrawals from the HSA during the year
- qualifiedExpenses: Amount used for qualified medical expenses

BALANCES:
- endingBalance: Cash balance at end of the statement period
- investmentBalance: Value of any invested HSA funds (separate from cash balance)

Respond in JSON format:
{
  "custodianName": "HealthEquity",
  "accountNumber": "****2345",
  "accountHolderName": "Lisa Thompson",
  "taxYear": 2024,
  "employeeContributions": 2800.00,
  "employerContributions": 500.00,
  "distributions": 1200.00,
  "qualifiedExpenses": 1200.00,
  "endingBalance": 4100.00,
  "investmentBalance": 8500.00
}

Rules:
1. All monetary values should be numbers without $ or commas
2. Use null for unclear or missing fields, NEVER guess
3. taxYear should be a 4-digit integer
4. qualifiedExpenses should equal or be less than distributions
5. investmentBalance is null if no investment account exists
6. HSA contribution limits for 2024: $4,150 (self) / $8,300 (family)`
}

export function validateHsaStatementData(data: unknown): data is HsaStatementExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('accountHolderName' in d)) return false
  if (!('custodianName' in d)) return false
  if (!('endingBalance' in d)) return false
  if (d.taxYear !== null && typeof d.taxYear !== 'number') return false
  if (d.employeeContributions !== null && typeof d.employeeContributions !== 'number') return false
  if (d.endingBalance !== null && typeof d.endingBalance !== 'number') return false
  return true
}

export const HSA_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  custodianName: 'Tên Tổ chức Lưu ký HSA',
  accountNumber: 'Số Tài khoản',
  accountHolderName: 'Tên Chủ Tài khoản',
  taxYear: 'Năm Thuế',
  employeeContributions: 'Đóng góp của Nhân viên',
  employerContributions: 'Đóng góp của Chủ lao động',
  distributions: 'Phân phối/Rút tiền',
  qualifiedExpenses: 'Chi phí Y tế Hợp lệ',
  endingBalance: 'Số dư cuối kỳ',
  investmentBalance: 'Số dư Đầu tư',
}
