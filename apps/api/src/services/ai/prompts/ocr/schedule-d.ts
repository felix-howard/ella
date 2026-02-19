/**
 * Schedule D (Form 1040) OCR Extraction Prompt
 * Extracts structured data from Schedule D - Capital Gains and Losses
 * Line 16 -> Form 1040 Line 7 (Capital gain or loss)
 */

/**
 * Schedule D extracted data structure
 */
export interface ScheduleDExtractedData {
  taxYear: number | null
  name: string | null
  ssn: string | null

  // Part I - Short-Term Capital Gains and Losses (held 1 year or less)
  shortTermProceeds: number | null
  shortTermCostBasis: number | null
  shortTermAdjustments: number | null
  shortTermGainLoss: number | null
  shortTermFromForm8949BoxA: number | null // Line 1a
  shortTermFromForm8949BoxB: number | null // Line 1b
  shortTermFromForm8949BoxC: number | null // Line 2
  shortTermFromForm6252: number | null // Line 3
  shortTermGainFromOtherForms: number | null // Line 4
  netShortTermFromK1s: number | null // Line 5
  shortTermCarryover: number | null // Line 6
  netShortTermGainLoss: number | null // Line 7 - KEY

  // Part II - Long-Term Capital Gains and Losses (held more than 1 year)
  longTermProceeds: number | null
  longTermCostBasis: number | null
  longTermAdjustments: number | null
  longTermGainLoss: number | null
  longTermFromForm8949BoxD: number | null // Line 8a
  longTermFromForm8949BoxE: number | null // Line 8b
  longTermFromForm8949BoxF: number | null // Line 9
  longTermFromForm6252: number | null // Line 10
  longTermGainFromOtherForms: number | null // Line 11
  netLongTermFromK1s: number | null // Line 12
  capitalGainDistributions: number | null // Line 13
  longTermCarryover: number | null // Line 14
  netLongTermGainLoss: number | null // Line 15 - KEY

  // Part III - Summary
  totalCapitalGainLoss: number | null // Line 16 - MOST IMPORTANT
  netGainBothPositive: boolean | null // Line 17
  section1250GainWorksheet: number | null // Line 18
  unrecapturedSection1250: number | null // Line 19
  qualifiedDividendsBox: boolean | null // Line 20
  capitalLossLimitation: number | null // Line 21
}

/**
 * Generate Schedule D OCR extraction prompt
 */
export function getScheduleDExtractionPrompt(): string {
  return `You are an OCR system. Extract data from IRS Schedule D (Form 1040) - Capital Gains and Losses.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in the document
- If a field is blank or not visible, return null (never invent data)
- Monetary amounts: return as numbers without $ or commas (e.g., 15000.00)
- Negative amounts (losses) use negative numbers (e.g., -3000.00)
- This schedule summarizes capital gains/losses from stock sales, real estate, etc.

PART I - SHORT-TERM CAPITAL GAINS AND LOSSES (held 1 year or less):
- Lines 1a-2: Totals from Form 8949 Boxes A, B, C
- Line 3: Short-term gain from Form 6252 (installment sales)
- Line 4: Short-term gain from other forms (4684, 6781, 8824)
- Line 5: Net short-term from Schedule K-1s
- Line 6: Short-term capital loss carryover from prior year
- Line 7: NET SHORT-TERM CAPITAL GAIN OR LOSS (total of Lines 1-6)

PART II - LONG-TERM CAPITAL GAINS AND LOSSES (held more than 1 year):
- Lines 8a-9: Totals from Form 8949 Boxes D, E, F
- Line 10: Long-term gain from Form 6252
- Line 11: Long-term gain from other forms (2439, 4684, etc.)
- Line 12: Net long-term from Schedule K-1s
- Line 13: Capital gain distributions (1099-DIV Box 2a)
- Line 14: Long-term capital loss carryover from prior year
- Line 15: NET LONG-TERM CAPITAL GAIN OR LOSS (total of Lines 8-14)

PART III - SUMMARY:
- Line 16: TOTAL CAPITAL GAIN OR LOSS (Line 7 + Line 15) - MOST IMPORTANT
- Line 17: Checkbox if both Line 7 and Line 15 are gains
- Line 18: 28% rate gain from worksheet
- Line 19: Unrecaptured Section 1250 gain
- Line 20: Checkbox for qualified dividends
- Line 21: Capital loss limitation (maximum $3,000 deductible per year)

OUTPUT FORMAT (JSON):
{
  "taxYear": 2024,
  "name": "NGUYEN VAN ANH",
  "ssn": "XXX-XX-1234",
  "shortTermProceeds": 25000.00,
  "shortTermCostBasis": 20000.00,
  "shortTermAdjustments": null,
  "shortTermGainLoss": 5000.00,
  "shortTermFromForm8949BoxA": 5000.00,
  "shortTermFromForm8949BoxB": null,
  "shortTermFromForm8949BoxC": null,
  "shortTermFromForm6252": null,
  "shortTermGainFromOtherForms": null,
  "netShortTermFromK1s": null,
  "shortTermCarryover": null,
  "netShortTermGainLoss": 5000.00,
  "longTermProceeds": 100000.00,
  "longTermCostBasis": 75000.00,
  "longTermAdjustments": null,
  "longTermGainLoss": 25000.00,
  "longTermFromForm8949BoxD": 25000.00,
  "longTermFromForm8949BoxE": null,
  "longTermFromForm8949BoxF": null,
  "longTermFromForm6252": null,
  "longTermGainFromOtherForms": null,
  "netLongTermFromK1s": null,
  "capitalGainDistributions": 500.00,
  "longTermCarryover": null,
  "netLongTermGainLoss": 25500.00,
  "totalCapitalGainLoss": 30500.00,
  "netGainBothPositive": true,
  "section1250GainWorksheet": null,
  "unrecapturedSection1250": null,
  "qualifiedDividendsBox": true,
  "capitalLossLimitation": null
}

IMPORTANT REMINDERS:
- Return null for any field not found or blank - never guess
- Line 16 (totalCapitalGainLoss) is MOST CRITICAL - goes to Form 1040 Line 7
- Line 21 (capitalLossLimitation) applies when Line 16 is negative
- Capital losses limited to $3,000 per year ($1,500 if married filing separately)
- Carryover fields (Lines 6, 14) come from prior year Schedule D`
}

