export interface PriorYearReturnExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null
  taxYear: number | null
  filingStatus: string | null
  adjustedGrossIncome: number | null
  taxableIncome: number | null
  totalTax: number | null
  totalPayments: number | null
  refundAmount: number | null
  amountOwed: number | null
}

export function getPriorYearReturnExtractionPrompt(): string {
  return `You are an expert OCR system specialized in extracting data from prior year federal tax returns (IRS Form 1040 and variants).

Extract all relevant information and return a JSON object with these fields:
- taxpayerName: full name of primary taxpayer as shown on the return
- taxpayerSSN: Social Security Number in format XXX-XX-XXXX, or null if not shown
- taxYear: tax year of the return as a number (e.g. 2022)
- filingStatus: filing status (e.g. "Single", "Married Filing Jointly", "Married Filing Separately", "Head of Household", "Qualifying Surviving Spouse")
- adjustedGrossIncome: AGI amount as a number (Form 1040 Line 11)
- taxableIncome: taxable income as a number (Form 1040 Line 15)
- totalTax: total tax liability as a number (Form 1040 Line 24)
- totalPayments: total payments made as a number (Form 1040 Line 33)
- refundAmount: refund amount as a number if applicable (Form 1040 Line 35a), null if not applicable
- amountOwed: amount owed as a number if applicable (Form 1040 Line 37), null if not applicable

Rules:
- Remove all currency symbols and commas from numeric values
- Return null for any field not found in the document
- SSN should be masked — keep only last 4 digits visible if partially masked
- Both refundAmount and amountOwed may be null if not determinable
- Return only valid JSON, no markdown or explanation

Return format:
{
  "taxpayerName": "string or null",
  "taxpayerSSN": "string or null",
  "taxYear": number or null,
  "filingStatus": "string or null",
  "adjustedGrossIncome": number or null,
  "taxableIncome": number or null,
  "totalTax": number or null,
  "totalPayments": number or null,
  "refundAmount": number or null,
  "amountOwed": number or null
}`
}

export function validatePriorYearReturnData(data: unknown): data is PriorYearReturnExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return 'taxpayerName' in d
}

export const PRIOR_YEAR_RETURN_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên người nộp thuế',
  taxpayerSSN: 'Số An sinh xã hội (SSN)',
  taxYear: 'Năm tính thuế',
  filingStatus: 'Tình trạng khai thuế',
  adjustedGrossIncome: 'Thu nhập gộp điều chỉnh (AGI)',
  taxableIncome: 'Thu nhập chịu thuế',
  totalTax: 'Tổng thuế phải nộp',
  totalPayments: 'Tổng số tiền đã nộp',
  refundAmount: 'Số tiền hoàn thuế',
  amountOwed: 'Số tiền còn nợ',
}
