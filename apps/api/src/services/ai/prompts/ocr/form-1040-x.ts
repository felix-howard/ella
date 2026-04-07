/**
 * Form 1040-X OCR Extraction Prompt
 * Amended U.S. Individual Income Tax Return
 */

import type { TaxpayerAddress } from './form-1040'

export interface Form1040XExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null
  spouseName: string | null
  spouseSSN: string | null
  taxpayerAddress: TaxpayerAddress | null

  taxYear: number | null                    // Year being amended
  filingStatus: string | null

  // Part I: Income and Deductions (Column A=Original, B=Change, C=Corrected)
  incomeOriginal: number | null             // Line 1A
  incomeChange: number | null               // Line 1B
  incomeCorrected: number | null            // Line 1C (CRITICAL)

  adjustmentsOriginal: number | null        // Line 2A
  adjustmentsChange: number | null          // Line 2B
  adjustmentsCorrected: number | null       // Line 2C

  agiOriginal: number | null                // Line 3A
  agiChange: number | null                  // Line 3B
  agiCorrected: number | null               // Line 3C (CRITICAL)

  deductionsOriginal: number | null         // Line 4A
  deductionsChange: number | null           // Line 4B
  deductionsCorrected: number | null        // Line 4C

  taxableIncomeOriginal: number | null      // Line 5A
  taxableIncomeChange: number | null        // Line 5B
  taxableIncomeCorrected: number | null     // Line 5C (CRITICAL)

  // Part II: Tax Liability
  taxOriginal: number | null                // Line 6A
  taxChange: number | null                  // Line 6B
  taxCorrected: number | null               // Line 6C

  creditsOriginal: number | null
  creditsChange: number | null
  creditsCorrected: number | null

  // Part II: Payments
  totalPaymentsOriginal: number | null
  totalPaymentsChange: number | null
  totalPaymentsCorrected: number | null

  // Refund or Amount Due
  overpaymentOriginal: number | null
  additionalRefundDue: number | null        // Line 22
  additionalTaxOwed: number | null          // Line 20

  // Part III: Explanation
  explanationOfChanges: string | null

  dateAmended: string | null
}

export function getForm1040XExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1040-X (Amended U.S. Individual Income Tax Return).

IMPORTANT: This form has THREE COLUMNS for most fields:
- Column A = ORIGINAL amount (from original return)
- Column B = NET CHANGE (increase or decrease)
- Column C = CORRECTED amount (A + or - B)
The CORRECTED column (C) values are most critical.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)
- spouseName, spouseSSN (if applicable)
- taxpayerAddress: { street, aptNo, city, state, zip, country }

AMENDMENT INFO:
- taxYear (year being amended)
- filingStatus (original or changed)
- dateAmended (date form was signed, YYYY-MM-DD)

PART I - INCOME AND DEDUCTIONS (3 columns each):
Line 1 - Adjusted Gross Income:
  - incomeOriginal (1A), incomeChange (1B), incomeCorrected (1C - CRITICAL)
Line 2 - Adjustments:
  - adjustmentsOriginal (2A), adjustmentsChange (2B), adjustmentsCorrected (2C)
Line 3 - AGI:
  - agiOriginal (3A), agiChange (3B), agiCorrected (3C - CRITICAL)
Line 4 - Deductions:
  - deductionsOriginal (4A), deductionsChange (4B), deductionsCorrected (4C)
Line 5 - Taxable Income:
  - taxableIncomeOriginal (5A), taxableIncomeChange (5B), taxableIncomeCorrected (5C - CRITICAL)

PART II - TAX LIABILITY:
Line 6 - Tax:
  - taxOriginal (6A), taxChange (6B), taxCorrected (6C)
Credits:
  - creditsOriginal, creditsChange, creditsCorrected
Payments:
  - totalPaymentsOriginal, totalPaymentsChange, totalPaymentsCorrected

REFUND/AMOUNT DUE:
- overpaymentOriginal
- additionalRefundDue (Line 22 - additional refund expected)
- additionalTaxOwed (Line 20 - additional tax owed)

