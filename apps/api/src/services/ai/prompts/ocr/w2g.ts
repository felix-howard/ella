/**
 * W-2G OCR Extraction Prompt
 * Certain Gambling Winnings
 */

export interface W2GExtractedData {
  // Payer Information
  payerName: string | null
  payerTIN: string | null
  payerAddress: string | null

  // Winner Information
  winnerName: string | null
  winnerSSN: string | null
  winnerAddress: string | null

  // Gambling Winnings
  grossWinnings: number | null               // Box 1 (CRITICAL)
  dateWon: string | null                     // Box 2
  typeOfWinning: string | null               // Box 3 (slot, poker, lottery, etc.)
  federalWithheld: number | null             // Box 4
  transactionId: string | null               // Box 5 (transaction/ticket number)
  race: string | null                        // Box 6 (horse/dog race)

  // Additional
  winningsFromIdenticalWagers: number | null // Box 7
  cashier: string | null                     // Box 8
  windowNumber: string | null                // Box 9
  stateIncomeTaxWithheld: number | null      // Box 14
  stateWinnings: number | null               // Box 15
  localIncomeTaxWithheld: number | null      // Box 16
  localWinnings: number | null               // Box 17

  // State Info
  state: string | null                       // Box 13
  payerStateId: string | null                // Box 13

  taxYear: number | null
}

export function getW2GExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form W-2G (Certain Gambling Winnings).

IMPORTANT: Reports gambling winnings that meet reporting thresholds. Withholding may apply.

Extract the following fields:

PAYER INFO:
- payerName, payerTIN, payerAddress

WINNER INFO:
- winnerName, winnerSSN (XXX-XX-XXXX), winnerAddress

GAMBLING WINNINGS:
- grossWinnings: Box 1 (CRITICAL - total winnings)
- dateWon: Box 2 (YYYY-MM-DD)
- typeOfWinning: Box 3 (slot machine, poker, lottery, keno, bingo, horse racing, etc.)
- federalWithheld: Box 4 (federal income tax withheld)
- transactionId: Box 5 (ticket/transaction number)
- race: Box 6 (if horse/dog race)

ADDITIONAL:
- winningsFromIdenticalWagers: Box 7
- cashier: Box 8, windowNumber: Box 9
- stateIncomeTaxWithheld: Box 14
- stateWinnings: Box 15
- localIncomeTaxWithheld: Box 16
- localWinnings: Box 17

STATE:
- state: Box 13
- payerStateId: Box 13

METADATA:
- taxYear

Respond in JSON format:
{
  "payerName": "CASINO ROYALE",
  "payerTIN": "XX-XXXXXXX",
  "payerAddress": "100 Casino Blvd, Las Vegas, NV 89101",
  "winnerName": "JOHN DOE",
  "winnerSSN": "XXX-XX-XXXX",
  "winnerAddress": "123 Main St, City, ST 12345",
  "grossWinnings": 5000.00,
  "dateWon": "2024-07-04",
  "typeOfWinning": "Slot Machine",
  "federalWithheld": 1200.00,
  "transactionId": "SM-2024-00123",
  "race": null,
  "winningsFromIdenticalWagers": null,
  "cashier": null,
  "windowNumber": null,
  "stateIncomeTaxWithheld": 250.00,
  "stateWinnings": 5000.00,
  "localIncomeTaxWithheld": null,
  "localWinnings": null,
  "state": "NV",
  "payerStateId": null,
  "taxYear": 2024
}

Rules:
1. grossWinnings (Box 1) is most important (reported as Other Income)
2. Reporting thresholds: $1,200 slots/bingo, $1,500 keno, $5,000 poker, $600 other
3. 24% backup withholding applies if no SSN provided
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

export function validateW2GData(data: unknown): data is W2GExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('winnerName' in d)) return false
  if (d.grossWinnings !== null && d.grossWinnings !== undefined && typeof d.grossWinnings !== 'number') return false
  return true
}

export const W2G_FIELD_LABELS_VI: Record<string, string> = {
  payerName: 'Tên Bên trả',
  winnerName: 'Tên Người thắng',
  winnerSSN: 'SSN Người thắng',
  grossWinnings: 'Tổng tiền thắng (Ô 1)',
  dateWon: 'Ngày thắng (Ô 2)',
  typeOfWinning: 'Loại thắng (Ô 3)',
  federalWithheld: 'Thuế liên bang khấu trừ (Ô 4)',
  transactionId: 'Mã giao dịch (Ô 5)',
  stateIncomeTaxWithheld: 'Thuế tiểu bang khấu trừ (Ô 14)',
  taxYear: 'Năm thuế',
}
