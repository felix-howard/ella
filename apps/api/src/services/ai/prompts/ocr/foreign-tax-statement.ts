export interface ForeignTaxStatementExtractedData {
  countryOfTax: string | null
  taxType: string | null
  taxYear: number | null
  taxPaidAmount: number | null
  taxPaidCurrency: string | null
  taxPaidUSD: number | null
  incomeSubjectToTax: number | null
}

export function getForeignTaxStatementExtractionPrompt(): string {
  return `You are an expert OCR system specializing in foreign tax statements, certificates of tax paid, and withholding tax receipts issued by foreign governments or tax authorities.

Extract all available data from this foreign tax statement and return a JSON object with these fields:

- countryOfTax: Country that imposed and collected the tax (string)
- taxType: Type of foreign tax, e.g. income tax, withholding tax, capital gains tax (string)
- taxYear: Tax year for which the foreign tax was paid (number, e.g. 2023)
- taxPaidAmount: Amount of tax paid in the foreign currency (number)
- taxPaidCurrency: Currency code of the tax payment, e.g. EUR, GBP, CAD (string)
- taxPaidUSD: Amount of tax paid converted to USD (number) — used to claim the Foreign Tax Credit on IRS Form 1116; taxpayers may reduce their US tax liability by the amount of income tax paid to a foreign government
- incomeSubjectToTax: Amount of income that was subject to the foreign tax, in the foreign currency (number)

Rules:
- All amounts must be numbers without currency symbols or commas
- Foreign Tax Credit (Form 1116): Only foreign income taxes qualify; foreign sales taxes or VAT generally do not
- If taxPaidUSD is not explicitly shown, record null — do not estimate the conversion
- If a field is not present in the document, use null
- Return only valid JSON, no markdown or explanation

Return JSON format:
{
  "countryOfTax": "string or null",
  "taxType": "string or null",
  "taxYear": number or null,
  "taxPaidAmount": number or null,
  "taxPaidCurrency": "string or null",
  "taxPaidUSD": number or null,
  "incomeSubjectToTax": number or null
}`
}

export function validateForeignTaxStatementData(data: unknown): data is ForeignTaxStatementExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return 'countryOfTax' in d
}

export const FOREIGN_TAX_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  countryOfTax: 'Quốc gia thu thuế',
  taxType: 'Loại thuế',
  taxYear: 'Năm thuế',
  taxPaidAmount: 'Số thuế đã nộp (ngoại tệ)',
  taxPaidCurrency: 'Loại tiền tệ nộp thuế',
  taxPaidUSD: 'Số thuế đã nộp (USD)',
  incomeSubjectToTax: 'Thu nhập chịu thuế',
}
