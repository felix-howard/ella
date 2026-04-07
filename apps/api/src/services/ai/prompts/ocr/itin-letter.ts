/**
 * ITIN Letter OCR Extraction Prompt
 * IRS Individual Taxpayer Identification Number Assignment Letter
 */

export interface ItinLetterExtractedData {
  recipientName: string | null
  itin: string | null                                    // format: XXX-XX-XXXX
  issuanceDate: string | null
  expirationDate: string | null
  letterDate: string | null
  irsCenter: string | null
  applicationType: 'INITIAL' | 'RENEWAL' | null
}

export function getItinLetterExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS ITIN Assignment Letters (CP565, CP566, or similar).

IMPORTANT: This letter confirms the assignment or renewal of an Individual Taxpayer Identification Number (ITIN) by the IRS.

Extract the following fields:

RECIPIENT INFO:
- recipientName: Full name of the person the ITIN was assigned to
- itin: The ITIN number assigned (format: XXX-XX-XXXX, starts with 9)

DATES:
- issuanceDate: Date the ITIN was issued or assigned
- expirationDate: Date the ITIN expires (if shown)
- letterDate: Date printed on the letter

IRS INFO:
- irsCenter: IRS campus or processing center name
- applicationType: "INITIAL" for new ITIN, "RENEWAL" for renewal

Respond in JSON format:
{
  "recipientName": "NGUYEN VAN A",
  "itin": "9XX-XX-XXXX",
  "issuanceDate": "2024-01-15",
  "expirationDate": "2026-12-31",
  "letterDate": "2024-01-20",
  "irsCenter": "Austin Service Center",
  "applicationType": "INITIAL"
}

Rules:
1. ITIN always starts with digit 9 (format 9XX-XX-XXXX)
2. Use null for empty or missing fields, NEVER guess
3. Format all dates as YYYY-MM-DD
4. applicationType: look for keywords like "renewal", "new application", "initial"
5. All monetary values as numbers without $ or commas`
}

export function validateItinLetterData(data: unknown): data is ItinLetterExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('recipientName' in d)) return false
  if (d.applicationType !== null && d.applicationType !== undefined &&
      d.applicationType !== 'INITIAL' && d.applicationType !== 'RENEWAL') return false
  return true
}

export const ITIN_LETTER_FIELD_LABELS_VI: Record<string, string> = {
  recipientName: 'Tên người nhận',
  itin: 'Số ITIN',
  issuanceDate: 'Ngày cấp',
  expirationDate: 'Ngày hết hạn',
  letterDate: 'Ngày thư',
  irsCenter: 'Trung tâm IRS',
  applicationType: 'Loại hồ sơ',
}
