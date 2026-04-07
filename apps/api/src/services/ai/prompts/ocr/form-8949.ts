/**
 * Form 8949 OCR Extraction Prompt
 * Sales and Other Dispositions of Capital Assets
 */

export interface Form8949ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: Short-Term (held ≤1 year)
  shortTermTransactions: Array<{
    description: string | null              // Column (a)
    dateAcquired: string | null             // Column (b)
    dateSold: string | null                 // Column (c)
    proceeds: number | null                 // Column (d)
    costBasis: number | null                // Column (e)
    adjustmentCode: string | null           // Column (f)
    adjustmentAmount: number | null         // Column (g)
    gainLoss: number | null                 // Column (h)
  }>
  shortTermCheckbox: 'A' | 'B' | 'C' | null // Box checked (basis reported/not reported to IRS)

  // Part II: Long-Term (held >1 year)
  longTermTransactions: Array<{
    description: string | null
    dateAcquired: string | null
    dateSold: string | null
    proceeds: number | null
    costBasis: number | null
    adjustmentCode: string | null
    adjustmentAmount: number | null
    gainLoss: number | null
  }>
  longTermCheckbox: 'D' | 'E' | 'F' | null

  // Totals
  totalShortTermProceeds: number | null
  totalShortTermBasis: number | null
  totalShortTermGainLoss: number | null     // → Schedule D Line 1-3
  totalLongTermProceeds: number | null
  totalLongTermBasis: number | null
  totalLongTermGainLoss: number | null      // → Schedule D Line 8-10

  taxYear: number | null
}

export function getForm8949ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8949 (Sales and Other Dispositions of Capital Assets).

IMPORTANT: This form reports individual capital asset sales (stocks, bonds, crypto). Flows to Schedule D.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

PART I - SHORT-TERM (held ≤1 year):
- shortTermCheckbox: "A" (basis reported to IRS), "B" (basis not reported), or "C" (no 1099-B)
- shortTermTransactions: Array of { description, dateAcquired, dateSold, proceeds (Column d), costBasis (Column e), adjustmentCode (Column f), adjustmentAmount (Column g), gainLoss (Column h) }
- totalShortTermProceeds, totalShortTermBasis, totalShortTermGainLoss

PART II - LONG-TERM (held >1 year):
- longTermCheckbox: "D" (basis reported), "E" (basis not reported), or "F" (no 1099-B)
- longTermTransactions: Array of { description, dateAcquired, dateSold, proceeds, costBasis, adjustmentCode, adjustmentAmount, gainLoss }
- totalLongTermProceeds, totalLongTermBasis, totalLongTermGainLoss

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "shortTermCheckbox": "A",
  "shortTermTransactions": [
    {"description": "100 sh AAPL", "dateAcquired": "06/15/2024", "dateSold": "09/20/2024", "proceeds": 22000.00, "costBasis": 19500.00, "adjustmentCode": null, "adjustmentAmount": null, "gainLoss": 2500.00}
  ],
  "totalShortTermProceeds": 22000.00,
  "totalShortTermBasis": 19500.00,
  "totalShortTermGainLoss": 2500.00,
  "longTermCheckbox": "D",
  "longTermTransactions": [
    {"description": "50 sh MSFT", "dateAcquired": "01/10/2020", "dateSold": "08/15/2024", "proceeds": 21000.00, "costBasis": 8000.00, "adjustmentCode": null, "adjustmentAmount": null, "gainLoss": 13000.00}
  ],
  "totalLongTermProceeds": 21000.00,
  "totalLongTermBasis": 8000.00,
  "totalLongTermGainLoss": 13000.00,
  "taxYear": 2024
}

Rules:
1. Short-term totals → Schedule D Lines 1-3, Long-term → Lines 8-10
2. Adjustment codes: W (wash sale), B (basis incorrect), etc.
3. "Various" is valid for dateAcquired when multiple lots
4. All monetary values as numbers without $ or commas
5. Negative gainLoss = capital loss
6. Use null for empty fields, NEVER guess`
}

export function validateForm8949Data(data: unknown): data is Form8949ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (!Array.isArray(d.shortTermTransactions)) return false
  if (!Array.isArray(d.longTermTransactions)) return false
  if (d.totalShortTermGainLoss !== null && d.totalShortTermGainLoss !== undefined && typeof d.totalShortTermGainLoss !== 'number') return false
  if (d.totalLongTermGainLoss !== null && d.totalLongTermGainLoss !== undefined && typeof d.totalLongTermGainLoss !== 'number') return false
  return true
}

export const FORM_8949_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  shortTermCheckbox: 'Ô đánh dấu ngắn hạn',
  totalShortTermProceeds: 'Tổng tiền bán ngắn hạn',
  totalShortTermBasis: 'Tổng giá vốn ngắn hạn',
  totalShortTermGainLoss: 'Tổng lãi/lỗ ngắn hạn',
  longTermCheckbox: 'Ô đánh dấu dài hạn',
  totalLongTermProceeds: 'Tổng tiền bán dài hạn',
  totalLongTermBasis: 'Tổng giá vốn dài hạn',
  totalLongTermGainLoss: 'Tổng lãi/lỗ dài hạn',
  taxYear: 'Năm thuế',
}
