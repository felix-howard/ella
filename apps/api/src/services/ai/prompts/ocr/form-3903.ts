/**
 * Form 3903 OCR Extraction Prompt
 * Moving Expenses (Military Only Post-2017)
 */

export interface Form3903ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Moving Expenses
  transportationAndStorage: number | null    // Line 1
  travelAndLodging: number | null            // Line 2
  totalMovingExpenses: number | null          // Line 3
  employerReimbursement: number | null        // Line 4
  deductibleMovingExpenses: number | null     // Line 5 (CRITICAL → Schedule 1)

  // Move Details
  militaryMoveOnly: boolean | null
  dateOfMove: string | null
  previousAddress: string | null
  newAddress: string | null
  distanceMiles: number | null

  taxYear: number | null
}

export function getForm3903ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 3903 (Moving Expenses).

IMPORTANT: Post-2017 TCJA, only active-duty military can deduct moving expenses.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

MOVING EXPENSES:
- transportationAndStorage: Line 1 (household goods transport/storage)
- travelAndLodging: Line 2 (travel to new home, lodging)
- totalMovingExpenses: Line 3 (Lines 1 + 2)
- employerReimbursement: Line 4 (amounts employer paid/reimbursed)
- deductibleMovingExpenses: Line 5 (CRITICAL - Line 3 minus Line 4 → Schedule 1)

MOVE DETAILS:
- militaryMoveOnly (true/false - must be true post-2017)
- dateOfMove (YYYY-MM-DD)
- previousAddress, newAddress
- distanceMiles

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "SGT JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "transportationAndStorage": 4500.00,
  "travelAndLodging": 1200.00,
  "totalMovingExpenses": 5700.00,
  "employerReimbursement": 2000.00,
  "deductibleMovingExpenses": 3700.00,
  "militaryMoveOnly": true,
  "dateOfMove": "2024-06-15",
  "previousAddress": "Fort Bragg, NC",
  "newAddress": "Fort Hood, TX",
  "distanceMiles": 1200,
  "taxYear": 2024
}

Rules:
1. deductibleMovingExpenses is most important (flows to Schedule 1)
2. Post-2017 only available for active-duty military PCS orders
3. All monetary values as numbers without $ or commas
4. Use null for empty fields, NEVER guess`
}

export function validateForm3903Data(data: unknown): data is Form3903ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (d.deductibleMovingExpenses !== null && d.deductibleMovingExpenses !== undefined && typeof d.deductibleMovingExpenses !== 'number') return false
  return true
}

export const FORM_3903_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  transportationAndStorage: 'Vận chuyển và lưu trữ (Dòng 1)',
  travelAndLodging: 'Di chuyển và lưu trú (Dòng 2)',
  totalMovingExpenses: 'Tổng chi phí di chuyển (Dòng 3)',
  employerReimbursement: 'Hoàn trả từ nhà tuyển dụng (Dòng 4)',
  deductibleMovingExpenses: 'Chi phí di chuyển được khấu trừ (Dòng 5)',
  taxYear: 'Năm thuế',
}
