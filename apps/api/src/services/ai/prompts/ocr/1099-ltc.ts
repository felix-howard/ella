/**
 * 1099-LTC OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-LTC (Long-Term Care and Accelerated Death Benefits)
 * Reports payments from long-term care insurance contracts and accelerated death benefits.
 */

/**
 * 1099-LTC extracted data structure
 * Matches IRS Form 1099-LTC box layout
 */
export interface Form1099LTCExtractedData {
  // Payer Information (Insurance company)
  payerName: string | null
  payerAddress: string | null
  payerTIN: string | null

  // Policyholder Information
  policyholderName: string | null
  policyholderAddress: string | null
  policyholderTIN: string | null // SSN or EIN

  // Account
  accountNumber: string | null

  // Insured Information
  insuredName: string | null
  insuredTIN: string | null // SSN of insured person

  // Benefit Amounts (Boxes 1-3)
  grossBenefits: number | null // Box 1 - Gross long-term care benefits paid (CRITICAL)
  acceleratedBenefits: number | null // Box 2 - Accelerated death benefits paid

  // Box 3 - Payment type checkboxes
  perDiemAmount: boolean // Box 3 - Per diem or other periodic basis
  reimbursedAmount: boolean // Box 3 alternate - Reimbursed amount

  // Box 4 - Contract type
  qualifiedContract: boolean // Checked if payments are from a qualified LTC contract

  // Metadata
  taxYear: number | null
  corrected: boolean
}

/**
 * Generate 1099-LTC OCR extraction prompt
 */
export function get1099LTCExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-LTC (Long-Term Care and Accelerated Death Benefits).

IMPORTANT: This form reports payments from long-term care insurance contracts or accelerated death benefits from life insurance policies. Accuracy is critical for determining taxable benefits.

Extract the following fields:

PAYER INFORMATION (Insurance company):
- payerName: Insurance company name
- payerAddress: Insurance company address
- payerTIN: Insurance company's EIN

POLICYHOLDER INFORMATION:
- policyholderName: Policy owner name
- policyholderAddress: Policy owner address
- policyholderTIN: Policy owner's SSN or EIN (XXX-XX-XXXX)
- accountNumber: Policy or account number

INSURED INFORMATION:
- insuredName: Name of the insured person (may differ from policyholder)
- insuredTIN: Insured person's SSN (XXX-XX-XXXX)

BENEFIT AMOUNTS:
- grossBenefits: Box 1 - Gross long-term care benefits paid
  (CRITICAL - total benefits paid under the contract during the year)
- acceleratedBenefits: Box 2 - Accelerated death benefits paid
  (From life insurance policy for terminally/chronically ill insured)

PAYMENT TYPE (Box 3 - check which applies):
- perDiemAmount: true if payments are on per diem or other periodic basis
- reimbursedAmount: true if payments are reimbursed actual expenses

CONTRACT TYPE (Box 4):
- qualifiedContract: true if this is a qualified long-term care insurance contract

METADATA:
- taxYear, corrected

Respond in JSON format:
{
  "payerName": "Nationwide Life Insurance Co",
  "payerAddress": "One Nationwide Plaza, Columbus, OH 43215",
  "payerTIN": "XX-XXXXXXX",
  "policyholderName": "JANE DOE",
  "policyholderAddress": "123 Main St, City, ST 12345",
  "policyholderTIN": "XXX-XX-XXXX",
  "accountNumber": "LTC-POL-123456",
  "insuredName": "JOHN DOE",
  "insuredTIN": "XXX-XX-XXXX",
  "grossBenefits": 36500.00,
  "acceleratedBenefits": null,
  "perDiemAmount": true,
  "reimbursedAmount": false,
  "qualifiedContract": true,
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. Box 1 gross benefits may be partially or fully excludable from income if from a qualified contract
2. Box 2 accelerated death benefits are generally excludable if insured is terminally or chronically ill
3. Box 3 determines how benefits are paid — only one of perDiemAmount or reimbursedAmount should be true
4. Per diem payments above the IRS daily limit may be taxable even from qualified contracts
5. All monetary values as numbers without $ or commas
6. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-LTC extracted data
 */
export function validate1099LTCData(data: unknown): data is Form1099LTCExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['payerName', 'policyholderTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for 1099-LTC
 */
export const FORM_1099_LTC_FIELD_LABELS_VI: Record<string, string> = {
  payerName: 'Tên Công ty Bảo hiểm',
  payerAddress: 'Địa chỉ Công ty Bảo hiểm',
  payerTIN: 'EIN Công ty Bảo hiểm',
  policyholderName: 'Tên Chủ hợp đồng',
  policyholderAddress: 'Địa chỉ Chủ hợp đồng',
  policyholderTIN: 'SSN/EIN Chủ hợp đồng',
  accountNumber: 'Số hợp đồng/tài khoản',
  insuredName: 'Tên Người được bảo hiểm',
  insuredTIN: 'SSN Người được bảo hiểm',
  grossBenefits: 'Tổng quyền lợi chăm sóc dài hạn (Box 1)',
  acceleratedBenefits: 'Quyền lợi tử vong tăng tốc (Box 2)',
  perDiemAmount: 'Thanh toán theo ngày/định kỳ (Box 3)',
  reimbursedAmount: 'Hoàn trả chi phí thực tế (Box 3)',
  qualifiedContract: 'Hợp đồng chăm sóc dài hạn đủ tiêu chuẩn (Box 4)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
