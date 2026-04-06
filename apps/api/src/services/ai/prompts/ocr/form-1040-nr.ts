/**
 * Form 1040-NR OCR Extraction Prompt
 * U.S. Nonresident Alien Income Tax Return
 */

import type { TaxpayerAddress } from './form-1040'

export interface Form1040NRExtractedData {
  taxpayerName: string | null
  taxpayerITIN: string | null
  taxpayerAddress: TaxpayerAddress | null
  countryOfCitizenship: string | null
  countryOfResidence: string | null
  visaType: string | null

  filingStatus: string | null

  // Effectively Connected Income (ECI)
  wagesECI: number | null                   // Line 1a
  scholarshipsFellowships: number | null    // Line 1b
  businessIncome: number | null             // Line 2
  capitalGains: number | null               // Line 3
  otherECI: number | null                   // Line 4
  totalECI: number | null                   // Line 5

  // Income NOT Effectively Connected
  dividendsNotECI: number | null
  interestNotECI: number | null
  royaltiesNotECI: number | null
  withholdingOnNotECI: number | null        // 30% typically

  // Adjustments & AGI
  adjustedGrossIncome: number | null        // Line 12 (CRITICAL)

  // Deductions
  itemizedDeductions: number | null         // Line 13 (limited for NR)
  taxableIncome: number | null              // Line 15 (CRITICAL)

  // Tax Treaty Benefits
  treatyCountry: string | null
  treatyArticle: string | null
  treatyBenefitAmount: number | null

  // Tax Calculation
  taxOnECI: number | null
  taxOnNotECI: number | null                // 30% flat rate
  totalTax: number | null                   // Line 24

  // Payments & Refund
  federalWithholding: number | null
  estimatedTaxPayments: number | null
  amountOwed: number | null
  refundAmount: number | null

  taxYear: number | null
}

export function getForm1040NRExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1040-NR (Nonresident Alien Income Tax Return).

IMPORTANT: This form is for nonresident aliens. Key differences from regular 1040:
- Uses ITIN (not SSN typically)
- Income split into ECI (effectively connected) and non-ECI
- Limited filing statuses (no HOH or MFJ)
- Itemized deductions only (no standard deduction)
- Tax treaty benefits may apply

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerITIN (XXX-XX-XXXX format)
- taxpayerAddress: { street, aptNo, city, state, zip, country } (country field important for NR filers)
- countryOfCitizenship, countryOfResidence
- visaType (e.g., F-1, H-1B, J-1)

FILING STATUS:
- filingStatus: Single, Married filing separately, or Qualifying surviving spouse

EFFECTIVELY CONNECTED INCOME (ECI):
- wagesECI (Line 1a), scholarshipsFellowships (1b)
- businessIncome (2), capitalGains (3), otherECI (4)
- totalECI (Line 5)

INCOME NOT EFFECTIVELY CONNECTED:
- dividendsNotECI, interestNotECI, royaltiesNotECI
- withholdingOnNotECI (typically 30% flat rate)

ADJUSTMENTS & DEDUCTIONS:
- adjustedGrossIncome: Line 12 (CRITICAL)
- itemizedDeductions: Line 13
- taxableIncome: Line 15 (CRITICAL)

TAX TREATY BENEFITS (Schedule OI or separate section):
- treatyCountry, treatyArticle, treatyBenefitAmount

TAX CALCULATION:
- taxOnECI, taxOnNotECI (30% flat)
- totalTax: Line 24

PAYMENTS:
- federalWithholding, estimatedTaxPayments
- amountOwed, refundAmount

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "AKIRA TANAKA",
  "taxpayerITIN": "XXX-XX-1234",
  "taxpayerAddress": { "street": "100 UNIVERSITY AVE", "aptNo": "APT 2", "city": "BOSTON", "state": "MA", "zip": "02115", "country": "Japan" },
  "countryOfCitizenship": "Japan",
  "countryOfResidence": "Japan",
  "visaType": "F-1",
  "filingStatus": "Single",
  "wagesECI": 25000.00,
  "scholarshipsFellowships": 15000.00,
  "businessIncome": null,
  "capitalGains": null,
  "otherECI": null,
  "totalECI": 40000.00,
  "dividendsNotECI": 500.00,
  "interestNotECI": 200.00,
  "royaltiesNotECI": null,
  "withholdingOnNotECI": 210.00,
  "adjustedGrossIncome": 40000.00,
  "itemizedDeductions": 5000.00,
  "taxableIncome": 35000.00,
  "treatyCountry": "Japan",
  "treatyArticle": "Article 20",
  "treatyBenefitAmount": 2000.00,
  "taxOnECI": 3800.00,
  "taxOnNotECI": 210.00,
  "totalTax": 4010.00,
  "federalWithholding": 5000.00,
  "estimatedTaxPayments": null,
  "amountOwed": null,
  "refundAmount": 990.00,
  "taxYear": 2024
}

Rules:
1. adjustedGrossIncome and taxableIncome are MOST CRITICAL
2. ECI taxed at graduated rates; non-ECI at 30% flat (or treaty rate)
3. Nonresidents generally cannot use standard deduction
4. ITIN format same as SSN: XXX-XX-XXXX
5. All monetary values as numbers without $ or commas
6. Use null for empty fields, NEVER guess`
}

export function validateForm1040NRData(data: unknown): data is Form1040NRExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  const hasMinimumData =
    d.taxYear !== null ||
    d.adjustedGrossIncome !== null ||
    d.totalTax !== null ||
    d.refundAmount !== null

  if (!hasMinimumData) return false
  if (d.adjustedGrossIncome !== null && d.adjustedGrossIncome !== undefined && typeof d.adjustedGrossIncome !== 'number') return false
  return true
}

export const FORM_1040_NR_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerITIN: 'ITIN Người nộp thuế',
  taxpayerAddress: 'Địa chỉ người nộp thuế',
  countryOfCitizenship: 'Quốc tịch',
  countryOfResidence: 'Quốc gia cư trú',
  visaType: 'Loại visa',
  filingStatus: 'Tình trạng khai thuế',
  wagesECI: 'Lương ECI (Dòng 1a)',
  scholarshipsFellowships: 'Học bổng (Dòng 1b)',
  businessIncome: 'Thu nhập kinh doanh (Dòng 2)',
  capitalGains: 'Lãi vốn (Dòng 3)',
  otherECI: 'Thu nhập ECI khác (Dòng 4)',
  totalECI: 'Tổng ECI (Dòng 5)',
  dividendsNotECI: 'Cổ tức ngoài ECI',
  interestNotECI: 'Lãi ngoài ECI',
  royaltiesNotECI: 'Tiền bản quyền ngoài ECI',
  withholdingOnNotECI: 'Khấu lưu ngoài ECI',
  adjustedGrossIncome: 'AGI (Dòng 12)',
  itemizedDeductions: 'Khấu trừ chi tiết (Dòng 13)',
  taxableIncome: 'Thu nhập chịu thuế (Dòng 15)',
  treatyCountry: 'Quốc gia hiệp ước',
  treatyArticle: 'Điều khoản hiệp ước',
  treatyBenefitAmount: 'Lợi ích hiệp ước',
  taxOnECI: 'Thuế trên ECI',
  taxOnNotECI: 'Thuế ngoài ECI (30%)',
  totalTax: 'Tổng thuế (Dòng 24)',
  federalWithholding: 'Thuế liên bang đã khấu lưu',
  estimatedTaxPayments: 'Thuế ước tính đã nộp',
  amountOwed: 'Số tiền nợ',
  refundAmount: 'Hoàn thuế',
  taxYear: 'Năm thuế',
}
