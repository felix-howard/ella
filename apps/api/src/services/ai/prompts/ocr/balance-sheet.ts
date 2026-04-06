export interface BalanceSheetExtractedData {
  businessName: string | null
  reportDate: string | null
  totalAssets: number | null
  totalCurrentAssets: number | null
  totalFixedAssets: number | null
  totalLiabilities: number | null
  totalCurrentLiabilities: number | null
  totalLongTermLiabilities: number | null
  totalEquity: number | null
  retainedEarnings: number | null
}

export function getBalanceSheetExtractionPrompt(): string {
  return `You are an expert OCR system specialized in extracting data from business balance sheets (also called Statement of Financial Position).

Extract all relevant information and return a JSON object with these fields:
- businessName: name of the business or entity as shown on the balance sheet
- reportDate: the "as of" date of the balance sheet in ISO format (YYYY-MM-DD)
- totalAssets: total assets as a number
- totalCurrentAssets: total current assets as a number (cash, receivables, inventory, etc.)
- totalFixedAssets: total fixed/long-term assets as a number (property, equipment, etc.)
- totalLiabilities: total liabilities as a number
- totalCurrentLiabilities: total current liabilities as a number (due within 1 year)
- totalLongTermLiabilities: total long-term liabilities as a number (due after 1 year)
- totalEquity: total stockholders' or owner's equity as a number
- retainedEarnings: retained earnings balance as a number

Rules:
- Remove all currency symbols and commas from numeric values
- Return null for any field not found in the document
- totalAssets should equal totalLiabilities plus totalEquity (accounting equation)
- totalAssets should equal totalCurrentAssets plus totalFixedAssets if both are present
- Negative values should be represented as negative numbers
- Return only valid JSON, no markdown or explanation

Return format:
{
  "businessName": "string or null",
  "reportDate": "YYYY-MM-DD or null",
  "totalAssets": number or null,
  "totalCurrentAssets": number or null,
  "totalFixedAssets": number or null,
  "totalLiabilities": number or null,
  "totalCurrentLiabilities": number or null,
  "totalLongTermLiabilities": number or null,
  "totalEquity": number or null,
  "retainedEarnings": number or null
}`
}

export function validateBalanceSheetData(data: unknown): data is BalanceSheetExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return 'businessName' in d
}

export const BALANCE_SHEET_FIELD_LABELS_VI: Record<string, string> = {
  businessName: 'Tên doanh nghiệp',
  reportDate: 'Ngày lập bảng cân đối',
  totalAssets: 'Tổng tài sản',
  totalCurrentAssets: 'Tổng tài sản ngắn hạn',
  totalFixedAssets: 'Tổng tài sản dài hạn',
  totalLiabilities: 'Tổng nợ phải trả',
  totalCurrentLiabilities: 'Tổng nợ ngắn hạn',
  totalLongTermLiabilities: 'Tổng nợ dài hạn',
  totalEquity: 'Tổng vốn chủ sở hữu',
  retainedEarnings: 'Lợi nhuận giữ lại',
}
