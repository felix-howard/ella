/**
 * Form 4868 OCR Extraction Prompt
 * Application for Automatic Extension of Time to File
 */

export interface Form4868ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null
  spouseName: string | null
  spouseSSN: string | null
  address: string | null

  // Extension Request
  estimatedTotalTax: number | null           // Line 4
  totalPayments: number | null               // Line 5 (withholding + estimates)
  balanceDue: number | null                  // Line 6
  amountPaying: number | null                // Line 7 (CRITICAL)

  // Checkboxes
  outOfCountry: boolean | null
  combatZone: boolean | null

  // Filing Status
  filingStatus: 'SINGLE' | 'MFJ' | 'MFS' | 'HOH' | 'QW' | null

  // Payment Info
  paymentMethod: 'CHECK' | 'DIRECT_PAY' | 'EFTPS' | 'CARD' | null
  confirmationNumber: string | null

  taxYear: number | null
  dateSubmitted: string | null
}

export function getForm4868ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 4868 (Application for Automatic Extension of Time to File).

IMPORTANT: This form grants 6-month filing extension. Does NOT extend payment deadline.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)
- spouseName, spouseSSN (if joint)
- address

EXTENSION REQUEST:
- estimatedTotalTax: Line 4 (estimated total tax liability for the year)
- totalPayments: Line 5 (withholding + estimated payments already made)
- balanceDue: Line 6 (Line 4 minus Line 5)
- amountPaying: Line 7 (CRITICAL - payment with extension)

CHECKBOXES:
- outOfCountry (true/false)
- combatZone (true/false)

FILING STATUS:
- filingStatus: SINGLE, MFJ, MFS, HOH, or QW

PAYMENT INFO:
- paymentMethod: CHECK, DIRECT_PAY, EFTPS, or CARD
- confirmationNumber (if electronic)

METADATA:
- taxYear
- dateSubmitted (YYYY-MM-DD)

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "spouseName": "JANE DOE",
  "spouseSSN": "XXX-XX-XXXX",
  "address": "123 Main St, City, ST 12345",
  "estimatedTotalTax": 25000.00,
  "totalPayments": 22000.00,
  "balanceDue": 3000.00,
  "amountPaying": 3000.00,
  "outOfCountry": false,
  "combatZone": false,
  "filingStatus": "MFJ",
  "paymentMethod": "DIRECT_PAY",
  "confirmationNumber": "12345678",
  "taxYear": 2024,
  "dateSubmitted": "2025-04-15"
}

Rules:
1. amountPaying is most important (payment obligation)
2. Extension is for filing only, NOT for payment
3. All monetary values as numbers without $ or commas
4. Use null for empty fields, NEVER guess`
}

export function validateForm4868Data(data: unknown): data is Form4868ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (d.amountPaying !== null && d.amountPaying !== undefined && typeof d.amountPaying !== 'number') return false
  return true
}

export const FORM_4868_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  spouseName: 'Tên Vợ/Chồng',
  estimatedTotalTax: 'Tổng thuế ước tính (Dòng 4)',
  totalPayments: 'Tổng thanh toán (Dòng 5)',
  balanceDue: 'Số dư phải trả (Dòng 6)',
  amountPaying: 'Số tiền thanh toán (Dòng 7)',
  filingStatus: 'Tình trạng khai thuế',
  taxYear: 'Năm thuế',
  dateSubmitted: 'Ngày nộp',
}
