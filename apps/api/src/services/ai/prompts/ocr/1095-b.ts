/**
 * 1095-B OCR Extraction Prompt
 * Health Coverage - Reports minimum essential coverage for ACA compliance
 */

export interface Form1095BExtractedData {
  issuerName: string | null
  issuerEIN: string | null
  issuerAddress: string | null
  issuerPhone: string | null
  responsibleName: string | null
  responsibleSSN: string | null
  responsibleDOB: string | null
  responsibleAddress: string | null
  coverageType: 'SELF_ONLY' | 'SELF_PLUS_ONE' | 'FAMILY' | null
  policyNumber: string | null
  coveredIndividuals: Array<{
    name: string | null
    ssn: string | null
    dob: string | null
    coveredAllYear: boolean
    coveredMonths: boolean[] // 12 booleans, Jan-Dec
  }>
  originOfPolicy: 'EMPLOYER' | 'GOVERNMENT' | 'INDIVIDUAL_MARKET' | 'OTHER' | null
  taxYear: number | null
  corrected: boolean
}

export function get1095BExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1095-B (Health Coverage).

IMPORTANT: This form verifies minimum essential coverage under the ACA. Accuracy is critical.

Extract the following fields:

PART I - RESPONSIBLE INDIVIDUAL:
- responsibleName: Name of responsible individual
- responsibleSSN: SSN (XXX-XX-XXXX)
- responsibleDOB: Date of birth
- responsibleAddress: Full address

PART II - ISSUER/EMPLOYER INFO:
- issuerName: Insurance company or employer name
- issuerEIN: EIN (XX-XXXXXXX)
- issuerAddress: Full address
- issuerPhone: Contact phone

COVERAGE INFO:
- coverageType: "SELF_ONLY", "SELF_PLUS_ONE", or "FAMILY"
- policyNumber: Policy or group number
- originOfPolicy: "EMPLOYER", "GOVERNMENT", "INDIVIDUAL_MARKET", or "OTHER"

PART IV - COVERED INDIVIDUALS:
- coveredIndividuals: Array of each person covered
  For each: name, ssn, dob, coveredAllYear (boolean), coveredMonths (12 booleans for Jan-Dec)
  If "All 12 months" is checked, set coveredAllYear=true and all coveredMonths=true

METADATA:
- taxYear, corrected (boolean)

Respond in JSON format:
{
  "issuerName": "Blue Cross Blue Shield",
  "issuerEIN": "XX-XXXXXXX",
  "issuerAddress": "100 Insurance Ave, City, ST 12345",
  "issuerPhone": "(555) 123-4567",
  "responsibleName": "JOHN DOE",
  "responsibleSSN": "XXX-XX-XXXX",
  "responsibleDOB": "01/15/1980",
  "responsibleAddress": "123 Main St, City, ST 12345",
  "coverageType": "FAMILY",
  "policyNumber": "GRP-123456",
  "coveredIndividuals": [
    {"name": "JOHN DOE", "ssn": "XXX-XX-XXXX", "dob": "01/15/1980", "coveredAllYear": true, "coveredMonths": [true,true,true,true,true,true,true,true,true,true,true,true]}
  ],
  "originOfPolicy": "EMPLOYER",
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Use null for empty/unclear fields, NEVER guess
2. coveredMonths must be exactly 12 booleans (Jan=index 0, Dec=index 11)
3. If "All 12 months" checked, all months are true
4. SSN format: XXX-XX-XXXX`
}

export function validate1095BData(data: unknown): data is Form1095BExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const requiredFields = ['responsibleName', 'responsibleSSN', 'issuerName']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }
  if (!Array.isArray(d.coveredIndividuals)) return false
  if (typeof d.corrected !== 'boolean') return false
  return true
}

export const FORM_1095_B_FIELD_LABELS_VI: Record<string, string> = {
  issuerName: 'Tên Công ty bảo hiểm',
  issuerEIN: 'EIN Công ty',
  issuerAddress: 'Địa chỉ Công ty',
  issuerPhone: 'Điện thoại',
  responsibleName: 'Tên Người chịu trách nhiệm',
  responsibleSSN: 'SSN Người chịu trách nhiệm',
  responsibleDOB: 'Ngày sinh',
  responsibleAddress: 'Địa chỉ',
  coverageType: 'Loại bảo hiểm',
  policyNumber: 'Số hợp đồng',
  coveredIndividuals: 'Người được bảo hiểm',
  originOfPolicy: 'Nguồn bảo hiểm',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
