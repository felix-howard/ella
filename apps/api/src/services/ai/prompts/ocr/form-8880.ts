/**
 * Form 8880 OCR Extraction Prompt
 * Credit for Qualified Retirement Savings Contributions (Saver's Credit)
 */

export interface Form8880ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Taxpayer Contributions
  taxpayerTraditionalIRA: number | null      // Line 1
  taxpayerRothIRA: number | null             // Line 2
  taxpayer401k: number | null                // Line 3
  taxpayerDistributions: number | null       // Line 4
  taxpayerNetContributions: number | null    // Line 5

  // Spouse Contributions (if MFJ)
  spouseTraditionalIRA: number | null
  spouseRothIRA: number | null
  spouse401k: number | null
  spouseDistributions: number | null
  spouseNetContributions: number | null

  // Credit Calculation
  eligibleContributions: number | null       // Line 6 (max $2,000/$4,000)
  adjustedGrossIncome: number | null         // Line 7
  creditRate: number | null                  // Line 8 (50%, 20%, or 10%)
  retirementSavingsCredit: number | null     // Line 9 (CRITICAL → Schedule 3)

  taxYear: number | null
}

export function getForm8880ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8880 (Credit for Qualified Retirement Savings Contributions).

IMPORTANT: Saver's Credit for low-to-moderate income retirement savers. Up to $1,000/$2,000 credit.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

TAXPAYER CONTRIBUTIONS:
- taxpayerTraditionalIRA: Line 1
- taxpayerRothIRA: Line 2
- taxpayer401k: Line 3 (401k/403b/457/TSP/SIMPLE)
- taxpayerDistributions: Line 4 (distributions received, reduces credit)
- taxpayerNetContributions: Line 5

SPOUSE CONTRIBUTIONS (if MFJ):
- spouseTraditionalIRA, spouseRothIRA, spouse401k
- spouseDistributions, spouseNetContributions

CREDIT CALCULATION:
- eligibleContributions: Line 6 (max $2,000 single / $4,000 MFJ)
- adjustedGrossIncome: Line 7
- creditRate: Line 8 (50%, 20%, or 10% based on AGI)
- retirementSavingsCredit: Line 9 (CRITICAL → Schedule 3)

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "taxpayerTraditionalIRA": null,
  "taxpayerRothIRA": 2000.00,
  "taxpayer401k": 3000.00,
  "taxpayerDistributions": null,
  "taxpayerNetContributions": 5000.00,
  "spouseTraditionalIRA": null,
  "spouseRothIRA": null,
  "spouse401k": null,
  "spouseDistributions": null,
  "spouseNetContributions": null,
  "eligibleContributions": 2000.00,
  "adjustedGrossIncome": 30000.00,
  "creditRate": 50,
  "retirementSavingsCredit": 1000.00,
  "taxYear": 2024
}

Rules:
1. retirementSavingsCredit is most important (flows to Schedule 3)
2. Max eligible contribution: $2,000 single / $4,000 MFJ
3. Credit rate: 50%, 20%, or 10% based on AGI and filing status (thresholds indexed annually)
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

export function validateForm8880Data(data: unknown): data is Form8880ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (d.retirementSavingsCredit !== null && d.retirementSavingsCredit !== undefined && typeof d.retirementSavingsCredit !== 'number') return false
  return true
}

export const FORM_8880_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  taxpayerTraditionalIRA: 'IRA truyền thống (Dòng 1)',
  taxpayerRothIRA: 'Roth IRA (Dòng 2)',
  taxpayer401k: '401k/403b/457 (Dòng 3)',
  taxpayerDistributions: 'Phân phối (Dòng 4)',
  taxpayerNetContributions: 'Đóng góp ròng người nộp thuế (Dòng 5)',
  eligibleContributions: 'Đóng góp đủ điều kiện (Dòng 6)',
  adjustedGrossIncome: 'AGI (Dòng 7)',
  creditRate: 'Tỷ lệ tín dụng (Dòng 8)',
  retirementSavingsCredit: 'Tín dụng tiết kiệm hưu trí (Dòng 9)',
  taxYear: 'Năm thuế',
}
