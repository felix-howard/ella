/**
 * Form 8863 OCR Extraction Prompt
 * Education Credits (AOTC and Lifetime Learning)
 */

export interface Form8863ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Students
  students: Array<{
    studentName: string | null
    studentSSN: string | null
    institutionName: string | null
    institutionEIN: string | null
    qualifiedExpenses: number | null
    creditType: 'AOTC' | 'LLC' | null
  }>

  // Part I: Refundable American Opportunity Credit
  tentativeAOTC: number | null               // Line 1
  refundableAOTC: number | null              // Line 8 (CRITICAL - 40% refundable)

  // Part II: Nonrefundable Education Credits
  nonrefundableAOTC: number | null           // Line 9 (60% nonrefundable)
  lifetimeLearningCredit: number | null      // Line 10
  totalNonrefundableCredits: number | null   // Line 19 → Schedule 3

  // Part III: Student & School Info (per student)
  totalQualifiedExpenses: number | null
  americanOpportunityCredit: number | null   // Max $2,500 per student
  totalEducationCredits: number | null       // All credits combined

  taxYear: number | null
}

export function getForm8863ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8863 (Education Credits).

IMPORTANT: This form calculates AOTC (American Opportunity) and Lifetime Learning credits.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

STUDENTS:
- students: Array of { studentName, studentSSN, institutionName, institutionEIN, qualifiedExpenses, creditType ("AOTC" or "LLC") }

PART I - REFUNDABLE AOTC:
- tentativeAOTC: Line 1 (tentative American Opportunity Credit)
- refundableAOTC: Line 8 (CRITICAL - 40% of AOTC is refundable → Form 1040 Line 29)

PART II - NONREFUNDABLE CREDITS:
- nonrefundableAOTC: Line 9 (60% of AOTC)
- lifetimeLearningCredit: Line 10 (20% of first $10,000 expenses)
- totalNonrefundableCredits: Line 19 (CRITICAL → Schedule 3 Line 3)

TOTALS:
- totalQualifiedExpenses: Sum of all qualified education expenses
- americanOpportunityCredit: Per-student AOTC (max $2,500 each)
- totalEducationCredits: Combined all education credits

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "students": [
    {"studentName": "Jane Doe", "studentSSN": "XXX-XX-XXXX", "institutionName": "State University", "institutionEIN": "XX-XXXXXXX", "qualifiedExpenses": 8000.00, "creditType": "AOTC"}
  ],
  "tentativeAOTC": 2500.00,
  "refundableAOTC": 1000.00,
  "nonrefundableAOTC": 1500.00,
  "lifetimeLearningCredit": null,
  "totalNonrefundableCredits": 1500.00,
  "totalQualifiedExpenses": 8000.00,
  "americanOpportunityCredit": 2500.00,
  "totalEducationCredits": 2500.00,
  "taxYear": 2024
}

Rules:
1. AOTC max $2,500/student (100% first $2,000 + 25% next $2,000)
2. 40% of AOTC is refundable (Line 8), 60% nonrefundable (Line 9)
3. Lifetime Learning Credit: 20% of first $10,000, max $2,000
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

export function validateForm8863Data(data: unknown): data is Form8863ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (!Array.isArray(d.students)) return false
  if (d.refundableAOTC !== null && d.refundableAOTC !== undefined && typeof d.refundableAOTC !== 'number') return false
  if (d.totalEducationCredits !== null && d.totalEducationCredits !== undefined && typeof d.totalEducationCredits !== 'number') return false
  return true
}

export const FORM_8863_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  tentativeAOTC: 'AOTC tạm tính (Dòng 1)',
  refundableAOTC: 'AOTC hoàn lại (Dòng 8)',
  nonrefundableAOTC: 'AOTC không hoàn lại (Dòng 9)',
  lifetimeLearningCredit: 'Tín dụng học tập suốt đời (Dòng 10)',
  totalNonrefundableCredits: 'Tổng tín dụng không hoàn lại (Dòng 19)',
  totalQualifiedExpenses: 'Tổng chi phí đủ điều kiện',
  americanOpportunityCredit: 'Tín dụng Cơ hội Mỹ',
  totalEducationCredits: 'Tổng tín dụng giáo dục',
  taxYear: 'Năm thuế',
}
