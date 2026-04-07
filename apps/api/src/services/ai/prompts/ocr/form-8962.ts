/**
 * Form 8962 OCR Extraction Prompt
 * Premium Tax Credit (PTC) - ACA Marketplace
 */

export interface Form8962ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Family Information
  familySize: number | null                  // Line 1
  modifiedAGI: number | null                 // Line 2a
  householdIncome: number | null             // Line 3
  federalPovertyLine: number | null          // Line 4
  householdIncomePercent: number | null       // Line 5 (% of FPL)

  // Annual PTC Calculation
  annualPremium: number | null               // Line 11a
  annualSLCSP: number | null                 // Line 11b (second lowest cost silver plan)
  annualContributionAmount: number | null    // Line 11c
  annualMaxPTC: number | null                // Line 11d
  annualPTC: number | null                   // Line 11e

  // Monthly Amounts (if applicable)
  monthlyPTC: Array<{
    month: string | null
    premium: number | null
    slcsp: number | null
    contributionAmount: number | null
    maxPTC: number | null
    ptcAllowed: number | null
    advancePayment: number | null
  }>

  // Reconciliation
  totalPTCAllowed: number | null             // Line 24
  totalAdvancePayments: number | null        // Line 25
  netPTC: number | null                      // Line 26 (CRITICAL - if PTC > advance)
  excessAdvanceRepayment: number | null      // Line 29 (if advance > PTC)
  repaymentCap: number | null                // Line 28 (income-based cap)

  taxYear: number | null
}

export function getForm8962ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8962 (Premium Tax Credit).

IMPORTANT: Reconciles ACA marketplace premium tax credit with advance payments. Can result in additional credit or repayment.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

FAMILY & INCOME:
- familySize: Line 1
- modifiedAGI: Line 2a
- householdIncome: Line 3
- federalPovertyLine: Line 4
- householdIncomePercent: Line 5 (% of FPL)

ANNUAL PTC:
- annualPremium: Line 11a (total enrollment premiums)
- annualSLCSP: Line 11b (benchmark plan)
- annualContributionAmount: Line 11c (expected contribution)
- annualMaxPTC: Line 11d
- annualPTC: Line 11e

MONTHLY (if not same all year):
- monthlyPTC: Array of { month, premium, slcsp, contributionAmount, maxPTC, ptcAllowed, advancePayment }

RECONCILIATION:
- totalPTCAllowed: Line 24
- totalAdvancePayments: Line 25 (from Form 1095-A)
- netPTC: Line 26 (CRITICAL - additional credit if PTC > advance → Schedule 3)
- excessAdvanceRepayment: Line 29 (repay if advance > PTC → Schedule 2)
- repaymentCap: Line 28

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "familySize": 3,
  "modifiedAGI": 45000.00,
  "householdIncome": 45000.00,
  "federalPovertyLine": 24860.00,
  "householdIncomePercent": 181,
  "annualPremium": 9600.00,
  "annualSLCSP": 12000.00,
  "annualContributionAmount": 3200.00,
  "annualMaxPTC": 8800.00,
  "annualPTC": 6400.00,
  "monthlyPTC": [],
  "totalPTCAllowed": 6400.00,
  "totalAdvancePayments": 6000.00,
  "netPTC": 400.00,
  "excessAdvanceRepayment": null,
  "repaymentCap": null,
  "taxYear": 2024
}

Rules:
1. netPTC (Line 26) = additional credit; excessAdvanceRepayment (Line 29) = amount owed back
2. Must reconcile with Form 1095-A advance payments
3. Repayment caps apply based on income level
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

export function validateForm8962Data(data: unknown): data is Form8962ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (d.netPTC !== null && d.netPTC !== undefined && typeof d.netPTC !== 'number') return false
  return true
}

export const FORM_8962_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  familySize: 'Quy mô gia đình (Dòng 1)',
  modifiedAGI: 'AGI điều chỉnh (Dòng 2a)',
  householdIncome: 'Thu nhập hộ gia đình (Dòng 3)',
  federalPovertyLine: 'Ngưỡng nghèo liên bang (Dòng 4)',
  householdIncomePercent: 'Phần trăm FPL (Dòng 5)',
  annualPremium: 'Phí bảo hiểm hàng năm (Dòng 11a)',
  annualSLCSP: 'SLCSP (Dòng 11b)',
  annualContributionAmount: 'Đóng góp hàng năm (Dòng 11c)',
  annualMaxPTC: 'PTC tối đa hàng năm (Dòng 11d)',
  annualPTC: 'PTC hàng năm (Dòng 11e)',
  totalPTCAllowed: 'Tổng PTC cho phép (Dòng 24)',
  totalAdvancePayments: 'Tổng thanh toán trước (Dòng 25)',
  netPTC: 'PTC ròng (Dòng 26)',
  repaymentCap: 'Giới hạn hoàn trả (Dòng 28)',
  excessAdvanceRepayment: 'Hoàn trả dư (Dòng 29)',
  taxYear: 'Năm thuế',
}
