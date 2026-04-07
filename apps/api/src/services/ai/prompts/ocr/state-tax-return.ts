/**
 * State Tax Return OCR Extraction Prompt
 * Generic state income tax return (covers common elements across all states)
 */

import type { TaxpayerAddress } from './form-1040'

export interface StateTaxReturnExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null
  spouseName: string | null
  spouseSSN: string | null
  taxpayerAddress: TaxpayerAddress | null

  // State Info
  stateName: string | null
  stateFormNumber: string | null             // e.g., "540" (CA), "IT-201" (NY)
  residentStatus: 'FULL_YEAR' | 'PART_YEAR' | 'NONRESIDENT' | null

  // Income
  federalAGI: number | null                 // From federal return
  stateAdditions: number | null             // State-specific additions
  stateSubtractions: number | null          // State-specific subtractions
  stateAGI: number | null                   // (CRITICAL)

  // Deductions
  standardOrItemized: 'STANDARD' | 'ITEMIZED' | null
  deductionAmount: number | null
  exemptions: number | null
  stateTaxableIncome: number | null         // (CRITICAL)

  // Tax Calculation
  stateTax: number | null                   // (CRITICAL)
  stateCredits: number | null
  localTax: number | null                   // City/county if applicable
  totalStateTax: number | null

  // Payments
  stateWithholding: number | null
  stateEstimatedPayments: number | null
  totalStatePayments: number | null

  // Refund/Due
  stateRefund: number | null
  stateAmountOwed: number | null

  taxYear: number | null
}

export function getStateTaxReturnExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from state income tax returns.

IMPORTANT: State tax returns vary by state but share common elements. Extract whatever is visible regardless of specific state form. Identify the state and form number from the header.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)
- spouseName, spouseSSN (if filing jointly)
- taxpayerAddress: { street, aptNo, city, state, zip, country }

STATE INFO:
- stateName (2-letter abbreviation, e.g., CA, NY, TX)
- stateFormNumber (e.g., "540", "IT-201", "IL-1040")
- residentStatus: FULL_YEAR, PART_YEAR, or NONRESIDENT

INCOME:
- federalAGI (from federal return, usually starting point)
- stateAdditions (state-specific additions to income)
- stateSubtractions (state-specific subtractions from income)
- stateAGI (CRITICAL - state adjusted gross income)

DEDUCTIONS:
- standardOrItemized: STANDARD or ITEMIZED
- deductionAmount
- exemptions (personal/dependent exemptions)
- stateTaxableIncome (CRITICAL)

TAX CALCULATION:
- stateTax (CRITICAL - computed state income tax)
- stateCredits (total state tax credits)
- localTax (city/county tax if applicable, e.g., NYC, Yonkers)
- totalStateTax (after credits and local tax)

PAYMENTS:
- stateWithholding (from W-2 state boxes)
- stateEstimatedPayments
- totalStatePayments

REFUND/AMOUNT DUE:
- stateRefund
- stateAmountOwed

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-1234",
  "spouseName": null,
  "spouseSSN": null,
  "taxpayerAddress": { "street": "123 MAIN ST", "aptNo": null, "city": "LOS ANGELES", "state": "CA", "zip": "90001", "country": null },
  "stateName": "CA",
  "stateFormNumber": "540",
  "residentStatus": "FULL_YEAR",
  "federalAGI": 88000.00,
  "stateAdditions": 500.00,
  "stateSubtractions": 2000.00,
  "stateAGI": 86500.00,
  "standardOrItemized": "STANDARD",
  "deductionAmount": 5363.00,
  "exemptions": 144.00,
  "stateTaxableIncome": 80993.00,
  "stateTax": 3850.00,
  "stateCredits": 200.00,
  "localTax": null,
  "totalStateTax": 3650.00,
  "stateWithholding": 4000.00,
  "stateEstimatedPayments": null,
  "totalStatePayments": 4000.00,
  "stateRefund": 350.00,
  "stateAmountOwed": null,
  "taxYear": 2024
}

Rules:
1. stateAGI, stateTaxableIncome, and stateTax are MOST CRITICAL
2. Identify stateName from header (2-letter code)
3. stateFormNumber helps identify which state form was filed
4. All monetary values as numbers without $ or commas
5. Some states have no income tax (TX, FL, etc.) - unlikely to see these forms
6. Use null for empty fields, NEVER guess`
}

export function validateStateTaxReturnData(data: unknown): data is StateTaxReturnExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  const hasMinimumData =
    d.taxYear !== null ||
    d.stateAGI !== null ||
    d.stateTax !== null ||
    d.stateRefund !== null

  if (!hasMinimumData) return false
  if (d.stateAGI !== null && d.stateAGI !== undefined && typeof d.stateAGI !== 'number') return false
  return true
}

export const STATE_TAX_RETURN_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  spouseName: 'Tên Vợ/Chồng',
  spouseSSN: 'SSN Vợ/Chồng',
  taxpayerAddress: 'Địa chỉ người nộp thuế',
  stateName: 'Tiểu bang',
  stateFormNumber: 'Số mẫu tiểu bang',
  residentStatus: 'Tình trạng cư trú',
  federalAGI: 'AGI liên bang',
  stateAdditions: 'Cộng thêm tiểu bang',
  stateSubtractions: 'Trừ tiểu bang',
  stateAGI: 'AGI tiểu bang',
  standardOrItemized: 'Loại khấu trừ',
  deductionAmount: 'Số tiền khấu trừ',
  exemptions: 'Miễn trừ',
  stateTaxableIncome: 'Thu nhập chịu thuế tiểu bang',
  stateTax: 'Thuế tiểu bang',
  stateCredits: 'Tín dụng tiểu bang',
  localTax: 'Thuế địa phương',
  totalStateTax: 'Tổng thuế tiểu bang',
  stateWithholding: 'Khấu lưu tiểu bang',
  stateEstimatedPayments: 'Thuế ước tính tiểu bang',
  totalStatePayments: 'Tổng thanh toán tiểu bang',
  stateRefund: 'Hoàn thuế tiểu bang',
  stateAmountOwed: 'Số tiền nợ tiểu bang',
  taxYear: 'Năm thuế',
}
