/**
 * 1098-T OCR Extraction Prompt
 * Extracts structured data from IRS Form 1098-T (Tuition Statement)
 * Used for education credits (American Opportunity, Lifetime Learning)
 */

/**
 * 1098-T extracted data structure
 * Matches IRS Form 1098-T box layout
 */
export interface Form1098TExtractedData {
  // Filer/Institution Information
  filerName: string | null // School/college name
  filerAddress: string | null
  filerTIN: string | null // School's EIN
  filerPhone: string | null

  // Student Information
  studentName: string | null
  studentAddress: string | null
  studentTIN: string | null // Student's SSN
  accountNumber: string | null // Student ID

  // Tuition Information (Boxes 1-10)
  paymentsReceived: number | null // Box 1 - Payments received for qualified tuition
  amountsBilled: number | null // Box 2 - Amounts billed (if Box 1 not used)
  adjustmentsPriorYear: number | null // Box 4 - Adjustments made for a prior year
  scholarshipsGrants: number | null // Box 5 - Scholarships or grants
  adjustmentsScholarships: number | null // Box 6 - Adjustments to scholarships/grants for prior year
  includesJanMarch: boolean // Box 7 - Includes amounts for academic period beginning Jan-Mar
  halfTimeStudent: boolean // Box 8 - At least half-time student
  graduateStudent: boolean // Box 9 - Graduate student

  // Additional Information
  insuranceContractReimbursement: number | null // Box 10 - Insurance contract reimbursement

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate 1098-T OCR extraction prompt
 */
export function get1098TExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1098-T (Tuition Statement).

IMPORTANT: This form is used to claim education tax credits (American Opportunity, Lifetime Learning). Accuracy is critical.

Extract the following fields:

FILER/INSTITUTION INFORMATION:
- filerName: College/university/school name
- filerAddress: Institution's address
- filerTIN: Institution's EIN (XX-XXXXXXX)
- filerPhone: Contact phone

STUDENT INFORMATION:
- studentName: Student's name
- studentAddress: Student's address
- studentTIN: Student's SSN (XXX-XX-XXXX)
- accountNumber: Student ID number

TUITION INFORMATION:
- paymentsReceived: Box 1 - Payments received for qualified tuition and related expenses
  (MOST IMPORTANT - this is the amount paid for education)
- amountsBilled: Box 2 - Reserved/not commonly used now
- adjustmentsPriorYear: Box 4 - Adjustments for prior year
- scholarshipsGrants: Box 5 - Scholarships or grants
  (IMPORTANT - reduces the amount eligible for credit)
- adjustmentsScholarships: Box 6 - Adjustments to scholarships for prior year
- includesJanMarch: Box 7 - Checked if includes amounts for next year's term starting Jan-Mar
- halfTimeStudent: Box 8 - Checked if student was at least half-time
- graduateStudent: Box 9 - Checked if student was a graduate student
- insuranceContractReimbursement: Box 10 - Insurance contract reimbursement/refund

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "filerName": "State University",
  "filerAddress": "123 Campus Dr, City, ST 12345",
  "filerTIN": "XX-XXXXXXX",
  "filerPhone": "(555) 123-4567",
  "studentName": "JANE STUDENT",
  "studentAddress": "456 Dorm St, City, ST 12345",
  "studentTIN": "XXX-XX-XXXX",
  "accountNumber": "12345678",
  "paymentsReceived": 15000.00,
  "amountsBilled": null,
  "adjustmentsPriorYear": null,
  "scholarshipsGrants": 5000.00,
  "adjustmentsScholarships": null,
  "includesJanMarch": false,
  "halfTimeStudent": true,
  "graduateStudent": false,
  "insuranceContractReimbursement": null,
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 1 minus Box 5 = net qualified expenses for credit calculation
2. Box 8 (half-time) is required for American Opportunity Credit
3. Graduate students typically use Lifetime Learning Credit
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1098-T extracted data
 */
export function validate1098TData(data: unknown): data is Form1098TExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['filerName', 'studentName', 'studentTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false
  if (typeof d.halfTimeStudent !== 'boolean') return false
  if (typeof d.graduateStudent !== 'boolean') return false
  if (typeof d.includesJanMarch !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for 1098-T
 */
export const FORM_1098_T_FIELD_LABELS_VI: Record<string, string> = {
  filerName: 'Tên Trường học',
  filerAddress: 'Địa chỉ Trường',
  filerTIN: 'EIN Trường',
  filerPhone: 'Điện thoại Trường',
  studentName: 'Tên Sinh viên',
  studentAddress: 'Địa chỉ Sinh viên',
  studentTIN: 'SSN Sinh viên',
  accountNumber: 'Mã Sinh viên',
  paymentsReceived: 'Học phí đã trả (Box 1)',
  amountsBilled: 'Học phí ghi hóa đơn (Box 2)',
  adjustmentsPriorYear: 'Điều chỉnh năm trước (Box 4)',
  scholarshipsGrants: 'Học bổng/Trợ cấp (Box 5)',
  adjustmentsScholarships: 'Điều chỉnh học bổng (Box 6)',
  includesJanMarch: 'Bao gồm kỳ T1-T3 năm sau (Box 7)',
  halfTimeStudent: 'Sinh viên bán thời gian+ (Box 8)',
  graduateStudent: 'Sinh viên sau đại học (Box 9)',
  insuranceContractReimbursement: 'Hoàn bảo hiểm (Box 10)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
