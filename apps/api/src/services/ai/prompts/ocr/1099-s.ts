/**
 * 1099-S OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-S (Proceeds from Real Estate Transactions)
 * Reports gross proceeds from real estate sales/exchanges.
 */

/**
 * 1099-S extracted data structure
 * Matches IRS Form 1099-S box layout
 */
export interface Form1099SExtractedData {
  // Filer Information (Closing agent/title company)
  filerName: string | null
  filerAddress: string | null
  filerTIN: string | null
  filerPhone: string | null

  // Transferor Information (Seller)
  transferorName: string | null
  transferorAddress: string | null
  transferorTIN: string | null // SSN or EIN
  accountNumber: string | null

  // Real Estate Transaction (Boxes 1-6)
  closingDate: string | null // Box 1 - Date of closing
  grossProceeds: number | null // Box 2 - Gross proceeds (CRITICAL)
  propertyAddress: string | null // Box 3 - Address or legal description (CRITICAL)
  foreignPersonCheckbox: boolean // Box 5 - Transferor is a foreign person
  buyerPartOfRealEstateTax: number | null // Box 6 - Buyer's part of real estate tax

  // State Information
  stateTaxInfo: Array<{
    state: string | null
    stateId: string | null
    stateTaxWithheld: number | null
  }>

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate 1099-S OCR extraction prompt
 */
export function get1099SExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-S (Proceeds from Real Estate Transactions).

IMPORTANT: This form reports gross proceeds from real estate sales and exchanges. Accuracy is critical.

Extract the following fields:

FILER INFORMATION (Closing agent/title company):
- filerName: Closing agent or title company name
- filerAddress: Filer's address
- filerTIN: Filer's EIN or SSN
- filerPhone: Contact phone

TRANSFEROR INFORMATION (Seller):
- transferorName: Seller's name
- transferorAddress: Seller's address
- transferorTIN: Seller's SSN or EIN (XXX-XX-XXXX)
- accountNumber: Account number if present

REAL ESTATE TRANSACTION:
- closingDate: Box 1 - Date of closing (MM/DD/YYYY)
- grossProceeds: Box 2 - Gross proceeds
  (CRITICAL - total sale amount before expenses)
- propertyAddress: Box 3 - Address or legal description of property
  (CRITICAL - identify the property sold)
- foreignPersonCheckbox: Box 5 - Checked if transferor is a foreign person
- buyerPartOfRealEstateTax: Box 6 - Buyer's part of real estate tax

STATE TAX:
- stateTaxInfo: Array of { state, stateId, stateTaxWithheld }

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "filerName": "ABC Title Company",
  "filerAddress": "500 Title Ave, City, ST 12345",
  "filerTIN": "XX-XXXXXXX",
  "filerPhone": "(555) 123-4567",
  "transferorName": "JOHN DOE",
  "transferorAddress": "123 Main St, City, ST 12345",
  "transferorTIN": "XXX-XX-XXXX",
  "accountNumber": null,
  "closingDate": "06/15/2024",
  "grossProceeds": 350000.00,
  "propertyAddress": "456 Oak Rd, City, ST 12345",
  "foreignPersonCheckbox": false,
  "buyerPartOfRealEstateTax": 1200.00,
  "stateTaxInfo": [
    {"state": "CA", "stateId": "XXX-XXXX", "stateTaxWithheld": null}
  ],
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 2 (gross proceeds) is the total sale price before any deductions
2. Box 3 (property address) is required to identify the transaction
3. Box 5 triggers FIRPTA withholding rules if checked
4. Box 6 is the portion of real estate tax allocated to the buyer
5. All monetary values as numbers without $ or commas
6. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-S extracted data
 */
export function validate1099SData(data: unknown): data is Form1099SExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['filerName', 'transferorTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate arrays
  if (!Array.isArray(d.stateTaxInfo)) return false

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false
  if (typeof d.foreignPersonCheckbox !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for 1099-S
 */
export const FORM_1099_S_FIELD_LABELS_VI: Record<string, string> = {
  filerName: 'Tên Đại lý Đóng cửa/Công ty Tiêu đề',
  filerAddress: 'Địa chỉ Người khai',
  filerTIN: 'EIN Người khai',
  filerPhone: 'Điện thoại',
  transferorName: 'Tên Người bán',
  transferorAddress: 'Địa chỉ Người bán',
  transferorTIN: 'SSN/EIN Người bán',
  accountNumber: 'Số tài khoản',
  closingDate: 'Ngày đóng cửa (Box 1)',
  grossProceeds: 'Tổng số tiền thu được (Box 2)',
  propertyAddress: 'Địa chỉ Bất động sản (Box 3)',
  foreignPersonCheckbox: 'Người bán là người nước ngoài (Box 5)',
  buyerPartOfRealEstateTax: 'Thuế bất động sản phần người mua (Box 6)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