PART III - EXPLANATION:
- explanationOfChanges (full text of taxpayer's explanation)

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-1234",
  "spouseName": null,
  "spouseSSN": null,
  "taxpayerAddress": { "street": "123 MAIN ST", "aptNo": null, "city": "HOUSTON", "state": "TX", "zip": "77001", "country": null },
  "taxYear": 2023,
  "filingStatus": "Single",
  "incomeOriginal": 85000.00,
  "incomeChange": 5000.00,
  "incomeCorrected": 90000.00,
  "adjustmentsOriginal": 2000.00,
  "adjustmentsChange": 0,
  "adjustmentsCorrected": 2000.00,
  "agiOriginal": 83000.00,
  "agiChange": 5000.00,
  "agiCorrected": 88000.00,
  "deductionsOriginal": 13850.00,
  "deductionsChange": 0,
  "deductionsCorrected": 13850.00,
  "taxableIncomeOriginal": 69150.00,
  "taxableIncomeChange": 5000.00,
  "taxableIncomeCorrected": 74150.00,
  "taxOriginal": 10800.00,
  "taxChange": 1100.00,
  "taxCorrected": 11900.00,
  "creditsOriginal": null,
  "creditsChange": null,
  "creditsCorrected": null,
  "totalPaymentsOriginal": 12000.00,
  "totalPaymentsChange": 0,
  "totalPaymentsCorrected": 12000.00,
  "overpaymentOriginal": 1200.00,
  "additionalRefundDue": null,
  "additionalTaxOwed": 1100.00,
  "explanationOfChanges": "Received corrected 1099-NEC for freelance work not included on original return",
  "dateAmended": "2024-06-15"
}

Rules:
1. Column C (corrected) values are MOST CRITICAL
2. Net change (B) can be negative (shown in parentheses)
3. All monetary values as numbers without $ or commas
4. explanationOfChanges: extract full text from Part III
5. Use null for empty fields, NEVER guess`
}

export function validateForm1040XData(data: unknown): data is Form1040XExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  const hasMinimumData =
    d.taxYear !== null ||
    d.agiCorrected !== null ||
    d.taxableIncomeCorrected !== null ||
    d.additionalRefundDue !== null ||
    d.additionalTaxOwed !== null

  if (!hasMinimumData) return false
  if (d.agiCorrected !== null && d.agiCorrected !== undefined && typeof d.agiCorrected !== 'number') return false
  return true
}

export const FORM_1040_X_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  spouseName: 'Tên Vợ/Chồng',
  spouseSSN: 'SSN Vợ/Chồng',
  taxpayerAddress: 'Địa chỉ người nộp thuế',
  taxYear: 'Năm thuế sửa đổi',
  filingStatus: 'Tình trạng khai thuế',
  incomeOriginal: 'Thu nhập gốc (Dòng 1A)',
  incomeChange: 'Thay đổi thu nhập (Dòng 1B)',
  incomeCorrected: 'Thu nhập đã sửa (Dòng 1C)',
  adjustmentsOriginal: 'Điều chỉnh gốc (Dòng 2A)',
  adjustmentsChange: 'Thay đổi điều chỉnh (Dòng 2B)',
  adjustmentsCorrected: 'Điều chỉnh đã sửa (Dòng 2C)',
  agiOriginal: 'AGI gốc (Dòng 3A)',
  agiChange: 'Thay đổi AGI (Dòng 3B)',
  agiCorrected: 'AGI đã sửa (Dòng 3C)',
  deductionsOriginal: 'Khấu trừ gốc (Dòng 4A)',
  deductionsChange: 'Thay đổi khấu trừ (Dòng 4B)',
  deductionsCorrected: 'Khấu trừ đã sửa (Dòng 4C)',
  taxableIncomeOriginal: 'Thu nhập chịu thuế gốc (Dòng 5A)',
  taxableIncomeChange: 'Thay đổi TNCT (Dòng 5B)',
  taxableIncomeCorrected: 'TNCT đã sửa (Dòng 5C)',
  taxOriginal: 'Thuế gốc (Dòng 6A)',
  taxChange: 'Thay đổi thuế (Dòng 6B)',
  taxCorrected: 'Thuế đã sửa (Dòng 6C)',
  additionalRefundDue: 'Hoàn thuế thêm (Dòng 22)',
  additionalTaxOwed: 'Thuế nợ thêm (Dòng 20)',
  creditsOriginal: 'Tín dụng gốc',
  creditsChange: 'Thay đổi tín dụng',
  creditsCorrected: 'Tín dụng đã sửa',
  totalPaymentsOriginal: 'Tổng thanh toán gốc',
  totalPaymentsChange: 'Thay đổi thanh toán',
  totalPaymentsCorrected: 'Thanh toán đã sửa',
  overpaymentOriginal: 'Nộp thừa gốc',
  explanationOfChanges: 'Giải thích thay đổi',
  dateAmended: 'Ngày sửa đổi',
}