/**
 * Validate Schedule D extracted data
 * Requires at least one key capital gain/loss field
 */
export function validateScheduleDData(data: unknown): data is ScheduleDExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  const hasNetShortTerm =
    d.netShortTermGainLoss !== null &&
    d.netShortTermGainLoss !== undefined &&
    typeof d.netShortTermGainLoss === 'number'

  const hasNetLongTerm =
    d.netLongTermGainLoss !== null &&
    d.netLongTermGainLoss !== undefined &&
    typeof d.netLongTermGainLoss === 'number'

  const hasTotalCapitalGainLoss =
    d.totalCapitalGainLoss !== null &&
    d.totalCapitalGainLoss !== undefined &&
    typeof d.totalCapitalGainLoss === 'number'

  return hasNetShortTerm || hasNetLongTerm || hasTotalCapitalGainLoss
}

/**
 * Vietnamese field labels for Schedule D
 */
export const SCHEDULE_D_FIELD_LABELS_VI: Record<string, string> = {
  taxYear: 'Năm thuế',
  name: 'Tên',
  ssn: 'Số An sinh xã hội (SSN)',
  // Part I - Short-Term
  shortTermProceeds: 'Tiền thu ngắn hạn (Column d)',
  shortTermCostBasis: 'Giá gốc ngắn hạn (Column e)',
  shortTermAdjustments: 'Điều chỉnh ngắn hạn (Column g)',
  shortTermGainLoss: 'Lãi/lỗ ngắn hạn (Column h)',
  shortTermFromForm8949BoxA: 'Từ Form 8949 Box A (Line 1a)',
  shortTermFromForm8949BoxB: 'Từ Form 8949 Box B (Line 1b)',
  shortTermFromForm8949BoxC: 'Từ Form 8949 Box C (Line 2)',
  shortTermFromForm6252: 'Từ Form 6252 (Line 3)',
  shortTermGainFromOtherForms: 'Lãi từ form khác (Line 4)',
  netShortTermFromK1s: 'Từ K-1 ngắn hạn (Line 5)',
  shortTermCarryover: 'Lỗ ngắn hạn chuyển từ năm trước (Line 6)',
  netShortTermGainLoss: 'Lãi/lỗ ngắn hạn ròng (Line 7)',
  // Part II - Long-Term
  longTermProceeds: 'Tiền thu dài hạn (Column d)',
  longTermCostBasis: 'Giá gốc dài hạn (Column e)',
  longTermAdjustments: 'Điều chỉnh dài hạn (Column g)',
  longTermGainLoss: 'Lãi/lỗ dài hạn (Column h)',
  longTermFromForm8949BoxD: 'Từ Form 8949 Box D (Line 8a)',
  longTermFromForm8949BoxE: 'Từ Form 8949 Box E (Line 8b)',
  longTermFromForm8949BoxF: 'Từ Form 8949 Box F (Line 9)',
  longTermFromForm6252: 'Từ Form 6252 (Line 10)',
  longTermGainFromOtherForms: 'Lãi từ form khác (Line 11)',
  netLongTermFromK1s: 'Từ K-1 dài hạn (Line 12)',
  capitalGainDistributions: 'Phân phối lãi vốn (Line 13)',
  longTermCarryover: 'Lỗ dài hạn chuyển từ năm trước (Line 14)',
  netLongTermGainLoss: 'Lãi/lỗ dài hạn ròng (Line 15)',
  // Part III - Summary
  totalCapitalGainLoss: 'Tổng lãi/lỗ vốn (Line 16)',
  netGainBothPositive: 'Cả hai lãi (Line 17)',
  section1250GainWorksheet: 'Lãi 28% (Line 18)',
  unrecapturedSection1250: 'Unrecaptured Section 1250 (Line 19)',
  qualifiedDividendsBox: 'Cổ tức cổ phần (Line 20)',
  capitalLossLimitation: 'Giới hạn lỗ vốn (Line 21)',
}
