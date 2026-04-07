export interface MortgagePointsStatementExtractedData {
  lenderName: string | null
  propertyAddress: string | null
  loanAmount: number | null
  pointsAmount: number | null
  pointsPercentage: number | null
  closingDate: string | null
}

export function getMortgagePointsStatementExtractionPrompt(): string {
  return `You are an expert OCR system specialized in extracting data from mortgage discount points statements and loan cost disclosures.

Extract all available fields and return a JSON object with these fields:
- lenderName: name of the lending institution or bank
- propertyAddress: full property address associated with the loan
- loanAmount: total loan amount as a number (no currency symbols)
- pointsAmount: dollar amount paid for discount points as a number
- pointsPercentage: points as a percentage of the loan (e.g. 0.01 for 1 point = 1%)
- closingDate: loan closing or origination date (YYYY-MM-DD format if possible)

Rules:
- Return ONLY valid JSON, no markdown or extra text
- Use null for missing or unreadable fields
- Convert all monetary values to plain numbers (remove $, commas)
- Convert percentages to decimals for pointsPercentage (1 point = 0.01)

Example output:
{
  "lenderName": "Wells Fargo Bank, N.A.",
  "propertyAddress": "321 Elm St, San Antonio, TX 78201",
  "loanAmount": 280000,
  "pointsAmount": 2800,
  "pointsPercentage": 0.01,
  "closingDate": "2024-05-20"
}`
}

export function validateMortgagePointsStatementData(data: unknown): data is MortgagePointsStatementExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return 'lenderName' in d
}

export const MORTGAGE_POINTS_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  lenderName: 'Tên người cho vay',
  propertyAddress: 'Địa chỉ bất động sản',
  loanAmount: 'Số tiền vay',
  pointsAmount: 'Số tiền điểm chiết khấu',
  pointsPercentage: 'Tỷ lệ phần trăm điểm',
  closingDate: 'Ngày đóng vay',
}
