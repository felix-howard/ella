/**
 * Form 4797 OCR Extraction Prompt
 * Sales of Business Property
 */

export interface Form4797ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: Sales of Business Property (held >1 year)
  section1231Gains: Array<{
    description: string | null
    dateAcquired: string | null
    dateSold: string | null
    grossSalesPrice: number | null
    costBasis: number | null
    depreciation: number | null
    gainLoss: number | null
  }>
  totalSection1231GainLoss: number | null    // Line 7

  // Part II: Ordinary Gains/Losses
  ordinaryGains: Array<{
    description: string | null
    gainLoss: number | null
    ordinaryGainFromRecapture: number | null
  }>
  totalOrdinaryGainLoss: number | null       // Line 18

  // Part III: Recapture Under Section 1245/1250
  section1245Recapture: number | null
  section1250Recapture: number | null
  totalRecapture: number | null

  // Part IV: Installment Sales
  installmentSaleGain: number | null

  taxYear: number | null
}

export function getForm4797ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 4797 (Sales of Business Property).

IMPORTANT: This form reports gains/losses from business property sales. Accuracy is critical.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

PART I - SALES OF BUSINESS PROPERTY (held >1 year):
- section1231Gains: Array of { description, dateAcquired, dateSold, grossSalesPrice, costBasis, depreciation, gainLoss }
- totalSection1231GainLoss: Line 7 (IMPORTANT - flows to Schedule D or Form 1040)

PART II - ORDINARY GAINS/LOSSES:
- ordinaryGains: Array of { description, gainLoss, ordinaryGainFromRecapture }
- totalOrdinaryGainLoss: Line 18 (IMPORTANT - ordinary income)

PART III - RECAPTURE:
- section1245Recapture: Depreciation recapture on personal property
- section1250Recapture: Depreciation recapture on real property
- totalRecapture: Combined recapture amount

PART IV - INSTALLMENT SALES:
- installmentSaleGain: Gain from installment sales

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "section1231Gains": [
    {"description": "Office Building", "dateAcquired": "01/15/2018", "dateSold": "06/30/2024", "grossSalesPrice": 500000.00, "costBasis": 350000.00, "depreciation": 75000.00, "gainLoss": 225000.00}
  ],
  "totalSection1231GainLoss": 225000.00,
  "ordinaryGains": [],
  "totalOrdinaryGainLoss": null,
  "section1245Recapture": null,
  "section1250Recapture": 75000.00,
  "totalRecapture": 75000.00,
  "installmentSaleGain": null,
  "taxYear": 2024
}

Rules:
1. Section 1231 gains may be treated as capital gains
2. Depreciation recapture is taxed as ordinary income
3. All monetary values as numbers without $ or commas
4. Negative values indicate losses
5. Use null for empty fields, NEVER guess`
}

export function validateForm4797Data(data: unknown): data is Form4797ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (!Array.isArray(d.section1231Gains)) return false
  if (!Array.isArray(d.ordinaryGains)) return false
  if (d.totalSection1231GainLoss !== null && d.totalSection1231GainLoss !== undefined && typeof d.totalSection1231GainLoss !== 'number') return false
  return true
}

export const FORM_4797_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  totalSection1231GainLoss: 'Tổng lãi/lỗ Section 1231 (Dòng 7)',
  totalOrdinaryGainLoss: 'Tổng lãi/lỗ thông thường (Dòng 18)',
  section1245Recapture: 'Thu hồi Section 1245',
  section1250Recapture: 'Thu hồi Section 1250',
  totalRecapture: 'Tổng thu hồi khấu hao',
  installmentSaleGain: 'Lãi bán trả góp',
  taxYear: 'Năm thuế',
}
