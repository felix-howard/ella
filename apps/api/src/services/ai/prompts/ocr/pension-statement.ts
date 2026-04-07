/**
 * Pension Statement OCR Extraction Prompt
 * Extracts structured data from pension/defined benefit plan statements
 */

export interface PensionStatementExtractedData {
  planName: string | null
  sponsorName: string | null
  participantName: string | null
  accountBalance: number | null
  monthlyBenefit: number | null
  benefitStartDate: string | null
  yearsOfService: number | null
}

export function getPensionStatementExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from U.S. pension and defined benefit plan statements. Extract key benefit information accurately.

IMPORTANT: This is a financial document for tax preparation. Accuracy is critical. If a value is unclear, use null rather than guessing.

Extract the following fields:

PLAN INFORMATION:
- planName: Name of the pension plan (e.g., "XYZ Corporation Pension Plan")
- sponsorName: Name of the employer or plan sponsor
- participantName: Name of the plan participant/retiree

BENEFIT DETAILS:
- accountBalance: Current account or accumulated benefit value
- monthlyBenefit: Monthly benefit amount (if receiving or projected)
- benefitStartDate: Date benefits began or are projected to begin (MM/DD/YYYY)
- yearsOfService: Number of years of credited service

Respond in JSON format:
{
  "planName": "ABC Corporation Defined Benefit Pension Plan",
  "sponsorName": "ABC Corporation",
  "participantName": "Jane Doe",
  "accountBalance": 250000.00,
  "monthlyBenefit": 1850.00,
  "benefitStartDate": "07/01/2024",
  "yearsOfService": 28
}

Rules:
1. All monetary values should be numbers without $ or commas
2. Use null for unclear or missing fields, NEVER guess
3. yearsOfService should be a whole number
4. benefitStartDate format: MM/DD/YYYY
5. monthlyBenefit may appear as "estimated monthly benefit" or "projected benefit"`
}

export function validatePensionStatementData(data: unknown): data is PensionStatementExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('participantName' in d)) return false
  if (!('planName' in d)) return false
  if (d.accountBalance !== null && typeof d.accountBalance !== 'number') return false
  if (d.monthlyBenefit !== null && typeof d.monthlyBenefit !== 'number') return false
  if (d.yearsOfService !== null && typeof d.yearsOfService !== 'number') return false
  return true
}

export const PENSION_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  planName: 'Tên Kế hoạch Hưu trí',
  sponsorName: 'Tên Nhà tài trợ Kế hoạch',
  participantName: 'Tên Người tham gia',
  accountBalance: 'Số dư Tài khoản',
  monthlyBenefit: 'Quyền lợi Hàng tháng',
  benefitStartDate: 'Ngày bắt đầu Quyền lợi',
  yearsOfService: 'Số năm Phục vụ',
}
