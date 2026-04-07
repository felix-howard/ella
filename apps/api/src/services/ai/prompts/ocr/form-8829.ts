/**
 * Form 8829 OCR Extraction Prompt
 * Expenses for Business Use of Your Home
 */

export interface Form8829ExtractedData {
  taxpayerName: string | null

  // Part I: Business Use Percentage
  homeSquareFootage: number | null           // Line 1
  businessSquareFootage: number | null       // Line 2
  businessPercentage: number | null          // Line 3 (CRITICAL)

  // Part II: Allowable Deduction
  directExpenses: number | null              // Column (a)
  indirectExpenses: number | null            // Column (b)
  casualtyLosses: number | null              // Line 9
  mortgageInterest: number | null            // Line 10
  realEstateTaxes: number | null             // Line 11
  insurance: number | null                   // Line 17
  repairsMaintenance: number | null          // Line 18
  utilities: number | null                   // Line 19
  otherExpenses: number | null               // Line 20
  totalExpensesBeforeLimit: number | null    // Line 25

  // Part III: Depreciation
  depreciationOfHome: number | null          // Line 42

  // Part IV: Carryover
  carryoverFromPriorYear: number | null      // Line 43
  totalAllowableDeduction: number | null     // Line 36 (CRITICAL → Schedule C Line 30)
  carryoverToNextYear: number | null         // Line 44

  taxYear: number | null
}

export function getForm8829ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8829 (Expenses for Business Use of Your Home).

IMPORTANT: This form calculates the home office deduction for self-employed individuals.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName

PART I - BUSINESS USE PERCENTAGE:
- homeSquareFootage: Line 1 (total area of home)
- businessSquareFootage: Line 2 (area used for business)
- businessPercentage: Line 3 (CRITICAL - business use %)

PART II - ALLOWABLE DEDUCTION:
- directExpenses: Column (a) expenses (100% business)
- indirectExpenses: Column (b) expenses (prorated by %)
- casualtyLosses: Line 9
- mortgageInterest: Line 10
- realEstateTaxes: Line 11
- insurance: Line 17
- repairsMaintenance: Line 18
- utilities: Line 19
- otherExpenses: Line 20
- totalExpensesBeforeLimit: Line 25

PART III - DEPRECIATION:
- depreciationOfHome: Line 42

PART IV - CARRYOVER:
- carryoverFromPriorYear: Line 43
- totalAllowableDeduction: Line 36 (CRITICAL - flows to Schedule C Line 30)
- carryoverToNextYear: Line 44

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "homeSquareFootage": 2000,
  "businessSquareFootage": 300,
  "businessPercentage": 15.00,
  "directExpenses": null,
  "indirectExpenses": 12000.00,
  "casualtyLosses": null,
  "mortgageInterest": 8000.00,
  "realEstateTaxes": 4000.00,
  "insurance": 1200.00,
  "repairsMaintenance": 500.00,
  "utilities": 3600.00,
  "otherExpenses": null,
  "totalExpensesBeforeLimit": 2595.00,
  "depreciationOfHome": 1500.00,
  "carryoverFromPriorYear": null,
  "totalAllowableDeduction": 4095.00,
  "carryoverToNextYear": null,
  "taxYear": 2024
}

Rules:
1. Business percentage (Line 3) drives the entire calculation
2. Line 36 (total deduction) flows to Schedule C Line 30
3. Deduction limited by gross income from business
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

export function validateForm8829Data(data: unknown): data is Form8829ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (d.businessPercentage !== null && d.businessPercentage !== undefined && typeof d.businessPercentage !== 'number') return false
  if (d.totalAllowableDeduction !== null && d.totalAllowableDeduction !== undefined && typeof d.totalAllowableDeduction !== 'number') return false
  return true
}

export const FORM_8829_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  homeSquareFootage: 'Diện tích nhà (Dòng 1)',
  businessSquareFootage: 'Diện tích kinh doanh (Dòng 2)',
  businessPercentage: 'Tỷ lệ kinh doanh (Dòng 3)',
  directExpenses: 'Chi phí trực tiếp',
  indirectExpenses: 'Chi phí gián tiếp',
  casualtyLosses: 'Thiệt hại (Dòng 9)',
  mortgageInterest: 'Lãi thế chấp (Dòng 10)',
  realEstateTaxes: 'Thuế bất động sản (Dòng 11)',
  insurance: 'Bảo hiểm (Dòng 17)',
  repairsMaintenance: 'Sửa chữa/Bảo trì (Dòng 18)',
  utilities: 'Tiện ích (Dòng 19)',
  otherExpenses: 'Chi phí khác (Dòng 20)',
  totalExpensesBeforeLimit: 'Tổng chi phí trước giới hạn (Dòng 25)',
  depreciationOfHome: 'Khấu hao nhà (Dòng 42)',
  carryoverFromPriorYear: 'Chuyển tiếp từ năm trước (Dòng 43)',
  totalAllowableDeduction: 'Tổng khấu trừ cho phép (Dòng 36)',
  carryoverToNextYear: 'Chuyển tiếp năm sau (Dòng 44)',
  taxYear: 'Năm thuế',
}
