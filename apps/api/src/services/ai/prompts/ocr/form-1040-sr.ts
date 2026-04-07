/**
 * Form 1040-SR OCR Extraction Prompt
 * U.S. Tax Return for Seniors (age 65+)
 */

import type { TaxpayerAddress, DependentInfo } from './form-1040'

export interface Form1040SRExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null
  spouseName: string | null
  spouseSSN: string | null
  taxpayerAddress: TaxpayerAddress | null

  filingStatus: string | null
  dependents: DependentInfo[]
  attachedSchedules: string[]

  // Income
  wages: number | null                      // Line 1
  taxExemptInterest: number | null          // Line 2a
  taxableInterest: number | null            // Line 2b
  qualifiedDividends: number | null         // Line 3a
  ordinaryDividends: number | null          // Line 3b
  iraDistributions: number | null           // Line 4a
  taxableIRA: number | null                 // Line 4b
  pensionsAnnuities: number | null          // Line 5a
  taxablePensions: number | null            // Line 5b
  socialSecurityBenefits: number | null     // Line 6a
  taxableSocialSecurity: number | null      // Line 6b
  capitalGainLoss: number | null            // Line 7
  otherIncome: number | null                // Line 8
  totalIncome: number | null                // Line 9

  // Adjustments & AGI
  adjustmentsToIncome: number | null        // Line 10
  adjustedGrossIncome: number | null        // Line 11 (CRITICAL)

  // Deductions
  standardDeduction: number | null          // Line 12
  qualifiedBusinessDeduction: number | null // Line 13
  totalDeductions: number | null            // Line 14
  taxableIncome: number | null              // Line 15 (CRITICAL)

  // Tax, Credits, Payments
  totalTax: number | null                   // Line 16
  childTaxCredit: number | null             // Line 19
  totalPayments: number | null              // Line 25d
  refundAmount: number | null               // Line 35a
  amountOwed: number | null                 // Line 37

  taxYear: number | null
}

export function getForm1040SRExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1040-SR (U.S. Tax Return for Seniors).

IMPORTANT: Form 1040-SR is identical to Form 1040 in structure but designed for taxpayers age 65+. It has larger print and a standard deduction chart on page 1.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)
- spouseName, spouseSSN (if filing jointly)
- taxpayerAddress: { street, aptNo, city, state, zip, country }

FILING STATUS:
- filingStatus (Single, Married filing jointly, etc.)

DEPENDENTS (table below taxpayer info):
For each dependent: firstName, lastName, ssn (XXX-XX-XXXX), relationship, childTaxCreditEligible (bool), creditForOtherDependents (bool)

INCOME (Lines 1-9):
- wages (Line 1), taxExemptInterest (2a), taxableInterest (2b)
- qualifiedDividends (3a), ordinaryDividends (3b)
- iraDistributions (4a), taxableIRA (4b)
- pensionsAnnuities (5a), taxablePensions (5b)
- socialSecurityBenefits (6a), taxableSocialSecurity (6b)
- capitalGainLoss (7), otherIncome (8)
- totalIncome (Line 9)

ADJUSTMENTS & AGI:
- adjustmentsToIncome (Line 10)
- adjustedGrossIncome: Line 11 (CRITICAL - most important field)

DEDUCTIONS (Lines 12-15):
- standardDeduction (12), qualifiedBusinessDeduction (13)
- totalDeductions (14), taxableIncome (Line 15 - CRITICAL)

TAX, CREDITS, PAYMENTS:
- totalTax (16), childTaxCredit (19)
- totalPayments (25d), refundAmount (35a), amountOwed (37)

