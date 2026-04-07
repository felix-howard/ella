/**
 * Naturalization Certificate OCR Extraction Prompt
 * Certificate of Naturalization (Form N-550 / N-570)
 */

export interface NaturalizationCertificateExtractedData {
  certificateNumber: string | null
  fullName: string | null
  formerName: string | null
  dateOfBirth: string | null
  countryOfBirth: string | null
  naturalizationDate: string | null
  courtLocation: string | null
}

export function getNaturalizationCertificateExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from US Naturalization Certificates (Form N-550 or N-570).

IMPORTANT: This official document proves US citizenship by naturalization. Handle with care.

Extract the following fields:

IDENTITY:
- certificateNumber: Certificate number printed on the document
- fullName: Full legal name after naturalization
- formerName: Name before naturalization (if listed, otherwise null)
- dateOfBirth: Date of birth (YYYY-MM-DD)
- countryOfBirth: Country of former allegiance / birth country

NATURALIZATION INFO:
- naturalizationDate: Date of naturalization / oath ceremony (YYYY-MM-DD)
- courtLocation: Court or USCIS office where naturalization occurred (city, state)

Respond in JSON format:
{
  "certificateNumber": "AAXXXXXXXX",
  "fullName": "JOHN NGUYEN",
  "formerName": "NGUYEN VAN A",
  "dateOfBirth": "1975-08-12",
  "countryOfBirth": "VIETNAM",
  "naturalizationDate": "2015-06-04",
  "courtLocation": "Los Angeles, California"
}

Rules:
1. Use null for empty or missing fields, NEVER guess
2. Format all dates as YYYY-MM-DD
3. formerName: extract only if explicitly labeled as former or previous name
4. courtLocation: combine city and state if both are visible
5. certificateNumber may be labeled "No." or "Certificate No." on the document`
}

export function validateNaturalizationCertificateData(data: unknown): data is NaturalizationCertificateExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('fullName' in d)) return false
  return true
}

export const NATURALIZATION_CERTIFICATE_FIELD_LABELS_VI: Record<string, string> = {
  certificateNumber: 'Số chứng chỉ',
  fullName: 'Họ và tên',
  formerName: 'Tên cũ',
  dateOfBirth: 'Ngày sinh',
  countryOfBirth: 'Quốc gia sinh',
  naturalizationDate: 'Ngày nhập tịch',
  courtLocation: 'Tòa án / Văn phòng nhập tịch',
}
