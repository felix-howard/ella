/**
 * Form 8332 OCR Extraction Prompt
 * Release/Revocation of Release of Claim to Exemption for Child
 */

export interface Form8332ExtractedData {
  childName: string | null
  childSSN: string | null
  custodialParentName: string | null
  custodialParentSSN: string | null
  custodialParentAddress: string | null
  noncustodialParentName: string | null
  noncustodialParentSSN: string | null
  releaseType: 'CURRENT_YEAR' | 'FUTURE_YEARS' | 'SPECIFIC_YEARS' | null
  releaseYears: number[] | null
  releaseAllFutureYears: boolean
  signatureDate: string | null
  signedByCustodialParent: boolean
  taxYear: number | null
}

export function get8332ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8332 (Release/Revocation of Release of Claim to Exemption for Child by Custodial Parent).

IMPORTANT: This form allows a custodial parent to release the child tax exemption to the noncustodial parent. Accuracy is critical.

Extract the following fields:

CHILD INFO:
- childName: Name of the child
- childSSN: Child's SSN (XXX-XX-XXXX)

CUSTODIAL PARENT (Part I signer):
- custodialParentName: Custodial parent's name
- custodialParentSSN: SSN (XXX-XX-XXXX)
- custodialParentAddress: Full address

NONCUSTODIAL PARENT:
- noncustodialParentName: Noncustodial parent's name
- noncustodialParentSSN: SSN (XXX-XX-XXXX)

RELEASE DETAILS:
- releaseType:
  "CURRENT_YEAR" if Part I release for current year only
  "FUTURE_YEARS" if Part I release for future years
  "SPECIFIC_YEARS" if specific years listed
- releaseYears: Array of specific tax years (e.g., [2024, 2025, 2026])
- releaseAllFutureYears: true if release covers all future years

SIGNATURE:
- signatureDate: Date signed (MM/DD/YYYY)
- signedByCustodialParent: true if custodial parent signed

METADATA:
- taxYear: Tax year this form relates to

Respond in JSON format:
{
  "childName": "JANE DOE JR",
  "childSSN": "XXX-XX-XXXX",
  "custodialParentName": "JANE DOE",
  "custodialParentSSN": "XXX-XX-XXXX",
  "custodialParentAddress": "123 Main St, City, ST 12345",
  "noncustodialParentName": "JOHN DOE",
  "noncustodialParentSSN": "XXX-XX-XXXX",
  "releaseType": "SPECIFIC_YEARS",
  "releaseYears": [2024, 2025],
  "releaseAllFutureYears": false,
  "signatureDate": "01/15/2024",
  "signedByCustodialParent": true,
  "taxYear": 2024
}

Rules:
1. Form must be signed by custodial parent to be valid
2. Check Part I (release) vs Part II (revocation) - extract from correct section
3. If Part III is filled, this is a revocation of a previous release
4. Use null for empty/unclear fields, NEVER guess`
}

export function validate8332Data(data: unknown): data is Form8332ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const requiredFields = ['childName', 'custodialParentName', 'noncustodialParentName']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }
  if (typeof d.releaseAllFutureYears !== 'boolean') return false
  if (typeof d.signedByCustodialParent !== 'boolean') return false
  if (d.releaseYears !== null && !Array.isArray(d.releaseYears)) return false
  return true
}

export const FORM_8332_FIELD_LABELS_VI: Record<string, string> = {
  childName: 'Tên Con',
  childSSN: 'SSN Con',
  custodialParentName: 'Tên Phụ huynh giám hộ',
  custodialParentSSN: 'SSN Phụ huynh giám hộ',
  custodialParentAddress: 'Địa chỉ Phụ huynh giám hộ',
  noncustodialParentName: 'Tên Phụ huynh không giám hộ',
  noncustodialParentSSN: 'SSN Phụ huynh không giám hộ',
  releaseType: 'Loại miễn trừ',
  releaseYears: 'Năm miễn trừ',
  releaseAllFutureYears: 'Miễn trừ tất cả năm tương lai',
  signatureDate: 'Ngày ký',
  signedByCustodialParent: 'Đã ký bởi phụ huynh giám hộ',
  taxYear: 'Năm thuế',
}
