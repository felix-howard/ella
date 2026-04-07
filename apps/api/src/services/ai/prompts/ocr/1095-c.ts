/**
 * 1095-C OCR Extraction Prompt
 * Employer-Provided Health Insurance Offer and Coverage
 */

export interface Form1095CExtractedData {
  employerName: string | null
  employerEIN: string | null
  employerAddress: string | null
  employerPhone: string | null
  employeeName: string | null
  employeeSSN: string | null
  employeeAddress: string | null
  monthlyData: Array<{
    month: number                           // 1-12
    offerOfCoverageCode: string | null      // Line 14
    employeeShareOfCost: number | null      // Line 15
    safeHarborCode: string | null           // Line 16
    coveredUnderPlan: boolean               // Part III
  }>
  allMonthsOfferCode: string | null
  coveredIndividuals: Array<{
    name: string | null
    ssn: string | null
    dob: string | null
    coveredMonths: boolean[] // 12 booleans
  }>
  taxYear: number | null
  corrected: boolean
}

export function get1095CExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1095-C (Employer-Provided Health Insurance Offer and Coverage).

IMPORTANT: This form is for ACA employer mandate compliance. Accuracy is critical.

Extract the following fields:

PART I - EMPLOYER INFO:
- employerName, employerEIN (XX-XXXXXXX), employerAddress, employerPhone

EMPLOYEE INFO:
- employeeName, employeeSSN (XXX-XX-XXXX), employeeAddress

PART II - MONTHLY OFFER/COVERAGE (Lines 14-16):
For each month (1-12) or "All 12 months" row:
- offerOfCoverageCode: Line 14 code (1A, 1B, 1C, 1D, 1E, 1F, 1G, 1H, 1I, 1J, 1K)
- employeeShareOfCost: Line 15 - Lowest cost monthly premium
- safeHarborCode: Line 16 code (2A, 2B, 2C, 2D, 2E, 2F, 2G, 2H, 2I)
- coveredUnderPlan: true if covered in Part III for this month

If "All 12 months" row is filled, apply to all 12 months.
- allMonthsOfferCode: The "All 12 months" code if present

PART III - COVERED INDIVIDUALS (self-insured employers only):
- coveredIndividuals: Array with name, ssn, dob, coveredMonths (12 booleans)

METADATA:
- taxYear, corrected (boolean)

Respond in JSON format:
{
  "employerName": "ABC Corporation",
  "employerEIN": "XX-XXXXXXX",
  "employerAddress": "100 Corp Dr, City, ST 12345",
  "employerPhone": "(555) 123-4567",
  "employeeName": "JOHN DOE",
  "employeeSSN": "XXX-XX-XXXX",
  "employeeAddress": "123 Main St, City, ST 12345",
  "monthlyData": [
    {"month": 1, "offerOfCoverageCode": "1E", "employeeShareOfCost": 150.00, "safeHarborCode": "2C", "coveredUnderPlan": true}
  ],
  "allMonthsOfferCode": "1E",
  "coveredIndividuals": [],
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Line 14 codes: 1A=MEC MV affordable, 1E=MEC MV to employee+dependents, etc.
2. Line 16 codes: 2C=enrolled in coverage, 2G=federal poverty line safe harbor
3. employeeShareOfCost is monthly amount without $ sign
4. Use null for empty/unclear fields, NEVER guess`
}

export function validate1095CData(data: unknown): data is Form1095CExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const requiredFields = ['employerName', 'employerEIN', 'employeeName', 'employeeSSN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }
  if (!Array.isArray(d.monthlyData)) return false
  if (!Array.isArray(d.coveredIndividuals)) return false
  if (typeof d.corrected !== 'boolean') return false
  return true
}

export const FORM_1095_C_FIELD_LABELS_VI: Record<string, string> = {
  employerName: 'Tên Chủ lao động',
  employerEIN: 'EIN Chủ lao động',
  employerAddress: 'Địa chỉ Chủ lao động',
  employerPhone: 'Điện thoại',
  employeeName: 'Tên Nhân viên',
  employeeSSN: 'SSN Nhân viên',
  employeeAddress: 'Địa chỉ Nhân viên',
  monthlyData: 'Dữ liệu hàng tháng',
  allMonthsOfferCode: 'Mã đề nghị tất cả tháng',
  coveredIndividuals: 'Người được bảo hiểm',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
