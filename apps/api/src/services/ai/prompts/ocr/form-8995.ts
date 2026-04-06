/**
 * Form 8995 OCR Extraction Prompt
 * Qualified Business Income Deduction (Simplified)
 */

export interface Form8995ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // QBI Information (per business)
  businesses: Array<{
    businessName: string | null
    businessTIN: string | null
    qualifiedBusinessIncome: number | null
  }>

  // Calculation
  totalQBI: number | null                    // Line 2 (sum of all QBI)
  qbiComponentDeduction: number | null       // Line 3 (20% of QBI)
  qualifiedREITDividends: number | null      // Line 4
  qualifiedPTPIncome: number | null          // Line 5
  reitPTPDeduction: number | null            // Line 6 (20% of REIT/PTP)
  totalQBIDeduction: number | null           // Line 7 (Line 3 + Line 6)
  taxableIncomeBeforeQBI: number | null      // Line 10
  netCapitalGain: number | null              // Line 11
  incomeLimit: number | null                 // Line 12 (Line 10 - Line 11)
  incomeLimitDeduction: number | null        // Line 13 (20% of Line 12)
  qbiDeduction: number | null               // Line 15 (CRITICAL → Form 1040 Line 13)

  taxYear: number | null
}

export function getForm8995ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8995 (Qualified Business Income Deduction - Simplified).

IMPORTANT: 20% deduction on qualified business income for pass-through entities. Very common for self-employed.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

BUSINESS QBI:
- businesses: Array of { businessName, businessTIN, qualifiedBusinessIncome }

CALCULATION:
- totalQBI: Line 2 (sum of all qualified business income)
- qbiComponentDeduction: Line 3 (20% of total QBI)
- qualifiedREITDividends: Line 4
- qualifiedPTPIncome: Line 5 (publicly traded partnership income)
- reitPTPDeduction: Line 6 (20% of REIT/PTP income)
- totalQBIDeduction: Line 7 (QBI + REIT/PTP deductions)
- taxableIncomeBeforeQBI: Line 10
- netCapitalGain: Line 11
- incomeLimit: Line 12 (taxable income minus net capital gain)
- incomeLimitDeduction: Line 13 (20% of income limit)
- qbiDeduction: Line 15 (CRITICAL - lesser of Line 7 or Line 13 → Form 1040)

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "businesses": [
    {"businessName": "Doe Consulting", "businessTIN": "XX-XXXXXXX", "qualifiedBusinessIncome": 80000.00}
  ],
  "totalQBI": 80000.00,
  "qbiComponentDeduction": 16000.00,
  "qualifiedREITDividends": null,
  "qualifiedPTPIncome": null,
  "reitPTPDeduction": null,
  "totalQBIDeduction": 16000.00,
  "taxableIncomeBeforeQBI": 120000.00,
  "netCapitalGain": null,
  "incomeLimit": 120000.00,
  "incomeLimitDeduction": 24000.00,
  "qbiDeduction": 16000.00,
  "taxYear": 2024
}

Rules:
1. QBI deduction = 20% of qualified business income
2. Limited to lesser of 20% QBI or 20% taxable income (minus capital gains)
3. Simplified form for taxable income below threshold ($191,950/$383,900 for 2024)
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

export function validateForm8995Data(data: unknown): data is Form8995ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (!Array.isArray(d.businesses)) return false
  if (d.qbiDeduction !== null && d.qbiDeduction !== undefined && typeof d.qbiDeduction !== 'number') return false
  return true
}

export const FORM_8995_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  totalQBI: 'Tổng QBI (Dòng 2)',
  qbiComponentDeduction: 'Khấu trừ QBI (Dòng 3)',
  qualifiedREITDividends: 'Cổ tức REIT (Dòng 4)',
  qualifiedPTPIncome: 'Thu nhập PTP (Dòng 5)',
  reitPTPDeduction: 'Khấu trừ REIT/PTP (Dòng 6)',
  totalQBIDeduction: 'Tổng khấu trừ QBI (Dòng 7)',
  taxableIncomeBeforeQBI: 'Thu nhập chịu thuế trước QBI (Dòng 10)',
  netCapitalGain: 'Lãi vốn ròng (Dòng 11)',
  incomeLimit: 'Giới hạn thu nhập (Dòng 12)',
  incomeLimitDeduction: 'Khấu trừ giới hạn (Dòng 13)',
  qbiDeduction: 'Khấu trừ QBI cuối cùng (Dòng 15)',
  taxYear: 'Năm thuế',
}
