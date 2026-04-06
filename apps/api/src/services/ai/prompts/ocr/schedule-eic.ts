/**
 * Schedule EIC (Form 1040) OCR Extraction Prompt
 * Extracts structured data from Schedule EIC - Earned Income Credit
 * Qualifying child information for EIC eligibility
 */

export interface ScheduleEICChildInfo {
  childName: string | null
  childSSN: string | null
  yearOfBirth: number | null
  relationship: string | null
  monthsLivedWithYou: number | null
  studentUnder24: boolean | null
  permanentlyDisabled: boolean | null
}

export interface ScheduleEICExtractedData {
  taxYear: number | null
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Qualifying Children (up to 3)
  children: ScheduleEICChildInfo[]

  // From Form 1040 (reference)
  earnedIncome: number | null
  filingStatus: string | null
}

export function getScheduleEICExtractionPrompt(): string {
  return `You are an OCR system. Extract data from IRS Schedule EIC (Form 1040) - Earned Income Credit.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in the document
- If a field is blank or not visible, return null (never invent data)
- This schedule lists qualifying children for the Earned Income Credit

TAXPAYER INFO (top):
- Name as shown on Form 1040
- Social security number

QUALIFYING CHILD INFORMATION (up to 3 children):
For each child (Child 1, Child 2, Child 3):
- Line 1: Child's name (first, last)
- Line 2: Child's SSN
- Line 3: Child's year of birth
- Line 4: Relationship to you (son, daughter, stepchild, foster child, etc.)
- Line 5: Number of months child lived with you in the U.S.
- Line 6a: Was child under age 24, a full-time student? (Yes/No)
- Line 6b: Was child permanently and totally disabled? (Yes/No)

OUTPUT FORMAT (JSON):
{
  "taxYear": 2023,
  "taxpayerName": "John Doe",
  "taxpayerSSN": "XXX-XX-XXXX",
  "children": [
    {
      "childName": "Jane Doe",
      "childSSN": "XXX-XX-XXXX",
      "yearOfBirth": 2015,
      "relationship": "Daughter",
      "monthsLivedWithYou": 12,
      "studentUnder24": false,
      "permanentlyDisabled": false
    }
  ],
  "earnedIncome": null,
  "filingStatus": null
}

IMPORTANT:
- Return null for any field not found or blank
- Return empty array [] for children if none visible
- Up to 3 qualifying children can be listed
- SSN may be masked — return as-is`
}

export function validateScheduleEICData(data: unknown): data is ScheduleEICExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const hasChildren = Array.isArray(d.children) && d.children.length > 0
  const hasName = d.taxpayerName !== null && d.taxpayerName !== undefined && typeof d.taxpayerName === 'string'
  return hasChildren || hasName
}

export const SCHEDULE_EIC_FIELD_LABELS_VI: Record<string, string> = {
  taxYear: 'Năm thuế',
  taxpayerName: 'Tên người nộp thuế',
  taxpayerSSN: 'Số an sinh xã hội',
  children: 'Thông tin trẻ đủ điều kiện',
  earnedIncome: 'Thu nhập kiếm được',
  filingStatus: 'Tình trạng khai thuế',
}
