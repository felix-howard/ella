/**
 * Form 8582 OCR Extraction Prompt
 * Passive Activity Loss Limitations
 */

export interface Form8582ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: Rental Activities with Active Participation
  rentalActivities: Array<{
    activityName: string | null
    currentYearIncome: number | null
    currentYearLoss: number | null
    priorYearUnallowedLoss: number | null
  }>
  totalRentalIncome: number | null
  totalRentalLoss: number | null

  // Part II: Special Allowance ($25,000)
  modifiedAGI: number | null
  specialAllowanceReduction: number | null   // 50% of MAGI over $100K
  allowedSpecialAllowance: number | null     // Up to $25,000

  // Part III: Total Allowed Losses
  totalPassiveIncome: number | null
  totalPassiveLoss: number | null
  netPassiveLoss: number | null
  allowedLosses: number | null               // CRITICAL → Schedule E, etc.

  // Carryforward
  carryforwardLoss: number | null            // Disallowed loss to next year

  taxYear: number | null
}

export function getForm8582ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8582 (Passive Activity Loss Limitations).

IMPORTANT: Limits deduction of passive losses (especially rental) against non-passive income.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

PART I - RENTAL ACTIVITIES:
- rentalActivities: Array of { activityName, currentYearIncome, currentYearLoss, priorYearUnallowedLoss }
- totalRentalIncome, totalRentalLoss

PART II - SPECIAL ALLOWANCE:
- modifiedAGI
- specialAllowanceReduction (50% of MAGI over $100K)
- allowedSpecialAllowance (up to $25,000 for active participation)

PART III - TOTAL ALLOWED:
- totalPassiveIncome, totalPassiveLoss
- netPassiveLoss
- allowedLosses (CRITICAL - deductible passive loss → Schedule E)

CARRYFORWARD:
- carryforwardLoss (disallowed loss carried to next year)

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "rentalActivities": [
    {"activityName": "123 Rental Ln", "currentYearIncome": 12000.00, "currentYearLoss": -20000.00, "priorYearUnallowedLoss": -5000.00}
  ],
  "totalRentalIncome": 12000.00,
  "totalRentalLoss": -20000.00,
  "modifiedAGI": 85000.00,
  "specialAllowanceReduction": null,
  "allowedSpecialAllowance": 13000.00,
  "totalPassiveIncome": 12000.00,
  "totalPassiveLoss": -25000.00,
  "netPassiveLoss": -13000.00,
  "allowedLosses": 13000.00,
  "carryforwardLoss": 12000.00,
  "taxYear": 2024
}

Rules:
1. allowedLosses is most important (deductible amount on Schedule E)
2. $25,000 special allowance phases out between $100K-$150K MAGI
3. Losses negative, income positive
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

export function validateForm8582Data(data: unknown): data is Form8582ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (!Array.isArray(d.rentalActivities)) return false
  if (d.allowedLosses !== null && d.allowedLosses !== undefined && typeof d.allowedLosses !== 'number') return false
  return true
}

export const FORM_8582_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  totalRentalIncome: 'Tổng thu nhập cho thuê',
  totalRentalLoss: 'Tổng lỗ cho thuê',
  modifiedAGI: 'AGI điều chỉnh',
  specialAllowanceReduction: 'Giảm trợ cấp đặc biệt',
  allowedSpecialAllowance: 'Trợ cấp đặc biệt cho phép',
  totalPassiveIncome: 'Tổng thu nhập thụ động',
  totalPassiveLoss: 'Tổng lỗ thụ động',
  netPassiveLoss: 'Lỗ thụ động ròng',
  allowedLosses: 'Lỗ được phép khấu trừ',
  carryforwardLoss: 'Lỗ chuyển tiếp',
  taxYear: 'Năm thuế',
}
