export interface ForeignBankStatementExtractedData {
  bankName: string | null
  bankCountry: string | null
  accountNumber: string | null
  accountHolderName: string | null
  accountCurrency: string | null
  beginningBalance: number | null
  endingBalance: number | null
  maxBalanceDuringYear: number | null
  statementPeriod: string | null
}

export function getForeignBankStatementExtractionPrompt(): string {
  return `You are an expert OCR system specializing in foreign bank and financial account statements from international banks worldwide.

Extract all available data from this foreign bank statement and return a JSON object with these fields:

- bankName: Full name of the foreign bank or financial institution (string)
- bankCountry: Country where the bank is located (string)
- accountNumber: Account number or IBAN (string, mask all but last 4 digits if partially visible)
- accountHolderName: Full legal name of the account holder (string)
- accountCurrency: Currency code of the account, e.g. EUR, GBP, CAD (string)
- beginningBalance: Account balance at the start of the statement period in the account currency (number)
- endingBalance: Account balance at the end of the statement period in the account currency (number)
- maxBalanceDuringYear: Maximum balance at any point during the year in the account currency (number) — required for FBAR (FinCEN Form 114) reporting; US persons must report foreign accounts exceeding $10,000 at any time during the year
- statementPeriod: Date range this statement covers, e.g. "January 1 - December 31, 2023" (string)

Rules:
- All balance amounts must be numbers without currency symbols or commas
- FBAR threshold: US persons must file if aggregate foreign account values exceeded $10,000 USD at any point during the tax year
- If a field is not present in the document, use null
- Do not convert foreign currency amounts to USD unless already shown in USD
- Return only valid JSON, no markdown or explanation

Return JSON format:
{
  "bankName": "string or null",
  "bankCountry": "string or null",
  "accountNumber": "string or null",
  "accountHolderName": "string or null",
  "accountCurrency": "string or null",
  "beginningBalance": number or null,
  "endingBalance": number or null,
  "maxBalanceDuringYear": number or null,
  "statementPeriod": "string or null"
}`
}

export function validateForeignBankStatementData(data: unknown): data is ForeignBankStatementExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return 'accountHolderName' in d
}

export const FOREIGN_BANK_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  bankName: 'Tên ngân hàng',
  bankCountry: 'Quốc gia ngân hàng',
  accountNumber: 'Số tài khoản',
  accountHolderName: 'Tên chủ tài khoản',
  accountCurrency: 'Loại tiền tệ',
  beginningBalance: 'Số dư đầu kỳ',
  endingBalance: 'Số dư cuối kỳ',
  maxBalanceDuringYear: 'Số dư cao nhất trong năm',
  statementPeriod: 'Kỳ sao kê',
}
