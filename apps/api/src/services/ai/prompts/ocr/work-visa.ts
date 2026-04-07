/**
 * Work Visa OCR Extraction Prompt
 * US Work Visa (H-1B, L-1, O-1, TN, E-3, H-2B, etc.)
 */

export interface WorkVisaExtractedData {
  visaNumber: string | null
  visaType: string | null             // e.g., H-1B, L-1A, L-1B, O-1, TN, E-3, H-2B
  fullName: string | null
  sponsorCompany: string | null
  issuanceDate: string | null
  expirationDate: string | null
  entryDate: string | null
  i94Number: string | null
}

export function getWorkVisaExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from US Work Visas and related immigration documents (I-94, visa stamp, I-797 approval notice).

IMPORTANT: This document grants authorization to work in the United States under a specific visa category.

Extract the following fields:

VISA IDENTITY:
- visaNumber: Visa foil number or control number
- visaType: Visa classification (H-1B, L-1A, L-1B, O-1, O-1A, O-1B, TN, E-3, H-2B, H-2A, R-1, P-1)
- fullName: Full name of visa holder as printed

EMPLOYER / SPONSOR:
- sponsorCompany: Name of petitioning employer or sponsor company

DATES:
- issuanceDate: Date visa was issued (YYYY-MM-DD)
- expirationDate: Visa expiration date (YYYY-MM-DD)
- entryDate: Date of last US entry (from I-94, YYYY-MM-DD)

TRAVEL / ENTRY:
- i94Number: I-94 Arrival/Departure Record number (11 digits)

Respond in JSON format:
{
  "visaNumber": "20240012345678",
  "visaType": "H-1B",
  "fullName": "NGUYEN VAN A",
  "sponsorCompany": "ABC Technology Inc",
  "issuanceDate": "2023-10-01",
  "expirationDate": "2026-09-30",
  "entryDate": "2023-10-15",
  "i94Number": "12345678901"
}

Rules:
1. Use null for empty or missing fields, NEVER guess
2. Format all dates as YYYY-MM-DD
3. visaType: use exact classification from document (H-1B not H1B)
4. sponsorCompany: extract full legal company name if visible
5. i94Number is 11 digits; may appear on I-94 printout or stamp`
}

export function validateWorkVisaData(data: unknown): data is WorkVisaExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('fullName' in d)) return false
  return true
}

export const WORK_VISA_FIELD_LABELS_VI: Record<string, string> = {
  visaNumber: 'Số visa',
  visaType: 'Loại visa',
  fullName: 'Họ và tên',
  sponsorCompany: 'Công ty bảo lãnh',
  issuanceDate: 'Ngày cấp',
  expirationDate: 'Ngày hết hạn',
  entryDate: 'Ngày nhập cảnh',
  i94Number: 'Số I-94',
}
