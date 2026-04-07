/**
 * Form 2555 OCR Extraction Prompt
 * Foreign Earned Income Exclusion
 */

export interface Form2555ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: General Information
  foreignAddress: string | null
  foreignCountry: string | null
  employerName: string | null
  employerAddress: string | null
  employerIsForeign: boolean | null

  // Part II: Bona Fide Residence Test
  residenceStartDate: string | null
  residenceEndDate: string | null
  residenceCountry: string | null
  familyResidedWithYou: boolean | null

  // Part III: Physical Presence Test
  daysInUS: number | null
  daysOutsideUS: number | null
  qualifyingDays: number | null               // Must be ≥330

  // Part IV: Foreign Earned Income
  foreignWages: number | null
  foreignSelfEmployment: number | null
  otherForeignIncome: number | null
  totalForeignEarnedIncome: number | null     // Line 19

  // Part V: Housing Exclusion/Deduction
  housingExpenses: number | null
  baseHousingAmount: number | null
  housingExclusionDeduction: number | null    // Line 34

  // Part VI: Foreign Earned Income Exclusion
  maxExclusionAmount: number | null           // $120,000+ indexed
  exclusionLimitationDays: number | null
  foreignEarnedIncomeExclusion: number | null // Line 42

  // Total Exclusion
  totalExclusion: number | null               // Line 45 → Schedule 1

  taxYear: number | null
}

export function getForm2555ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 2555 (Foreign Earned Income).

IMPORTANT: This form allows US citizens/residents abroad to exclude foreign earned income. Critical for expats.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

PART I - GENERAL INFORMATION:
- foreignAddress, foreignCountry
- employerName, employerAddress
- employerIsForeign (true/false)

PART II - BONA FIDE RESIDENCE TEST:
- residenceStartDate, residenceEndDate (YYYY-MM-DD)
- residenceCountry
- familyResidedWithYou (true/false)

PART III - PHYSICAL PRESENCE TEST:
- daysInUS, daysOutsideUS, qualifyingDays (must be ≥330 for 12-month period)

PART IV - FOREIGN EARNED INCOME:
- foreignWages, foreignSelfEmployment, otherForeignIncome
- totalForeignEarnedIncome: Line 19

PART V - HOUSING:
- housingExpenses, baseHousingAmount
- housingExclusionDeduction: Line 34

PART VI - EXCLUSION:
- maxExclusionAmount (indexed annually)
- exclusionLimitationDays
- foreignEarnedIncomeExclusion: Line 42
- totalExclusion: Line 45 (CRITICAL → Schedule 1)

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "foreignAddress": "123 London Rd, London, UK",
  "foreignCountry": "United Kingdom",
  "employerName": "UK Corp Ltd",
  "employerAddress": "456 Oxford St, London, UK",
  "employerIsForeign": true,
  "residenceStartDate": "2023-01-01",
  "residenceEndDate": "2023-12-31",
  "residenceCountry": "United Kingdom",
  "familyResidedWithYou": true,
  "daysInUS": 20,
  "daysOutsideUS": 345,
  "qualifyingDays": 345,
  "foreignWages": 95000.00,
  "foreignSelfEmployment": null,
  "otherForeignIncome": null,
  "totalForeignEarnedIncome": 95000.00,
  "housingExpenses": 30000.00,
  "baseHousingAmount": 18048.00,
  "housingExclusionDeduction": 11952.00,
  "maxExclusionAmount": 120000.00,
  "exclusionLimitationDays": 365,
  "foreignEarnedIncomeExclusion": 95000.00,
  "totalExclusion": 106952.00,
  "taxYear": 2024
}

Rules:
1. totalExclusion is most important (flows to Schedule 1)
2. Physical presence requires ≥330 days in 12-month period
3. All monetary values as numbers without $ or commas
4. Dates in YYYY-MM-DD format
5. Use null for empty fields, NEVER guess`
}

export function validateForm2555Data(data: unknown): data is Form2555ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (d.totalExclusion !== null && d.totalExclusion !== undefined && typeof d.totalExclusion !== 'number') return false
  return true
}

export const FORM_2555_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  foreignAddress: 'Địa chỉ nước ngoài',
  foreignCountry: 'Quốc gia nước ngoài',
  employerName: 'Tên nhà tuyển dụng',
  employerIsForeign: 'Nhà tuyển dụng nước ngoài',
  residenceCountry: 'Quốc gia cư trú',
  familyResidedWithYou: 'Gia đình cư trú cùng',
  daysInUS: 'Số ngày tại Mỹ',
  daysOutsideUS: 'Số ngày ngoài Mỹ',
  qualifyingDays: 'Số ngày đủ điều kiện',
  foreignWages: 'Lương nước ngoài',
  foreignSelfEmployment: 'Tự kinh doanh nước ngoài',
  totalForeignEarnedIncome: 'Tổng thu nhập nước ngoài (Dòng 19)',
  housingExpenses: 'Chi phí nhà ở',
  baseHousingAmount: 'Mức nhà ở cơ bản',
  housingExclusionDeduction: 'Khấu trừ nhà ở (Dòng 34)',
  maxExclusionAmount: 'Mức loại trừ tối đa',
  foreignEarnedIncomeExclusion: 'Loại trừ thu nhập (Dòng 42)',
  totalExclusion: 'Tổng loại trừ (Dòng 45)',
  taxYear: 'Năm thuế',
}
