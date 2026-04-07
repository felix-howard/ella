/**
 * Marriage Certificate OCR Extraction Prompt
 * Official Marriage Certificate / License
 */

export interface MarriageCertificateExtractedData {
  spouse1Name: string | null
  spouse2Name: string | null
  marriageDate: string | null
  marriageLocation: string | null     // city, state/country
  certificateNumber: string | null
  issueDate: string | null
}

export function getMarriageCertificateExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from Marriage Certificates or Marriage Licenses.

IMPORTANT: This legal document certifies the marriage of two individuals. It may be a US state-issued certificate or a foreign marriage certificate.

Extract the following fields:

PARTIES:
- spouse1Name: Full name of first spouse (as printed)
- spouse2Name: Full name of second spouse (as printed)

MARRIAGE INFO:
- marriageDate: Date the marriage took place (YYYY-MM-DD)
- marriageLocation: City and state/country where marriage occurred

DOCUMENT INFO:
- certificateNumber: Certificate or license number
- issueDate: Date the certificate was issued (YYYY-MM-DD); may differ from marriage date

Respond in JSON format:
{
  "spouse1Name": "NGUYEN VAN A",
  "spouse2Name": "TRAN THI B",
  "marriageDate": "2010-06-15",
  "marriageLocation": "Los Angeles, California",
  "certificateNumber": "2010-LA-00123",
  "issueDate": "2010-06-16"
}

Rules:
1. Use null for empty or missing fields, NEVER guess
2. Format all dates as YYYY-MM-DD
3. spouse1Name and spouse2Name: preserve full names as printed on document
4. marriageLocation: include both city and state/province/country when visible
5. issueDate may be same as or after marriageDate`
}

export function validateMarriageCertificateData(data: unknown): data is MarriageCertificateExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('spouse1Name' in d)) return false
  return true
}

export const MARRIAGE_CERTIFICATE_FIELD_LABELS_VI: Record<string, string> = {
  spouse1Name: 'Tên vợ/chồng 1',
  spouse2Name: 'Tên vợ/chồng 2',
  marriageDate: 'Ngày kết hôn',
  marriageLocation: 'Nơi kết hôn',
  certificateNumber: 'Số giấy chứng nhận',
  issueDate: 'Ngày cấp',
}
