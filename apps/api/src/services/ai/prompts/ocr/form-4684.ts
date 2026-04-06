/**
 * Form 4684 OCR Extraction Prompt
 * Casualties and Thefts
 */

export interface Form4684ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Section A: Personal Use Property
  properties: Array<{
    description: string | null
    dateAcquired: string | null
    dateOfCasualty: string | null
    costBasis: number | null
    insuranceReimbursement: number | null
    fmvBeforeCasualty: number | null
    fmvAfterCasualty: number | null
    loss: number | null
  }>

  totalPersonalLoss: number | null           // Line 14
  gainFromInsurance: number | null            // Line 15
  federalDisasterDesignation: boolean | null
  femaDeclarationNumber: string | null

  // Section B: Business/Income-Producing Property
  businessProperties: Array<{
    description: string | null
    costBasis: number | null
    insuranceReimbursement: number | null
    loss: number | null
  }>

  // Totals
  netCasualtyLoss: number | null             // Line 18 (CRITICAL)
  per100Reduction: number | null             // $100 per casualty
  tenPercentAGIReduction: number | null      // 10% AGI floor
  deductibleCasualtyLoss: number | null      // Line 27 → Schedule A

  taxYear: number | null
}

export function getForm4684ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 4684 (Casualties and Thefts).

IMPORTANT: Post-2017, personal casualty losses limited to federally declared disasters only.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

SECTION A - PERSONAL USE PROPERTY:
- properties: Array of { description, dateAcquired, dateOfCasualty (YYYY-MM-DD), costBasis, insuranceReimbursement, fmvBeforeCasualty, fmvAfterCasualty, loss }
- totalPersonalLoss: Line 14
- gainFromInsurance: Line 15
- federalDisasterDesignation (true/false)
- femaDeclarationNumber (e.g., DR-4XXX)

SECTION B - BUSINESS PROPERTY:
- businessProperties: Array of { description, costBasis, insuranceReimbursement, loss }

TOTALS:
- netCasualtyLoss: Line 18
- per100Reduction: $100 reduction per casualty event
- tenPercentAGIReduction: 10% of AGI floor
- deductibleCasualtyLoss: Line 27 (CRITICAL → Schedule A)

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "properties": [
    {"description": "Primary residence - hurricane damage", "dateAcquired": "2015-03-01", "dateOfCasualty": "2024-09-15", "costBasis": 250000.00, "insuranceReimbursement": 180000.00, "fmvBeforeCasualty": 350000.00, "fmvAfterCasualty": 200000.00, "loss": 70000.00}
  ],
  "totalPersonalLoss": 70000.00,
  "gainFromInsurance": null,
  "federalDisasterDesignation": true,
  "femaDeclarationNumber": "DR-4828",
  "businessProperties": [],
  "netCasualtyLoss": 70000.00,
  "per100Reduction": 100.00,
  "tenPercentAGIReduction": 8000.00,
  "deductibleCasualtyLoss": 61900.00,
  "taxYear": 2024
}

Rules:
1. deductibleCasualtyLoss is most important (flows to Schedule A)
2. Post-2017: personal losses require federal disaster declaration
3. $100 per-event and 10% AGI floors apply to personal losses
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

export function validateForm4684Data(data: unknown): data is Form4684ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (!Array.isArray(d.properties)) return false
  if (!Array.isArray(d.businessProperties)) return false
  if (d.deductibleCasualtyLoss !== null && d.deductibleCasualtyLoss !== undefined && typeof d.deductibleCasualtyLoss !== 'number') return false
  return true
}

export const FORM_4684_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  totalPersonalLoss: 'Tổng thiệt hại cá nhân (Dòng 14)',
  federalDisasterDesignation: 'Thiên tai liên bang',
  femaDeclarationNumber: 'Số tuyên bố FEMA',
  netCasualtyLoss: 'Thiệt hại ròng (Dòng 18)',
  per100Reduction: 'Giảm trừ $100',
  tenPercentAGIReduction: 'Giảm trừ 10% AGI',
  deductibleCasualtyLoss: 'Thiệt hại được khấu trừ (Dòng 27)',
  taxYear: 'Năm thuế',
}
