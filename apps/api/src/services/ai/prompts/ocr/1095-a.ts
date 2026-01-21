/**
 * 1095-A OCR Extraction Prompt
 * Extracts structured data from IRS Form 1095-A (Health Insurance Marketplace Statement)
 */

/**
 * 1095-A extracted data structure
 * Matches IRS Form 1095-A layout (Parts I, II, III)
 */
export interface Form1095AExtractedData {
  // Marketplace Information (Part I)
  marketplaceName: string | null
  marketplaceId: string | null
  policyNumber: string | null
  policyStartDate: string | null
  policyEndDate: string | null

  // Recipient/Taxpayer Information (Part I)
  recipientName: string | null
  recipientSSN: string | null
  recipientAddress: string | null
  recipientDOB: string | null

  // Spouse Information (Part I)
  spouseName: string | null
  spouseSSN: string | null
  spouseDOB: string | null

  // Coverage Information (Part II - covered individuals)
  coveredIndividuals: Array<{
    name: string | null
    ssn: string | null
    dob: string | null
    coverageStartDate: string | null
    coverageEndDate: string | null
  }>

  // Monthly Premium Information (Part III)
  monthlyData: Array<{
    month: string
    enrollmentPremium: number | null // Column A - Monthly enrollment premiums
    slcsp: number | null // Column B - Monthly SLCSP premium
    advancePayment: number | null // Column C - Monthly advance payment of PTC
  }>

  // Annual Totals
  annualEnrollmentPremium: number | null // Row 33A
  annualSlcsp: number | null // Row 33B
  annualAdvancePayment: number | null // Row 33C

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate 1095-A OCR extraction prompt
 */
export function get1095AExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1095-A (Health Insurance Marketplace Statement).

IMPORTANT: This form is required to reconcile Premium Tax Credit. Accuracy is critical.

Extract the following fields:

PART I - MARKETPLACE/POLICY INFO:
- marketplaceName: Name of the Health Insurance Marketplace
- marketplaceId: Marketplace identifier
- policyNumber: Policy number
- policyStartDate/policyEndDate: Policy effective dates

RECIPIENT INFORMATION:
- recipientName: Primary taxpayer name
- recipientSSN: Primary taxpayer SSN
- recipientAddress: Mailing address
- recipientDOB: Date of birth

SPOUSE INFORMATION (if applicable):
- spouseName, spouseSSN, spouseDOB

PART II - COVERED INDIVIDUALS:
- coveredIndividuals: Array of people covered
  Each with: name, ssn, dob, coverageStartDate, coverageEndDate

PART III - MONTHLY PREMIUMS (Lines 12-32):
Extract monthly data for each month covered:
- enrollmentPremium: Column A - What you paid for insurance
- slcsp: Column B - Second Lowest Cost Silver Plan (SLCSP) premium
- advancePayment: Column C - Advance payment of premium tax credit (APTC)

ANNUAL TOTALS (Line 33):
- annualEnrollmentPremium: Total of Column A
- annualSlcsp: Total of Column B
- annualAdvancePayment: Total of Column C (IMPORTANT for tax reconciliation)

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "marketplaceName": "HealthCare.gov",
  "marketplaceId": "FF",
  "policyNumber": "12345678",
  "policyStartDate": "01/01/2024",
  "policyEndDate": "12/31/2024",
  "recipientName": "JOHN DOE",
  "recipientSSN": "XXX-XX-XXXX",
  "recipientAddress": "123 Main St, City, ST 12345",
  "recipientDOB": "01/15/1980",
  "spouseName": "JANE DOE",
  "spouseSSN": "XXX-XX-XXXX",
  "spouseDOB": "03/20/1982",
  "coveredIndividuals": [
    {"name": "JOHN DOE", "ssn": "XXX-XX-XXXX", "dob": "01/15/1980", "coverageStartDate": "01/01/2024", "coverageEndDate": "12/31/2024"},
    {"name": "JANE DOE", "ssn": "XXX-XX-XXXX", "dob": "03/20/1982", "coverageStartDate": "01/01/2024", "coverageEndDate": "12/31/2024"}
  ],
  "monthlyData": [
    {"month": "January", "enrollmentPremium": 800.00, "slcsp": 900.00, "advancePayment": 500.00},
    {"month": "February", "enrollmentPremium": 800.00, "slcsp": 900.00, "advancePayment": 500.00}
  ],
  "annualEnrollmentPremium": 9600.00,
  "annualSlcsp": 10800.00,
  "annualAdvancePayment": 6000.00,
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Column C (advance payment) is critical for tax reconciliation
2. May owe money back or get refund based on advance payments vs actual credit
3. Extract all 12 months if full-year coverage, otherwise only covered months
4. Use null for empty or unclear fields, NEVER guess`
}

/**
 * Validate 1095-A extracted data
 */
export function validate1095AData(data: unknown): data is Form1095AExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['recipientName', 'recipientSSN', 'policyNumber']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate arrays
  if (!Array.isArray(d.monthlyData)) return false
  if (!Array.isArray(d.coveredIndividuals)) return false

  // Validate boolean field
  if (typeof d.corrected !== 'boolean') return false

  // Validate key numeric field (allow null or number)
  if (d.annualAdvancePayment !== null && d.annualAdvancePayment !== undefined && typeof d.annualAdvancePayment !== 'number') return false

  return true
}

/**
 * Vietnamese field labels for 1095-A
 */
export const FORM_1095_A_FIELD_LABELS_VI: Record<string, string> = {
  marketplaceName: 'Tên Thị trường Bảo hiểm',
  marketplaceId: 'Mã Thị trường',
  policyNumber: 'Số Hợp đồng',
  policyStartDate: 'Ngày bắt đầu',
  policyEndDate: 'Ngày kết thúc',
  recipientName: 'Tên Người nộp thuế',
  recipientSSN: 'SSN Người nộp thuế',
  recipientAddress: 'Địa chỉ',
  recipientDOB: 'Ngày sinh',
  spouseName: 'Tên Vợ/Chồng',
  spouseSSN: 'SSN Vợ/Chồng',
  spouseDOB: 'Ngày sinh Vợ/Chồng',
  coveredIndividuals: 'Danh sách người được bảo hiểm',
  monthlyData: 'Dữ liệu hàng tháng',
  enrollmentPremium: 'Phí bảo hiểm (Cột A)',
  slcsp: 'Phí SLCSP (Cột B)',
  advancePayment: 'Thanh toán ứng trước (Cột C)',
  annualEnrollmentPremium: 'Tổng phí bảo hiểm (33A)',
  annualSlcsp: 'Tổng SLCSP (33B)',
  annualAdvancePayment: 'Tổng tín dụng ứng trước (33C)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
