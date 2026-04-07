export interface PmiStatementExtractedData {
  policyNumber: string | null
  insurerName: string | null
  propertyAddress: string | null
  annualPremium: number | null
  monthlyPremium: number | null
  ltvRatio: number | null
  cancellationDate: string | null
}

export function getPmiStatementExtractionPrompt(): string {
  return `You are an expert OCR system specialized in extracting data from Private Mortgage Insurance (PMI) statements and certificates.

Extract all available fields and return a JSON object with these fields:
- policyNumber: PMI policy or certificate number
- insurerName: name of the mortgage insurance company
- propertyAddress: full insured property address
- annualPremium: annual PMI premium as a number (no currency symbols)
- monthlyPremium: monthly PMI premium as a number
- ltvRatio: loan-to-value ratio as a decimal (e.g. 0.95 for 95%)
- cancellationDate: scheduled PMI cancellation date (YYYY-MM-DD format if possible)

Rules:
- Return ONLY valid JSON, no markdown or extra text
- Use null for missing or unreadable fields
- Convert all monetary values to plain numbers (remove $, commas)
- Convert percentages to decimals for ltvRatio

Example output:
{
  "policyNumber": "PMI-2024-789456",
  "insurerName": "MGIC Investment Corporation",
  "propertyAddress": "789 Pine Rd, Houston, TX 77001",
  "annualPremium": 1440,
  "monthlyPremium": 120,
  "ltvRatio": 0.95,
  "cancellationDate": "2031-06-01"
}`
}

export function validatePmiStatementData(data: unknown): data is PmiStatementExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return 'propertyAddress' in d
}

export const PMI_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  policyNumber: 'Số hợp đồng bảo hiểm',
  insurerName: 'Tên công ty bảo hiểm',
  propertyAddress: 'Địa chỉ bất động sản',
  annualPremium: 'Phí bảo hiểm hàng năm',
  monthlyPremium: 'Phí bảo hiểm hàng tháng',
  ltvRatio: 'Tỷ lệ vay trên giá trị (LTV)',
  cancellationDate: 'Ngày hủy bảo hiểm',
}
