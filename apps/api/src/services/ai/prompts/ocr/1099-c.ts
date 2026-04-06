/**
 * 1099-C OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-C (Cancellation of Debt)
 * Reports canceled/forgiven debt that may be taxable income.
 */

/**
 * 1099-C extracted data structure
 * Matches IRS Form 1099-C box layout
 */
export interface Form1099CExtractedData {
  // Creditor Information (Lender/Financial Institution)
  creditorName: string | null
  creditorAddress: string | null
  creditorTIN: string | null
  creditorPhone: string | null

  // Debtor Information
  debtorName: string | null
  debtorAddress: string | null
  debtorTIN: string | null // SSN
  accountNumber: string | null

  // Debt Cancellation Details
  dateOfEvent: string | null // Box 1 - Date of identifiable event
  debtCanceled: number | null // Box 2 - Amount of debt canceled (CRITICAL)
  interestIncluded: number | null // Box 3 - Interest included in Box 2
  debtDescription: string | null // Box 4 - Description of debt
  personalLiability: boolean // Box 5 - Was debtor personally liable?
  eventCode: string | null // Box 6 - Identifiable event code (CRITICAL)
  fmvProperty: number | null // Box 7 - Fair market value of property

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate 1099-C OCR extraction prompt
 */
export function get1099CExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-C (Cancellation of Debt).

IMPORTANT: This form reports canceled debt which is generally taxable income. Accuracy is critical for tax compliance.

Extract the following fields:

CREDITOR INFORMATION (Lender/Financial Institution):
- creditorName: Lender's name (e.g., "First National Bank")
- creditorAddress: Lender's address
- creditorTIN: Lender's EIN
- creditorPhone: Contact phone

DEBTOR INFORMATION:
- debtorName: Taxpayer's name
- debtorAddress: Taxpayer's address
- debtorTIN: Taxpayer's SSN (XXX-XX-XXXX)
- accountNumber: Loan or account number

DEBT CANCELLATION DETAILS:
- dateOfEvent: Box 1 - Date of identifiable event (MM/DD/YYYY)
- debtCanceled: Box 2 - Amount of debt canceled
  (CRITICAL - generally taxable as ordinary income)
- interestIncluded: Box 3 - Interest included in Box 2 amount
- debtDescription: Box 4 - Description of origin of debt (e.g., "Credit card", "Mortgage")
- personalLiability: Box 5 - Checked if debtor was personally liable for repayment
- eventCode: Box 6 - Identifiable event code (A-H)
  (CRITICAL - determines tax treatment. A=Bankruptcy, B=Other judicial debt relief,
  C=Statute of limitations, D=Foreclosure election, E=Debt relief from probate,
  F=By agreement, G=Decision or policy to discontinue collection, H=Expiration of nonpayment testing period)
- fmvProperty: Box 7 - Fair market value of property (for foreclosures/repossessions)

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "creditorName": "First National Bank",
  "creditorAddress": "200 Bank Plaza, City, ST 12345",
  "creditorTIN": "XX-XXXXXXX",
  "creditorPhone": "(555) 987-6543",
  "debtorName": "JANE DOE",
  "debtorAddress": "456 Elm St, City, ST 12345",
  "debtorTIN": "XXX-XX-XXXX",
  "accountNumber": "ACCT-9876543210",
  "dateOfEvent": "06/15/2024",
  "debtCanceled": 12500.00,
  "interestIncluded": 1200.00,
  "debtDescription": "Credit card debt",
  "personalLiability": true,
  "eventCode": "F",
  "fmvProperty": null,
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 2 (debt canceled) is the primary taxable amount — extract precisely
2. Box 6 event code must be a single letter A through H
3. Box 5 (personal liability) is a checkbox — true if checked, false if not
4. Box 7 only applies to secured debt/foreclosure situations
5. All monetary values as numbers without $ or commas
6. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-C extracted data
 */
export function validate1099CData(data: unknown): data is Form1099CExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['creditorName', 'debtorTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false
  if (typeof d.personalLiability !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for 1099-C
 */
export const FORM_1099_C_FIELD_LABELS_VI: Record<string, string> = {
  creditorName: 'Tên Chủ nợ',
  creditorAddress: 'Địa chỉ Chủ nợ',
  creditorTIN: 'EIN Chủ nợ',
  creditorPhone: 'Điện thoại',
  debtorName: 'Tên Con nợ',
  debtorAddress: 'Địa chỉ Con nợ',
  debtorTIN: 'SSN Con nợ',
  accountNumber: 'Số tài khoản',
  dateOfEvent: 'Ngày xảy ra sự kiện (Box 1)',
  debtCanceled: 'Số nợ được xóa (Box 2)',
  interestIncluded: 'Lãi suất trong Box 2 (Box 3)',
  debtDescription: 'Mô tả khoản nợ (Box 4)',
  personalLiability: 'Trách nhiệm cá nhân (Box 5)',
  eventCode: 'Mã sự kiện (Box 6)',
  fmvProperty: 'Giá trị thị trường tài sản (Box 7)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
