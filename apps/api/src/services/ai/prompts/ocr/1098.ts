/**
 * 1098 OCR Extraction Prompt
 * Extracts structured data from IRS Form 1098 (Mortgage Interest Statement)
 */

/**
 * 1098 extracted data structure
 * Matches IRS Form 1098 box layout
 */
export interface Form1098ExtractedData {
  // Recipient/Lender Information
  recipientName: string | null // Lender/bank name
  recipientAddress: string | null
  recipientTIN: string | null

  // Payer/Borrower Information
  payerName: string | null // Borrower name
  payerAddress: string | null
  payerTIN: string | null // Borrower's SSN
  accountNumber: string | null // Loan/account number

  // Mortgage Information (Boxes 1-11)
  mortgageInterestReceived: number | null // Box 1 - Mortgage interest received (MOST IMPORTANT)
  outstandingMortgagePrincipal: number | null // Box 2 - Outstanding mortgage principal
  mortgageOriginationDate: string | null // Box 3 - Mortgage origination date
  refundOfOverpaidInterest: number | null // Box 4 - Refund of overpaid interest
  mortgageInsurancePremiums: number | null // Box 5 - Mortgage insurance premiums
  pointsPaidOnPurchase: number | null // Box 6 - Points paid on purchase of principal residence
  propertyAddress: string | null // Box 7 - Property address (if different)
  numberOfProperties: number | null // Box 8 - Number of properties securing the mortgage
  otherInfo: string | null // Box 9 - Other information
  acquisitionDate: string | null // Box 10 - Property acquisition date
  propertyTax: number | null // Box 11 - Property taxes

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate 1098 OCR extraction prompt
 */
export function get1098ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1098 (Mortgage Interest Statement).

IMPORTANT: This reports mortgage interest paid, which is tax deductible.

Extract the following fields:

RECIPIENT/LENDER INFORMATION:
- recipientName: Mortgage company/bank name
- recipientAddress: Lender's address
- recipientTIN: Lender's EIN

PAYER/BORROWER INFORMATION:
- payerName: Borrower's name
- payerAddress: Borrower's address
- payerTIN: Borrower's SSN (XXX-XX-XXXX)
- accountNumber: Loan/mortgage account number

MORTGAGE INFORMATION:
- mortgageInterestReceived: Box 1 - Mortgage interest received from payer (MOST IMPORTANT for tax deduction)
- outstandingMortgagePrincipal: Box 2 - Outstanding mortgage principal as of Jan 1
- mortgageOriginationDate: Box 3 - Date mortgage originated (MM/DD/YYYY)
- refundOfOverpaidInterest: Box 4 - Refund of overpaid interest
- mortgageInsurancePremiums: Box 5 - Mortgage insurance premiums (PMI/MIP)
- pointsPaidOnPurchase: Box 6 - Points paid on purchase
- propertyAddress: Box 7 - Property address if different from borrower address
- numberOfProperties: Box 8 - Number of mortgaged properties (usually 1)
- otherInfo: Box 9 - Other information
- acquisitionDate: Box 10 - Property acquisition date
- propertyTax: Box 11 - Real estate taxes paid (if reported)

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "recipientName": "ABC Mortgage Company",
  "recipientAddress": "500 Bank St, City, ST 12345",
  "recipientTIN": "XX-XXXXXXX",
  "payerName": "JOHN DOE",
  "payerAddress": "123 Main St, City, ST 12345",
  "payerTIN": "XXX-XX-XXXX",
  "accountNumber": "1234567890",
  "mortgageInterestReceived": 12500.00,
  "outstandingMortgagePrincipal": 350000.00,
  "mortgageOriginationDate": "03/15/2020",
  "refundOfOverpaidInterest": null,
  "mortgageInsurancePremiums": 1200.00,
  "pointsPaidOnPurchase": null,
  "propertyAddress": null,
  "numberOfProperties": 1,
  "otherInfo": null,
  "acquisitionDate": "03/01/2020",
  "propertyTax": 4500.00,
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 1 is the key deduction amount
2. Box 5 (PMI) is also deductible in certain cases
3. If property address is same as borrower address, Box 7 may be blank
4. Use null for empty or unclear fields, NEVER guess`
}

/**
 * Validate 1098 extracted data
 */
export function validate1098Data(data: unknown): data is Form1098ExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['recipientName', 'payerTIN', 'mortgageInterestReceived']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate boolean field
  if (typeof d.corrected !== 'boolean') return false

  // Validate key numeric field (allow null or number)
  if (d.mortgageInterestReceived !== null && typeof d.mortgageInterestReceived !== 'number') return false

  return true
}

/**
 * Vietnamese field labels for 1098
 */
export const FORM_1098_FIELD_LABELS_VI: Record<string, string> = {
  recipientName: 'Tên Ngân hàng/Công ty cho vay',
  recipientAddress: 'Địa chỉ Ngân hàng',
  recipientTIN: 'EIN Ngân hàng',
  payerName: 'Tên Người vay',
  payerAddress: 'Địa chỉ Người vay',
  payerTIN: 'SSN Người vay',
  accountNumber: 'Số tài khoản vay',
  mortgageInterestReceived: 'Lãi vay nhà đã trả (Box 1)',
  outstandingMortgagePrincipal: 'Dư nợ gốc (Box 2)',
  mortgageOriginationDate: 'Ngày bắt đầu vay (Box 3)',
  refundOfOverpaidInterest: 'Hoàn lại lãi trả thừa (Box 4)',
  mortgageInsurancePremiums: 'Phí bảo hiểm vay (Box 5)',
  pointsPaidOnPurchase: 'Điểm mua nhà (Box 6)',
  propertyAddress: 'Địa chỉ bất động sản (Box 7)',
  numberOfProperties: 'Số bất động sản (Box 8)',
  acquisitionDate: 'Ngày mua (Box 10)',
  propertyTax: 'Thuế bất động sản (Box 11)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
