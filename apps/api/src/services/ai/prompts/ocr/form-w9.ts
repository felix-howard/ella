/**
 * Form W-9 OCR Extraction Prompt
 * Request for Taxpayer Identification Number and Certification
 */

export interface FormW9ExtractedData {
  // Line 1: Name
  name: string | null

  // Line 2: Business Name
  businessName: string | null

  // Line 3: Tax Classification
  taxClassification: 'INDIVIDUAL' | 'C_CORP' | 'S_CORP' | 'PARTNERSHIP' | 'TRUST_ESTATE' | 'LLC' | 'OTHER' | null
  llcClassification: string | null           // If LLC: C, S, or P

  // Line 4: Exemptions
  exemptPayeeCode: string | null
  fatcaExemptionCode: string | null

  // Lines 5-6: Address
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null

  // Line 7: Account Numbers
  accountNumbers: string | null

  // Part I: TIN
  tin: string | null                         // SSN or EIN (CRITICAL)
  tinType: 'SSN' | 'EIN' | null

  // Part II: Certification
  certificationDate: string | null
  subjectToBackupWithholding: boolean | null

  taxYear: number | null
}

export function getFormW9ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form W-9 (Request for Taxpayer Identification Number and Certification).

IMPORTANT: W-9 collects vendor TIN for 1099 reporting. Not filed with IRS directly.

Extract the following fields:

LINE 1 - NAME:
- name (as shown on tax return)

LINE 2 - BUSINESS NAME:
- businessName (if different from Line 1)

LINE 3 - TAX CLASSIFICATION:
- taxClassification: INDIVIDUAL, C_CORP, S_CORP, PARTNERSHIP, TRUST_ESTATE, LLC, or OTHER
- llcClassification: If LLC, the tax classification (C, S, or P)

LINE 4 - EXEMPTIONS:
- exemptPayeeCode, fatcaExemptionCode

LINES 5-6 - ADDRESS:
- address, city, state, zipCode

LINE 7:
- accountNumbers

PART I - TIN:
- tin (CRITICAL - SSN format XXX-XX-XXXX or EIN format XX-XXXXXXX)
- tinType: SSN or EIN

PART II - CERTIFICATION:
- certificationDate (YYYY-MM-DD)
- subjectToBackupWithholding (true/false)

METADATA:
- taxYear

Respond in JSON format:
{
  "name": "JOHN DOE",
  "businessName": "Doe Consulting LLC",
  "taxClassification": "LLC",
  "llcClassification": "S",
  "exemptPayeeCode": null,
  "fatcaExemptionCode": null,
  "address": "123 Main St",
  "city": "Anytown",
  "state": "CA",
  "zipCode": "90210",
  "accountNumbers": null,
  "tin": "XX-XXXXXXX",
  "tinType": "EIN",
  "certificationDate": "2024-01-15",
  "subjectToBackupWithholding": false,
  "taxYear": 2024
}

Rules:
1. TIN (SSN or EIN) is most important for 1099 reporting
2. Classify LLC by underlying tax election (C, S, or Partnership)
3. W-9 is kept by requester, not filed with IRS
4. Use null for empty fields, NEVER guess`
}

export function validateFormW9Data(data: unknown): data is FormW9ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('name' in d)) return false
  if (d.tin !== null && d.tin !== undefined && typeof d.tin !== 'string') return false
  return true
}

export const FORM_W9_FIELD_LABELS_VI: Record<string, string> = {
  name: 'Tên (Dòng 1)',
  businessName: 'Tên doanh nghiệp (Dòng 2)',
  taxClassification: 'Phân loại thuế (Dòng 3)',
  address: 'Địa chỉ (Dòng 5)',
  city: 'Thành phố',
  state: 'Tiểu bang',
  zipCode: 'Mã bưu chính',
  tin: 'TIN (SSN/EIN)',
  tinType: 'Loại TIN',
  certificationDate: 'Ngày chứng nhận',
  taxYear: 'Năm thuế',
}
