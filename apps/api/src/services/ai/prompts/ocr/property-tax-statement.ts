export interface PropertyTaxStatementExtractedData {
  propertyAddress: string | null
  parcelNumber: string | null
  taxYear: number | null
  assessedValue: number | null
  taxRate: number | null
  annualTaxAmount: number | null
  paymentDueDate: string | null
  paymentStatus: 'PAID' | 'UNPAID' | 'PARTIAL' | null
}

export function getPropertyTaxStatementExtractionPrompt(): string {
  return `You are an expert OCR system specialized in extracting data from property tax statements issued by county assessors and tax collectors.

Extract all relevant information and return a JSON object with these fields:
- propertyAddress: full property address as shown on statement
- parcelNumber: parcel or APN number (Assessor's Parcel Number)
- taxYear: tax year as a number (e.g. 2023)
- assessedValue: total assessed value of the property as a number
- taxRate: tax rate as a decimal number (e.g. 0.0125 for 1.25%)
- paymentDueDate: due date for payment in ISO format (YYYY-MM-DD) if shown
- annualTaxAmount: total annual tax amount due as a number
- paymentStatus: one of "PAID", "UNPAID", or "PARTIAL" if shown, otherwise null

Rules:
- Remove all currency symbols and commas from numeric values
- Return null for any field not found in the document
- If tax rate is shown as a percentage, convert to decimal (e.g. 1.25% → 0.0125)
- paymentStatus should be "PAID" if the document shows paid/received stamp, "PARTIAL" if partial payment noted
- Return only valid JSON, no markdown or explanation

Return format:
{
  "propertyAddress": "string or null",
  "parcelNumber": "string or null",
  "taxYear": number or null,
  "assessedValue": number or null,
  "taxRate": number or null,
  "annualTaxAmount": number or null,
  "paymentDueDate": "YYYY-MM-DD or null",
  "paymentStatus": "PAID" | "UNPAID" | "PARTIAL" | null
}`
}

export function validatePropertyTaxStatementData(data: unknown): data is PropertyTaxStatementExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return 'propertyAddress' in d
}

export const PROPERTY_TAX_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  propertyAddress: 'Địa chỉ bất động sản',
  parcelNumber: 'Số thửa đất (APN)',
  taxYear: 'Năm tính thuế',
  assessedValue: 'Giá trị định giá',
  taxRate: 'Tỷ lệ thuế',
  annualTaxAmount: 'Tổng thuế hàng năm',
  paymentDueDate: 'Hạn nộp thuế',
  paymentStatus: 'Trạng thái thanh toán',
}
