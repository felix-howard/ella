/**
 * Form 8606 OCR Extraction Prompt
 * Nondeductible IRAs
 */

export interface Form8606ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: Nondeductible Contributions & Basis
  nondeductibleContributions: number | null   // Line 1
  totalBasisPriorYears: number | null         // Line 2
  totalBasis: number | null                   // Line 3 (Line 1 + Line 2)
  totalIRAValue: number | null               // Line 6 (year-end value all traditional IRAs)
  distributionsReceived: number | null        // Line 7
  nontaxablePortionOfDistribution: number | null // Line 13
  taxableAmountOfDistribution: number | null  // Line 15 (CRITICAL)
  basisRemainingEndOfYear: number | null      // Line 14

  // Part II: Roth Conversions
  rothConversionAmount: number | null         // Line 16
  rothConversionTaxable: number | null        // Line 18 (CRITICAL)

  // Part III: Roth IRA Distributions
  rothDistributions: number | null            // Line 19
  rothContributionBasis: number | null        // Line 22
  rothTaxableAmount: number | null            // Line 25

  taxYear: number | null
}

export function getForm8606ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8606 (Nondeductible IRAs).

IMPORTANT: This form tracks IRA basis and Roth conversions. Critical for avoiding double taxation.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

PART I - NONDEDUCTIBLE CONTRIBUTIONS & BASIS:
- nondeductibleContributions: Line 1 (current year nondeductible contributions)
- totalBasisPriorYears: Line 2 (basis from prior years)
- totalBasis: Line 3 (Line 1 + Line 2)
- totalIRAValue: Line 6 (total value of all traditional IRAs at year-end)
- distributionsReceived: Line 7
- nontaxablePortionOfDistribution: Line 13
- basisRemainingEndOfYear: Line 14
- taxableAmountOfDistribution: Line 15 (CRITICAL - taxable portion)

PART II - ROTH CONVERSIONS:
- rothConversionAmount: Line 16 (amount converted to Roth)
- rothConversionTaxable: Line 18 (CRITICAL - taxable portion of conversion)

PART III - ROTH IRA DISTRIBUTIONS:
- rothDistributions: Line 19
- rothContributionBasis: Line 22 (total Roth contributions basis)
- rothTaxableAmount: Line 25

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "nondeductibleContributions": 7000.00,
  "totalBasisPriorYears": 35000.00,
  "totalBasis": 42000.00,
  "totalIRAValue": 150000.00,
  "distributionsReceived": null,
  "nontaxablePortionOfDistribution": null,
  "taxableAmountOfDistribution": null,
  "basisRemainingEndOfYear": 42000.00,
  "rothConversionAmount": 50000.00,
  "rothConversionTaxable": 36000.00,
  "rothDistributions": null,
  "rothContributionBasis": null,
  "rothTaxableAmount": null,
  "taxYear": 2024
}

Rules:
1. Line 15 and Line 18 are most important for tax calculation
2. Basis tracking prevents double taxation of nondeductible contributions
3. All monetary values as numbers without $ or commas
4. Use null for empty fields, NEVER guess`
}

export function validateForm8606Data(data: unknown): data is Form8606ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (d.rothConversionTaxable !== null && d.rothConversionTaxable !== undefined && typeof d.rothConversionTaxable !== 'number') return false
  if (d.taxableAmountOfDistribution !== null && d.taxableAmountOfDistribution !== undefined && typeof d.taxableAmountOfDistribution !== 'number') return false
  return true
}

export const FORM_8606_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  nondeductibleContributions: 'Đóng góp không khấu trừ (Dòng 1)',
  totalBasisPriorYears: 'Cơ sở năm trước (Dòng 2)',
  totalBasis: 'Tổng cơ sở (Dòng 3)',
  totalIRAValue: 'Tổng giá trị IRA (Dòng 6)',
  distributionsReceived: 'Phân phối nhận được (Dòng 7)',
  nontaxablePortionOfDistribution: 'Phần không chịu thuế (Dòng 13)',
  basisRemainingEndOfYear: 'Cơ sở còn lại cuối năm (Dòng 14)',
  taxableAmountOfDistribution: 'Phần chịu thuế (Dòng 15)',
  rothConversionAmount: 'Số tiền chuyển đổi Roth (Dòng 16)',
  rothConversionTaxable: 'Phần chịu thuế chuyển đổi Roth (Dòng 18)',
  rothDistributions: 'Phân phối Roth (Dòng 19)',
  rothContributionBasis: 'Cơ sở đóng góp Roth (Dòng 22)',
  rothTaxableAmount: 'Phần chịu thuế Roth (Dòng 25)',
  taxYear: 'Năm thuế',
}
