/**
 * Green Card OCR Extraction Prompt
 * Permanent Resident Card (Form I-551)
 */

export interface GreenCardExtractedData {
  cardNumber: string | null          // A-number (Alien Registration Number)
  fullName: string | null
  dateOfBirth: string | null
  cardIssueDate: string | null
  cardExpiryDate: string | null
  residencyStartDate: string | null
  countryOfBirth: string | null
  categoryCode: string | null        // e.g., IR1, LB1, EB1, etc.
}

export function getGreenCardExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from US Permanent Resident Cards (Green Cards / Form I-551).

IMPORTANT: This is a US immigration document granting permanent resident status. Handle with care.

Extract the following fields:

IDENTITY:
- cardNumber: A-number (Alien Registration Number), format A followed by 8-9 digits (e.g., A123456789)
- fullName: Full legal name as printed on card (LAST, FIRST MIDDLE)
- dateOfBirth: Date of birth in YYYY-MM-DD format
- countryOfBirth: Country of birth as printed

DATES:
- cardIssueDate: Card issue date (YYYY-MM-DD)
- cardExpiryDate: Card expiration date (YYYY-MM-DD); null if card is "PERMANENT"
- residencyStartDate: Date permanent residency began (YYYY-MM-DD)

CATEGORY:
- categoryCode: Immigrant visa category code (e.g., IR1, LB1, EB1, CR6, DV1)

Respond in JSON format:
{
  "cardNumber": "A123456789",
  "fullName": "NGUYEN, VAN A",
  "dateOfBirth": "1980-05-20",
  "cardIssueDate": "2020-03-15",
  "cardExpiryDate": "2030-03-14",
  "residencyStartDate": "2020-03-15",
  "countryOfBirth": "VIETNAM",
  "categoryCode": "IR1"
}

Rules:
1. A-number may be printed as "A#" or "USCIS#" on newer cards
2. Use null for empty or missing fields, NEVER guess
3. Format all dates as YYYY-MM-DD
4. If card reads "PERMANENT" for expiry, set cardExpiryDate to null
5. fullName: preserve as printed on card including commas`
}

export function validateGreenCardData(data: unknown): data is GreenCardExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('fullName' in d)) return false
  return true
}

export const GREEN_CARD_FIELD_LABELS_VI: Record<string, string> = {
  cardNumber: 'Số thẻ (A-Number)',
  fullName: 'Họ và tên',
  dateOfBirth: 'Ngày sinh',
  cardIssueDate: 'Ngày cấp thẻ',
  cardExpiryDate: 'Ngày hết hạn thẻ',
  residencyStartDate: 'Ngày bắt đầu thường trú',
  countryOfBirth: 'Quốc gia sinh',
  categoryCode: 'Mã danh mục visa',
}
