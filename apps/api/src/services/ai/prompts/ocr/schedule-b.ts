/**
 * Schedule B (Form 1040) OCR Extraction Prompt
 * Extracts structured data from Schedule B - Interest and Ordinary Dividends
 * Part I total -> 1040 line 2b, Part II total -> 1040 line 3b
 */

export interface ScheduleBInterestSource {
  payerName: string | null
  amount: number | null
}

export interface ScheduleBDividendSource {
  payerName: string | null
  amount: number | null
}

export interface ScheduleBExtractedData {
  taxYear: number | null
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: Interest
  interestSources: ScheduleBInterestSource[]
  totalInterestLine1: number | null // Sum of sources
  excludableUSBondInterest: number | null // Line 3
  totalTaxableInterest: number | null // Line 4 -> 1040 line 2b

  // Part II: Ordinary Dividends
  dividendSources: ScheduleBDividendSource[]
  totalOrdinaryDividends: number | null // Line 6 -> 1040 line 3b

  // Part III: Foreign Accounts and Trusts
  hasForeignAccounts: boolean | null // Question 7a
  foreignAccountCountries: string | null // Question 7b
  hasForeignTrust: boolean | null // Question 8
}

export function getScheduleBExtractionPrompt(): string {
  return `You are an OCR system. Extract data from IRS Schedule B (Form 1040) - Interest and Ordinary Dividends.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in the document
- If a field is blank or not visible, return null (never invent data)
- Monetary amounts: return as numbers without $ or commas (e.g., 1250.00)
- For arrays, list ALL visible entries; return empty array [] if none visible

TAXPAYER INFO (top):
- Name as shown on Form 1040
- Social security number

PART I - INTEREST (required if interest > $1,500):
- List of payer names and amounts (Line 1)
- Line 3: Excludable interest on series EE and I U.S. savings bonds
- Line 4: Total taxable interest -> goes to Form 1040 line 2b

PART II - ORDINARY DIVIDENDS (required if dividends > $1,500):
- List of payer names and amounts (Line 5)
- Line 6: Total ordinary dividends -> goes to Form 1040 line 3b

PART III - FOREIGN ACCOUNTS AND TRUSTS:
- Question 7a: Do you have a financial interest in a foreign account? (Yes/No)
- Question 7b: Countries (if yes)
- Question 8: Did you receive a distribution from a foreign trust? (Yes/No)

OUTPUT FORMAT (JSON):
{
  "taxYear": 2023,
  "taxpayerName": "John Doe",
  "taxpayerSSN": "XXX-XX-XXXX",
  "interestSources": [
    {"payerName": "Chase Bank", "amount": 850.00},
    {"payerName": "Ally Bank", "amount": 1200.00}
  ],
  "totalInterestLine1": 2050.00,
  "excludableUSBondInterest": null,
  "totalTaxableInterest": 2050.00,
  "dividendSources": [
    {"payerName": "Vanguard", "amount": 3500.00}
  ],
  "totalOrdinaryDividends": 3500.00,
  "hasForeignAccounts": false,
  "foreignAccountCountries": null,
  "hasForeignTrust": false
}

IMPORTANT:
- Return null for any field not found or blank
- Return empty array [] for sources if none visible
- Line 4 (totalTaxableInterest) -> Form 1040 line 2b
- Line 6 (totalOrdinaryDividends) -> Form 1040 line 3b`
}

export function validateScheduleBData(data: unknown): data is ScheduleBExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const hasInterest = d.totalTaxableInterest !== null && d.totalTaxableInterest !== undefined && typeof d.totalTaxableInterest === 'number'
  const hasDividends = d.totalOrdinaryDividends !== null && d.totalOrdinaryDividends !== undefined && typeof d.totalOrdinaryDividends === 'number'
  return hasInterest || hasDividends
}

export const SCHEDULE_B_FIELD_LABELS_VI: Record<string, string> = {
  taxYear: 'Năm thuế',
  taxpayerName: 'Tên người nộp thuế',
  taxpayerSSN: 'Số an sinh xã hội',
  interestSources: 'Nguồn lãi suất',
  totalInterestLine1: 'Tổng lãi suất (Line 1)',
  excludableUSBondInterest: 'Lãi trái phiếu Mỹ miễn thuế (Line 3)',
  totalTaxableInterest: 'Tổng lãi chịu thuế (Line 4)',
  dividendSources: 'Nguồn cổ tức',
  totalOrdinaryDividends: 'Tổng cổ tức thường (Line 6)',
  hasForeignAccounts: 'Có tài khoản nước ngoài (7a)',
  foreignAccountCountries: 'Quốc gia tài khoản (7b)',
  hasForeignTrust: 'Có tín thác nước ngoài (8)',
}
