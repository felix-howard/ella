/**
 * Divorce Decree OCR Extraction Prompt
 * Final Decree of Divorce / Dissolution of Marriage
 */

export interface DivorceDecreeExtractedData {
  petitionerName: string | null
  respondentName: string | null
  divorceDate: string | null
  caseNumber: string | null
  court: string | null
  alimonyAmount: number | null
  alimonyFrequency: 'MONTHLY' | 'YEARLY' | null
  childSupportAmount: number | null
  custodyArrangement: string | null
}

export function getDivorceDecreeExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from Divorce Decrees or Final Decrees of Dissolution of Marriage.

IMPORTANT: This legal document finalizes a divorce and may contain financial obligations relevant to tax filings (alimony, child support).

Extract the following fields:

PARTIES:
- petitionerName: Full name of the petitioner (the party who filed)
- respondentName: Full name of the respondent (the other party)

CASE INFO:
- divorceDate: Date the divorce was finalized / decree entered (YYYY-MM-DD)
- caseNumber: Court case number or docket number
- court: Name of the court that issued the decree

FINANCIAL OBLIGATIONS:
- alimonyAmount: Monthly or yearly alimony/spousal support amount as a number (no $ or commas)
- alimonyFrequency: "MONTHLY" or "YEARLY" based on how alimony is stated
- childSupportAmount: Child support payment amount as a number (no $ or commas)

CUSTODY:
- custodyArrangement: Brief description of custody arrangement (e.g., "Joint legal, mother primary physical")

Respond in JSON format:
{
  "petitionerName": "NGUYEN VAN A",
  "respondentName": "TRAN THI B",
  "divorceDate": "2022-09-30",
  "caseNumber": "22FL012345",
  "court": "Superior Court of California, Los Angeles County",
  "alimonyAmount": 1500,
  "alimonyFrequency": "MONTHLY",
  "childSupportAmount": 800,
  "custodyArrangement": "Joint legal custody, mother primary physical custody"
}

Rules:
1. Use null for empty or missing fields, NEVER guess
2. Format all dates as YYYY-MM-DD
3. alimonyAmount and childSupportAmount: numbers only, no currency symbols
4. alimonyFrequency: only "MONTHLY" or "YEARLY"; null if not determinable
5. Post-2018 divorces: alimony no longer deductible — note divorceDate for tax relevance`
}

export function validateDivorceDecreeData(data: unknown): data is DivorceDecreeExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('petitionerName' in d)) return false
  if (d.alimonyAmount !== null && d.alimonyAmount !== undefined && typeof d.alimonyAmount !== 'number') return false
  if (d.childSupportAmount !== null && d.childSupportAmount !== undefined && typeof d.childSupportAmount !== 'number') return false
  if (d.alimonyFrequency !== null && d.alimonyFrequency !== undefined &&
      d.alimonyFrequency !== 'MONTHLY' && d.alimonyFrequency !== 'YEARLY') return false
  return true
}

export const DIVORCE_DECREE_FIELD_LABELS_VI: Record<string, string> = {
  petitionerName: 'Tên nguyên đơn',
  respondentName: 'Tên bị đơn',
  divorceDate: 'Ngày ly hôn',
  caseNumber: 'Số vụ án',
  court: 'Tòa án',
  alimonyAmount: 'Số tiền cấp dưỡng vợ/chồng',
  alimonyFrequency: 'Chu kỳ cấp dưỡng',
  childSupportAmount: 'Số tiền cấp dưỡng con',
  custodyArrangement: 'Thỏa thuận nuôi con',
}
