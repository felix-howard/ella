/**
 * 1098-E OCR Extraction Prompt
 * Student Loan Interest Statement
 */

export interface Form1098EExtractedData {
  lenderName: string | null
  lenderAddress: string | null
  lenderTIN: string | null
  lenderPhone: string | null
  borrowerName: string | null
  borrowerSSN: string | null
  borrowerAddress: string | null
  accountNumber: string | null
  studentLoanInterestPaid: number | null    // Box 1
  isQualifiedLoan: boolean
  taxYear: number | null
  corrected: boolean
}

export function get1098EExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1098-E (Student Loan Interest Statement).

IMPORTANT: This form reports student loan interest paid, which may be tax deductible. Accuracy is critical.

Extract the following fields:

LENDER INFO:
- lenderName: Loan servicer/lender name
- lenderAddress: Full address
- lenderTIN: TIN/EIN (XX-XXXXXXX)
- lenderPhone: Contact phone

BORROWER INFO:
- borrowerName: Borrower's name
- borrowerSSN: SSN (XXX-XX-XXXX)
- borrowerAddress: Full address
- accountNumber: Loan account number

INTEREST DATA:
- studentLoanInterestPaid: Box 1 - Student loan interest received by lender (MOST IMPORTANT)
  This is deductible up to $2,500 on Form 1040
- isQualifiedLoan: true if this is a qualified student loan (for higher education)

METADATA:
- taxYear, corrected (boolean)

Respond in JSON format:
{
  "lenderName": "Navient Solutions",
  "lenderAddress": "100 Lending Way, City, ST 12345",
  "lenderTIN": "XX-XXXXXXX",
  "lenderPhone": "(800) 123-4567",
  "borrowerName": "JOHN DOE",
  "borrowerSSN": "XXX-XX-XXXX",
  "borrowerAddress": "123 Main St, City, ST 12345",
  "accountNumber": "SL-987654321",
  "studentLoanInterestPaid": 1850.00,
  "isQualifiedLoan": true,
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 1 is the most important field - deductible interest amount
2. All monetary values as numbers without $ or commas
3. Maximum deduction is $2,500 but report actual amount paid
4. Use null for empty/unclear fields, NEVER guess`
}

export function validate1098EData(data: unknown): data is Form1098EExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const requiredFields = ['lenderName', 'borrowerName', 'borrowerSSN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }
  if (typeof d.corrected !== 'boolean') return false
  if (typeof d.isQualifiedLoan !== 'boolean') return false
  if (d.studentLoanInterestPaid !== null && d.studentLoanInterestPaid !== undefined && typeof d.studentLoanInterestPaid !== 'number') return false
  return true
}

export const FORM_1098_E_FIELD_LABELS_VI: Record<string, string> = {
  lenderName: 'Tên Đơn vị cho vay',
  lenderAddress: 'Địa chỉ Đơn vị cho vay',
  lenderTIN: 'TIN Đơn vị cho vay',
  lenderPhone: 'Điện thoại',
  borrowerName: 'Tên Người vay',
  borrowerSSN: 'SSN Người vay',
  borrowerAddress: 'Địa chỉ Người vay',
  accountNumber: 'Số tài khoản vay',
  studentLoanInterestPaid: 'Lãi vay sinh viên đã trả (Box 1)',
  isQualifiedLoan: 'Khoản vay đủ điều kiện',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
