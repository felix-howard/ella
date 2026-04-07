/**
 * Form 2441 OCR Extraction Prompt
 * Child and Dependent Care Expenses
 */

export interface Form2441ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: Care Providers
  careProviders: Array<{
    providerName: string | null
    providerAddress: string | null
    providerTIN: string | null
    amountPaid: number | null
  }>

  // Part II: Credit for Child and Dependent Care
  qualifyingPersons: Array<{
    name: string | null
    ssn: string | null
    qualifyingExpenses: number | null
  }>

  totalQualifyingExpenses: number | null   // Line 3
  earnedIncome: number | null              // Line 4
  spouseEarnedIncome: number | null        // Line 5
  smallerOfIncomes: number | null          // Line 6
  allowableExpenses: number | null         // Line 7 (max $3,000/$6,000)
  creditPercentage: number | null          // Line 8 (20%-35%)
  creditAmount: number | null              // Line 9 (CRITICAL) → Schedule 3

  // Part III: Dependent Care Benefits
  dependentCareBenefits: number | null     // Line 12
  forfeited: number | null                 // Line 14
  excludableBenefits: number | null        // Line 24
  taxableBenefits: number | null           // Line 26

  taxYear: number | null
}

export function getForm2441ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 2441 (Child and Dependent Care Expenses).

IMPORTANT: This form calculates the child/dependent care credit. Accuracy is critical.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

PART I - CARE PROVIDERS:
- careProviders: Array of { providerName, providerAddress, providerTIN, amountPaid }

PART II - CREDIT CALCULATION:
- qualifyingPersons: Array of { name, ssn, qualifyingExpenses }
- totalQualifyingExpenses: Line 3
- earnedIncome: Line 4 (your earned income)
- spouseEarnedIncome: Line 5
- smallerOfIncomes: Line 6
- allowableExpenses: Line 7 (limited to $3,000 one / $6,000 two+ qualifying persons)
- creditPercentage: Line 8 (20% to 35% based on AGI)
- creditAmount: Line 9 (MOST IMPORTANT - flows to Schedule 3)

PART III - DEPENDENT CARE BENEFITS:
- dependentCareBenefits: Line 12 (employer FSA amounts)
- forfeited: Line 14
- excludableBenefits: Line 24
- taxableBenefits: Line 26

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JANE DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "careProviders": [
    {"providerName": "ABC Daycare", "providerAddress": "100 Care Ln, City, ST 12345", "providerTIN": "XX-XXXXXXX", "amountPaid": 8000.00}
  ],
  "qualifyingPersons": [
    {"name": "Child Doe", "ssn": "XXX-XX-XXXX", "qualifyingExpenses": 6000.00}
  ],
  "totalQualifyingExpenses": 6000.00,
  "earnedIncome": 55000.00,
  "spouseEarnedIncome": 48000.00,
  "smallerOfIncomes": 48000.00,
  "allowableExpenses": 3000.00,
  "creditPercentage": 20,
  "creditAmount": 600.00,
  "dependentCareBenefits": null,
  "forfeited": null,
  "excludableBenefits": null,
  "taxableBenefits": null,
  "taxYear": 2024
}

Rules:
1. Line 9 credit amount is most important (flows to Schedule 3)
2. Max qualifying expenses: $3,000 for one, $6,000 for two+ persons
3. All monetary values as numbers without $ or commas
4. Use null for empty fields, NEVER guess`
}

export function validateForm2441Data(data: unknown): data is Form2441ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (!Array.isArray(d.careProviders)) return false
  if (!Array.isArray(d.qualifyingPersons)) return false
  if (d.creditAmount !== null && d.creditAmount !== undefined && typeof d.creditAmount !== 'number') return false
  return true
}

export const FORM_2441_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  totalQualifyingExpenses: 'Tổng chi phí đủ điều kiện (Dòng 3)',
  earnedIncome: 'Thu nhập kiếm được (Dòng 4)',
  spouseEarnedIncome: 'Thu nhập vợ/chồng (Dòng 5)',
  smallerOfIncomes: 'Thu nhập nhỏ hơn (Dòng 6)',
  allowableExpenses: 'Chi phí cho phép (Dòng 7)',
  creditPercentage: 'Tỷ lệ tín dụng (Dòng 8)',
  creditAmount: 'Số tiền tín dụng (Dòng 9)',
  dependentCareBenefits: 'Phúc lợi chăm sóc (Dòng 12)',
  forfeited: 'Mất quyền (Dòng 14)',
  excludableBenefits: 'Phúc lợi loại trừ (Dòng 24)',
  taxableBenefits: 'Phúc lợi chịu thuế (Dòng 26)',
  taxYear: 'Năm thuế',
}