SCHEDULE DETECTION:
- Scan page headers for schedule titles (Schedule 1, A, B, C, D, E, SE, etc.)
- Return array of schedule identifiers (e.g., ["1", "C", "SE"])

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN SMITH",
  "taxpayerSSN": "XXX-XX-1234",
  "spouseName": "JANE SMITH",
  "spouseSSN": "XXX-XX-5678",
  "taxpayerAddress": { "street": "123 MAIN ST", "aptNo": null, "city": "HOUSTON", "state": "TX", "zip": "77001", "country": null },
  "filingStatus": "Married filing jointly",
  "dependents": [],
  "attachedSchedules": [],
  "wages": 0,
  "taxExemptInterest": null,
  "taxableInterest": 1200.00,
  "qualifiedDividends": 3500.00,
  "ordinaryDividends": 4000.00,
  "iraDistributions": 25000.00,
  "taxableIRA": 25000.00,
  "pensionsAnnuities": 18000.00,
  "taxablePensions": 18000.00,
  "socialSecurityBenefits": 24000.00,
  "taxableSocialSecurity": 12000.00,
  "capitalGainLoss": 5000.00,
  "otherIncome": null,
  "totalIncome": 60200.00,
  "adjustmentsToIncome": null,
  "adjustedGrossIncome": 60200.00,
  "standardDeduction": 30700.00,
  "qualifiedBusinessDeduction": null,
  "totalDeductions": 30700.00,
  "taxableIncome": 29500.00,
  "totalTax": 3300.00,
  "childTaxCredit": null,
  "totalPayments": 4000.00,
  "refundAmount": 700.00,
  "amountOwed": null,
  "taxYear": 2024
}

Rules:
1. adjustedGrossIncome (Line 11) and taxableIncome (Line 15) are MOST CRITICAL
2. Standard deduction for seniors is higher than regular 1040
3. All monetary values as numbers without $ or commas
4. SSN format: XXX-XX-XXXX
5. dependents and attachedSchedules must be arrays (empty [] if none)
6. Use null for empty fields, NEVER guess`
}

export function validateForm1040SRData(data: unknown): data is Form1040SRExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  const hasMinimumData =
    d.taxYear !== null ||
    d.adjustedGrossIncome !== null ||
    d.totalTax !== null ||
    d.refundAmount !== null

  if (!hasMinimumData) return false
  if (d.adjustedGrossIncome !== null && d.adjustedGrossIncome !== undefined && typeof d.adjustedGrossIncome !== 'number') return false
  if (!Array.isArray(d.attachedSchedules)) return false
  if (d.dependents !== undefined && !Array.isArray(d.dependents)) return false
  return true
}

export const FORM_1040_SR_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  spouseName: 'Tên Vợ/Chồng',
  spouseSSN: 'SSN Vợ/Chồng',
  taxpayerAddress: 'Địa chỉ người nộp thuế',
  filingStatus: 'Tình trạng khai thuế',
  dependents: 'Người phụ thuộc',
  attachedSchedules: 'Phụ lục đính kèm',
  wages: 'Lương (Dòng 1)',
  taxExemptInterest: 'Lãi miễn thuế (Dòng 2a)',
  taxableInterest: 'Lãi chịu thuế (Dòng 2b)',
  qualifiedDividends: 'Cổ tức đủ điều kiện (Dòng 3a)',
  ordinaryDividends: 'Cổ tức thường (Dòng 3b)',
  iraDistributions: 'Rút IRA (Dòng 4a)',
  taxableIRA: 'IRA chịu thuế (Dòng 4b)',
  pensionsAnnuities: 'Lương hưu (Dòng 5a)',
  taxablePensions: 'Lương hưu chịu thuế (Dòng 5b)',
  socialSecurityBenefits: 'An sinh xã hội (Dòng 6a)',
  taxableSocialSecurity: 'ASXH chịu thuế (Dòng 6b)',
  capitalGainLoss: 'Lãi/lỗ vốn (Dòng 7)',
  otherIncome: 'Thu nhập khác (Dòng 8)',
  totalIncome: 'Tổng thu nhập (Dòng 9)',
  adjustmentsToIncome: 'Điều chỉnh thu nhập (Dòng 10)',
  adjustedGrossIncome: 'AGI (Dòng 11)',
  standardDeduction: 'Khấu trừ tiêu chuẩn (Dòng 12)',
  qualifiedBusinessDeduction: 'Khấu trừ kinh doanh (Dòng 13)',
  totalDeductions: 'Tổng khấu trừ (Dòng 14)',
  taxableIncome: 'Thu nhập chịu thuế (Dòng 15)',
  totalTax: 'Tổng thuế (Dòng 16)',
  childTaxCredit: 'Tín dụng con (Dòng 19)',
  totalPayments: 'Tổng thanh toán (Dòng 25d)',
  refundAmount: 'Hoàn thuế (Dòng 35a)',
  amountOwed: 'Số tiền nợ (Dòng 37)',
  taxYear: 'Năm thuế',
}
