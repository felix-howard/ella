/**
 * Form 2210 OCR Extraction Prompt
 * Underpayment of Estimated Tax by Individuals
 */

export interface Form2210ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: Required Annual Payment
  priorYearTax: number | null               // Line 1
  currentYearTax: number | null             // Line 2
  requiredAnnualPayment: number | null      // Line 9

  // Part II: Reasons for Filing
  requestWaiver: boolean | null             // Box A
  annualizedIncomeMethod: boolean | null    // Box B
  jointReturnSeparateTax: boolean | null    // Box C

  // Part III: Short Method
  totalWithholding: number | null           // Line 13
  totalEstimatedPayments: number | null     // Line 14
  underpaymentAmount: number | null         // Line 17
  penaltyAmount: number | null              // Line 19

  // Part IV: Regular Method (quarterly)
  quarterlyPayments: Array<{
    quarter: number
    requiredPayment: number | null
    actualPayment: number | null
    underpayment: number | null
    daysLate: number | null
    penalty: number | null
  }>

  totalPenalty: number | null               // → 1040 line 38

  taxYear: number | null
}

export function getForm2210ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 2210 (Underpayment of Estimated Tax by Individuals).

IMPORTANT: This form calculates penalties for underpaying estimated taxes. Common for self-employed.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

PART I - REQUIRED ANNUAL PAYMENT:
- priorYearTax: Line 1 (prior year tax liability)
- currentYearTax: Line 2 (current year tax)
- requiredAnnualPayment: Line 9 (lesser of 100%/110% prior year or 90% current)

PART II - REASONS FOR FILING:
- requestWaiver: Box A (true/false)
- annualizedIncomeMethod: Box B (true/false)
- jointReturnSeparateTax: Box C (true/false)

PART III - SHORT METHOD:
- totalWithholding: Line 13
- totalEstimatedPayments: Line 14
- underpaymentAmount: Line 17
- penaltyAmount: Line 19

PART IV - REGULAR METHOD:
- quarterlyPayments: Array of { quarter (1-4), requiredPayment, actualPayment, underpayment, daysLate, penalty }

TOTAL:
- totalPenalty: Final penalty amount (CRITICAL → Form 1040 line 38)

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "priorYearTax": 15000.00,
  "currentYearTax": 18000.00,
  "requiredAnnualPayment": 15000.00,
  "requestWaiver": false,
  "annualizedIncomeMethod": false,
  "jointReturnSeparateTax": false,
  "totalWithholding": 10000.00,
  "totalEstimatedPayments": 3000.00,
  "underpaymentAmount": 2000.00,
  "penaltyAmount": 85.00,
  "quarterlyPayments": [],
  "totalPenalty": 85.00,
  "taxYear": 2024
}

Rules:
1. totalPenalty is most important (flows to Form 1040)
2. Quarterly breakdown only needed if Part IV (Regular Method) used
3. All monetary values as numbers without $ or commas
4. Use null for empty fields, NEVER guess`
}

export function validateForm2210Data(data: unknown): data is Form2210ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (d.totalPenalty !== null && d.totalPenalty !== undefined && typeof d.totalPenalty !== 'number') return false
  return true
}

export const FORM_2210_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  priorYearTax: 'Thuế năm trước (Dòng 1)',
  currentYearTax: 'Thuế năm hiện tại (Dòng 2)',
  requiredAnnualPayment: 'Thanh toán hàng năm bắt buộc (Dòng 9)',
  requestWaiver: 'Yêu cầu miễn (Ô A)',
  annualizedIncomeMethod: 'Phương pháp thu nhập theo năm (Ô B)',
  totalWithholding: 'Tổng khấu trừ (Dòng 13)',
  totalEstimatedPayments: 'Tổng thuế ước tính (Dòng 14)',
  underpaymentAmount: 'Số tiền thiếu (Dòng 17)',
  penaltyAmount: 'Tiền phạt (Dòng 19)',
  totalPenalty: 'Tổng tiền phạt',
  taxYear: 'Năm thuế',
}
