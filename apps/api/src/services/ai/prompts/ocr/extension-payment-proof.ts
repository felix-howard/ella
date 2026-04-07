export interface ExtensionPaymentProofExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null
  taxYear: number | null
  paymentAmount: number | null
  paymentDate: string | null
  confirmationNumber: string | null
  paymentMethod: string | null
}

export function getExtensionPaymentProofExtractionPrompt(): string {
  return `You are an expert OCR system specializing in IRS tax extension payment confirmations, including IRS Direct Pay receipts, EFTPS payment confirmations, and estimated tax payment records for Form 4868 (Automatic Extension of Time to File).

Extract all available data from this extension payment proof document and return a JSON object with these fields:

- taxpayerName: Full legal name of the taxpayer as shown on the payment record (string)
- taxpayerSSN: Taxpayer's Social Security Number or Individual Taxpayer Identification Number (string, format XXX-XX-XXXX; mask first 5 digits if partially shown, e.g. XXX-XX-1234)
- taxYear: The tax year for which the extension payment was made (number, e.g. 2023)
- paymentAmount: Dollar amount of the extension payment submitted in USD (number)
- paymentDate: Date the payment was made or processed, e.g. "April 15, 2024" (string)
- confirmationNumber: IRS-issued confirmation or trace number for the payment (string)
- paymentMethod: Payment method used, e.g. IRS Direct Pay, EFTPS, check, credit card (string)

Rules:
- All dollar amounts must be numbers without currency symbols or commas
- Form 4868 grants a 6-month filing extension but does NOT extend the deadline to pay taxes owed — interest and penalties apply to unpaid balances after the original due date
- Extract the SSN exactly as shown; preserve masking if present in the document
- If a field is not present in the document, use null
- Return only valid JSON, no markdown or explanation

Return JSON format:
{
  "taxpayerName": "string or null",
  "taxpayerSSN": "string or null",
  "taxYear": number or null,
  "paymentAmount": number or null,
  "paymentDate": "string or null",
  "confirmationNumber": "string or null",
  "paymentMethod": "string or null"
}`
}

export function validateExtensionPaymentProofData(data: unknown): data is ExtensionPaymentProofExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return 'taxpayerName' in d
}

export const EXTENSION_PAYMENT_PROOF_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên người nộp thuế',
  taxpayerSSN: 'Số an sinh xã hội (SSN)',
  taxYear: 'Năm thuế',
  paymentAmount: 'Số tiền thanh toán',
  paymentDate: 'Ngày thanh toán',
  confirmationNumber: 'Số xác nhận',
  paymentMethod: 'Phương thức thanh toán',
}
