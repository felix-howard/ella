/**
 * Form 8283 OCR Extraction Prompt
 * Noncash Charitable Contributions
 */

export interface Form8283ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Section A: Donated Property ≤$5,000
  sectionADonations: Array<{
    doneeOrganization: string | null
    doneeAddress: string | null
    description: string | null
    dateContributed: string | null
    dateAcquired: string | null
    howAcquired: string | null
    donorCostBasis: number | null
    fairMarketValue: number | null
    methodOfFMV: string | null
  }>

  // Section B: Donated Property >$5,000 (requires appraisal)
  sectionBDonations: Array<{
    doneeOrganization: string | null
    description: string | null
    dateContributed: string | null
    dateAcquired: string | null
    appraisedFMV: number | null
    costBasis: number | null
    amountClaimed: number | null
    appraiserName: string | null
    appraiserAddress: string | null
    appraisalDate: string | null
  }>

  totalNoncashDeduction: number | null

  taxYear: number | null
}

export function getForm8283ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8283 (Noncash Charitable Contributions).

IMPORTANT: This form reports noncash charitable donations (stocks, property, goods). Required when deduction >$500.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

SECTION A - DONATED PROPERTY ≤$5,000:
- sectionADonations: Array of { doneeOrganization, doneeAddress, description, dateContributed, dateAcquired, howAcquired (Purchase/Gift/Inheritance), donorCostBasis, fairMarketValue, methodOfFMV }

SECTION B - DONATED PROPERTY >$5,000 (appraisal required):
- sectionBDonations: Array of { doneeOrganization, description, dateContributed, dateAcquired, appraisedFMV, costBasis, amountClaimed, appraiserName, appraiserAddress, appraisalDate }

TOTALS:
- totalNoncashDeduction: Total noncash charitable deduction claimed

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "sectionADonations": [
    {"doneeOrganization": "Goodwill Industries", "doneeAddress": "200 Charity Ave, City, ST 12345", "description": "Clothing and household items", "dateContributed": "03/15/2024", "dateAcquired": "Various", "howAcquired": "Purchase", "donorCostBasis": 1200.00, "fairMarketValue": 800.00, "methodOfFMV": "Thrift shop value"}
  ],
  "sectionBDonations": [
    {"doneeOrganization": "Local Museum", "description": "Painting by Artist", "dateContributed": "06/01/2024", "dateAcquired": "05/2010", "appraisedFMV": 15000.00, "costBasis": 3000.00, "amountClaimed": 15000.00, "appraiserName": "Art Appraisals Inc", "appraiserAddress": "100 Art St", "appraisalDate": "05/15/2024"}
  ],
  "totalNoncashDeduction": 15800.00,
  "taxYear": 2024
}

Rules:
1. Section B required for single items >$5,000 with qualified appraisal
2. Stock donations: FMV = market value on date of contribution
3. All monetary values as numbers without $ or commas
4. Use null for empty fields, NEVER guess`
}

export function validateForm8283Data(data: unknown): data is Form8283ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (!Array.isArray(d.sectionADonations)) return false
  if (!Array.isArray(d.sectionBDonations)) return false
  if (d.totalNoncashDeduction !== null && d.totalNoncashDeduction !== undefined && typeof d.totalNoncashDeduction !== 'number') return false
  return true
}

export const FORM_8283_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  totalNoncashDeduction: 'Tổng khấu trừ hiện vật',
  taxYear: 'Năm thuế',
}
