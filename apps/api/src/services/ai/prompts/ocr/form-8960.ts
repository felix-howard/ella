/**
 * Form 8960 OCR Extraction Prompt
 * Net Investment Income Tax (NIIT)
 */

export interface Form8960ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: Net Investment Income
  taxableInterest: number | null             // Line 1
  annuitiesNonqualified: number | null       // Line 2
  rentalRoyaltyPartnership: number | null    // Line 3
  capitalGainLoss: number | null             // Line 4a
  otherGainsLosses: number | null            // Line 4b
  otherInvestmentIncome: number | null       // Line 5a
  totalInvestmentIncome: number | null       // Line 8

  // Part II: Deductions
  investmentInterestExpense: number | null   // Line 9a
  stateTaxOnInvestmentIncome: number | null  // Line 9b
  otherDeductions: number | null             // Line 9c
  totalDeductions: number | null             // Line 9d

  // Part III: Tax Computation
  netInvestmentIncome: number | null         // Line 11 (Line 8 - Line 9d)
  modifiedAGI: number | null                 // Line 12
  threshold: number | null                   // Line 13 ($200k/$250k/$125k)
  excessOverThreshold: number | null         // Line 14
  smallerOfNIIOrExcess: number | null        // Line 16
  niitTax: number | null                     // Line 17 (CRITICAL - 3.8% → Schedule 2)

  taxYear: number | null
}

export function getForm8960ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8960 (Net Investment Income Tax).

IMPORTANT: 3.8% tax on net investment income for high earners. Flows to Schedule 2.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

PART I - NET INVESTMENT INCOME:
- taxableInterest: Line 1
- annuitiesNonqualified: Line 2
- rentalRoyaltyPartnership: Line 3
- capitalGainLoss: Line 4a (net gain from capital assets)
- otherGainsLosses: Line 4b
- otherInvestmentIncome: Line 5a
- totalInvestmentIncome: Line 8

PART II - DEDUCTIONS:
- investmentInterestExpense: Line 9a
- stateTaxOnInvestmentIncome: Line 9b
- otherDeductions: Line 9c
- totalDeductions: Line 9d

PART III - TAX COMPUTATION:
- netInvestmentIncome: Line 11 (investment income minus deductions)
- modifiedAGI: Line 12
- threshold: Line 13 ($200,000 Single, $250,000 MFJ, $125,000 MFS)
- excessOverThreshold: Line 14 (MAGI minus threshold)
- smallerOfNIIOrExcess: Line 16
- niitTax: Line 17 (CRITICAL - 3.8% of Line 16 → Schedule 2)

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "taxableInterest": 15000.00,
  "annuitiesNonqualified": null,
  "rentalRoyaltyPartnership": 25000.00,
  "capitalGainLoss": 50000.00,
  "otherGainsLosses": null,
  "otherInvestmentIncome": null,
  "totalInvestmentIncome": 90000.00,
  "investmentInterestExpense": 2000.00,
  "stateTaxOnInvestmentIncome": null,
  "otherDeductions": null,
  "totalDeductions": 2000.00,
  "netInvestmentIncome": 88000.00,
  "modifiedAGI": 300000.00,
  "threshold": 250000.00,
  "excessOverThreshold": 50000.00,
  "smallerOfNIIOrExcess": 50000.00,
  "niitTax": 1900.00,
  "taxYear": 2024
}

Rules:
1. NIIT = 3.8% × lesser of {NII, MAGI over threshold}
2. Thresholds: $200k (Single/HoH), $250k (MFJ), $125k (MFS)
3. Line 17 flows to Schedule 2
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

export function validateForm8960Data(data: unknown): data is Form8960ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (d.niitTax !== null && d.niitTax !== undefined && typeof d.niitTax !== 'number') return false
  if (d.netInvestmentIncome !== null && d.netInvestmentIncome !== undefined && typeof d.netInvestmentIncome !== 'number') return false
  return true
}

export const FORM_8960_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  taxableInterest: 'Lãi suất chịu thuế (Dòng 1)',
  annuitiesNonqualified: 'Niên kim phi đủ điều kiện (Dòng 2)',
  rentalRoyaltyPartnership: 'Cho thuê/Bản quyền/Hợp danh (Dòng 3)',
  capitalGainLoss: 'Lãi/Lỗ vốn (Dòng 4a)',
  otherGainsLosses: 'Lãi/Lỗ khác (Dòng 4b)',
  otherInvestmentIncome: 'Thu nhập đầu tư khác (Dòng 5a)',
  totalInvestmentIncome: 'Tổng thu nhập đầu tư (Dòng 8)',
  investmentInterestExpense: 'Chi phí lãi đầu tư (Dòng 9a)',
  stateTaxOnInvestmentIncome: 'Thuế tiểu bang trên đầu tư (Dòng 9b)',
  otherDeductions: 'Khấu trừ khác (Dòng 9c)',
  totalDeductions: 'Tổng khấu trừ (Dòng 9d)',
  netInvestmentIncome: 'Thu nhập đầu tư ròng (Dòng 11)',
  modifiedAGI: 'MAGI (Dòng 12)',
  threshold: 'Ngưỡng (Dòng 13)',
  excessOverThreshold: 'Vượt ngưỡng (Dòng 14)',
  smallerOfNIIOrExcess: 'Nhỏ hơn NII/Vượt ngưỡng (Dòng 16)',
  niitTax: 'Thuế NIIT (Dòng 17)',
  taxYear: 'Năm thuế',
}
