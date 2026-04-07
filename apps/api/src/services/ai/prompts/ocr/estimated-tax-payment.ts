export interface EstimatedTaxPaymentExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null
  taxYear: number | null
  quarter: number | null
  paymentAmount: number | null
  paymentDate: string | null
  confirmationNumber: string | null
  paymentMethod: string | null
}

export function getEstimatedTaxPaymentExtractionPrompt(): string {
  return `You are an expert OCR system specialized in extracting data from estimated tax payment vouchers and receipts (IRS Form 1040-ES and state equivalents).

Extract all relevant information and return a JSON object with these fields:
- taxpayerName: full name of the taxpayer as shown on the document
- taxpayerSSN: Social Security Number in format XXX-XX-XXXX, or null if not shown
- taxYear: tax year the payment applies to as a number (e.g. 2023)
- quarter: payment quarter as a number 1 through 4 (Q1=1, Q2=2, Q3=3, Q4=4)
- paymentAmount: dollar amount of the payment as a number
- paymentDate: date payment was made or received in ISO format (YYYY-MM-DD)
- confirmationNumber: confirmation or reference number if shown
- paymentMethod: payment method (e.g. "Check", "Electronic", "EFTPS", "Credit Card")

Rules:
- Remove all currency symbols and commas from numeric values
- Return null for any field not found in the document
- SSN should be masked — keep only last 4 digits visible if partially masked (e.g. "XXX-XX-1234")
- Quarter can be inferred from due date: Apr 15=Q1, Jun 15=Q2, Sep 15=Q3, Jan 15=Q4
- Return only valid JSON, no markdown or explanation

Return format:
{
  "taxpayerName": "string or null",
  "taxpayerSSN": "string or null",
  "taxYear": number or null,
  "quarter": number or null,
  "paymentAmount": number or null,
  "paymentDate": "YYYY-MM-DD or null",
  "confirmationNumber": "string or null",
  "paymentMethod": "string or null"
}`
}

export function validateEstimatedTaxPaymentData(data: unknown): data is EstimatedTaxPaymentExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return 'taxpayerName' in d
}

export const ESTIMATED_TAX_PAYMENT_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên người nộp thuế',
  taxpayerSSN: 'Số An sinh xã hội (SSN)',
  taxYear: 'Năm tính thuế',
  quarter: 'Quý nộp thuế',
  paymentAmount: 'Số tiền nộp',
  paymentDate: 'Ngày nộp',
  confirmationNumber: 'Số xác nhận',
  paymentMethod: 'Phương thức thanh toán',
}
