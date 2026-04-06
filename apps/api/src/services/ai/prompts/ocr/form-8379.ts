/**
 * Form 8379 OCR Extraction Prompt
 * Injured Spouse Allocation
 */

export interface Form8379ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null
  spouseName: string | null
  spouseSSN: string | null

  // Filing Information
  filedWithReturn: boolean | null             // Filed with original return
  filedAfterOffset: boolean | null           // Filed after refund offset

  // Income Allocation
  injuredSpouseIncome: number | null
  otherSpouseIncome: number | null

  // Withholding/Payments Allocation
  injuredSpouseWithholding: number | null
  otherSpouseWithholding: number | null
  injuredSpouseEstimatedPayments: number | null
  otherSpouseEstimatedPayments: number | null

  // Credits Allocation
  injuredSpouseEIC: number | null
  injuredSpouseChildTaxCredit: number | null
  injuredSpouseOtherCredits: number | null

  // Joint Liability Information
  jointLiability: string | null              // Type of debt (student loans, child support, etc.)
  jointLiabilityAmount: number | null

  // Result
  allocatedRefund: number | null             // CRITICAL - injured spouse's share

  taxYear: number | null
}

export function getForm8379ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8379 (Injured Spouse Allocation).

IMPORTANT: Protects one spouse's refund share when the other owes debts (student loans, child support, back taxes).

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)
- spouseName, spouseSSN

FILING INFORMATION:
- filedWithReturn (true/false)
- filedAfterOffset (true/false)

INCOME ALLOCATION:
- injuredSpouseIncome, otherSpouseIncome

WITHHOLDING/PAYMENTS:
- injuredSpouseWithholding, otherSpouseWithholding
- injuredSpouseEstimatedPayments, otherSpouseEstimatedPayments

CREDITS:
- injuredSpouseEIC (earned income credit)
- injuredSpouseChildTaxCredit
- injuredSpouseOtherCredits

JOINT LIABILITY:
- jointLiability (type: "student loans", "child support", "back taxes", etc.)
- jointLiabilityAmount

RESULT:
- allocatedRefund (CRITICAL - injured spouse's portion of refund)

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JANE DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "spouseName": "JOHN DOE",
  "spouseSSN": "XXX-XX-XXXX",
  "filedWithReturn": true,
  "filedAfterOffset": false,
  "injuredSpouseIncome": 45000.00,
  "otherSpouseIncome": 55000.00,
  "injuredSpouseWithholding": 6000.00,
  "otherSpouseWithholding": 8000.00,
  "injuredSpouseEstimatedPayments": null,
  "otherSpouseEstimatedPayments": null,
  "injuredSpouseEIC": null,
  "injuredSpouseChildTaxCredit": 2000.00,
  "injuredSpouseOtherCredits": null,
  "jointLiability": "student loans",
  "jointLiabilityAmount": 15000.00,
  "allocatedRefund": 3500.00,
  "taxYear": 2024
}

Rules:
1. allocatedRefund is most important (injured spouse's protected refund share)
2. Allocation based on each spouse's proportional income/payments
3. All monetary values as numbers without $ or commas
4. Use null for empty fields, NEVER guess`
}

export function validateForm8379Data(data: unknown): data is Form8379ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (d.allocatedRefund !== null && d.allocatedRefund !== undefined && typeof d.allocatedRefund !== 'number') return false
  return true
}

export const FORM_8379_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  spouseName: 'Tên Vợ/Chồng',
  filedWithReturn: 'Nộp cùng tờ khai',
  filedAfterOffset: 'Nộp sau bù trừ',
  injuredSpouseIncome: 'Thu nhập vợ/chồng bị thiệt hại',
  otherSpouseIncome: 'Thu nhập vợ/chồng kia',
  injuredSpouseWithholding: 'Khấu trừ vợ/chồng bị thiệt hại',
  otherSpouseWithholding: 'Khấu trừ vợ/chồng kia',
  injuredSpouseEstimatedPayments: 'Thuế ước tính vợ/chồng bị thiệt hại',
  injuredSpouseEIC: 'EIC vợ/chồng bị thiệt hại',
  injuredSpouseChildTaxCredit: 'Tín dụng trẻ em vợ/chồng bị thiệt hại',
  jointLiability: 'Loại nợ chung',
  jointLiabilityAmount: 'Số nợ chung',
  allocatedRefund: 'Hoàn thuế được phân bổ',
  taxYear: 'Năm thuế',
}
