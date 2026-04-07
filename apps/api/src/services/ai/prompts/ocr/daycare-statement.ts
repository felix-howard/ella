export interface DaycareStatementExtractedData {
  providerName: string | null
  providerAddress: string | null
  providerTIN: string | null
  childName: string | null
  taxYear: number | null
  totalAmountPaid: number | null
  periodCovered: string | null
}

export function getDaycareStatementExtractionPrompt(): string {
  return `You are an expert OCR system specializing in daycare, preschool, after-school care, and dependent care provider statements used for tax purposes.

Extract all available data from this daycare or childcare provider statement and return a JSON object with these fields:

- providerName: Full legal name or business name of the childcare provider (string)
- providerAddress: Full address of the childcare provider including street, city, state, and ZIP (string)
- providerTIN: Provider's Tax Identification Number — EIN for a business or SSN for an individual provider (string)
- childName: Full name of the child or dependent receiving care (string; if multiple children, join with comma)
- taxYear: Calendar year for which care expenses are reported (number, e.g. 2023)
- totalAmountPaid: Total amount paid to this provider during the tax year in USD (number) — used to claim the Child and Dependent Care Credit on IRS Form 2441; taxpayers may receive a credit for a portion of qualifying care expenses
- periodCovered: Date range during which care was provided, e.g. "January 2023 - December 2023" (string)

Rules:
- All dollar amounts must be numbers without currency symbols or commas
- Child and Dependent Care Credit (Form 2441): Qualifying expenses are capped at $3,000 for one child or $6,000 for two or more children
- The provider TIN is required by the IRS — extract exactly as shown, including hyphens
- If a field is not present in the document, use null
- Return only valid JSON, no markdown or explanation

Return JSON format:
{
  "providerName": "string or null",
  "providerAddress": "string or null",
  "providerTIN": "string or null",
  "childName": "string or null",
  "taxYear": number or null,
  "totalAmountPaid": number or null,
  "periodCovered": "string or null"
}`
}

export function validateDaycareStatementData(data: unknown): data is DaycareStatementExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return 'providerName' in d
}

export const DAYCARE_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  providerName: 'Tên nhà cung cấp dịch vụ trông trẻ',
  providerAddress: 'Địa chỉ nhà cung cấp',
  providerTIN: 'Mã số thuế nhà cung cấp',
  childName: 'Tên trẻ',
  taxYear: 'Năm thuế',
  totalAmountPaid: 'Tổng số tiền đã trả',
  periodCovered: 'Kỳ dịch vụ',
}
