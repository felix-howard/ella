/**
 * Form 8938 OCR Extraction Prompt
 * Statement of Specified Foreign Financial Assets (FATCA)
 */

export interface Form8938ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Filing Threshold
  filingStatus: string | null
  residesAbroad: boolean | null
  thresholdExceeds: boolean | null

  // Part I: Foreign Deposit Accounts
  foreignDepositAccounts: Array<{
    financialInstitution: string | null
    accountNumber: string | null
    country: string | null
    maxValueDuringYear: number | null
    yearEndValue: number | null
    isJointAccount: boolean
  }>

  // Part II: Other Foreign Financial Assets
  foreignFinancialAssets: Array<{
    assetDescription: string | null
    issuingEntity: string | null
    country: string | null
    maxValueDuringYear: number | null
    yearEndValue: number | null
    incomeType: string | null
    incomeAmount: number | null
  }>

  // Summary
  foreignAccountsTotal: number | null        // Total deposit accounts max value
  foreignSecuritiesTotal: number | null      // Total other assets max value
  foreignAssetsTotal: number | null          // CRITICAL - combined total

  // Income from Foreign Assets
  interestIncome: number | null
  dividendIncome: number | null
  royaltyIncome: number | null
  otherIncome: number | null
  capitalGainLoss: number | null

  taxYear: number | null
}

export function getForm8938ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8938 (Statement of Specified Foreign Financial Assets - FATCA).

IMPORTANT: Required for US taxpayers with foreign assets exceeding thresholds. Penalties for non-filing are severe.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

FILING THRESHOLD:
- filingStatus, residesAbroad (true/false), thresholdExceeds (true/false)

PART I - FOREIGN DEPOSIT ACCOUNTS:
- foreignDepositAccounts: Array of { financialInstitution, accountNumber, country, maxValueDuringYear, yearEndValue, isJointAccount }

PART II - OTHER FOREIGN ASSETS:
- foreignFinancialAssets: Array of { assetDescription, issuingEntity, country, maxValueDuringYear, yearEndValue, incomeType, incomeAmount }

SUMMARY:
- foreignAccountsTotal (total deposit accounts max value)
- foreignSecuritiesTotal (total other assets max value)
- foreignAssetsTotal (CRITICAL - total of all foreign assets)

INCOME:
- interestIncome, dividendIncome, royaltyIncome, otherIncome, capitalGainLoss

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "filingStatus": "MFJ",
  "residesAbroad": false,
  "thresholdExceeds": true,
  "foreignDepositAccounts": [
    {"financialInstitution": "HSBC UK", "accountNumber": "****1234", "country": "United Kingdom", "maxValueDuringYear": 85000.00, "yearEndValue": 72000.00, "isJointAccount": false}
  ],
  "foreignFinancialAssets": [],
  "foreignAccountsTotal": 85000.00,
  "foreignSecuritiesTotal": null,
  "foreignAssetsTotal": 85000.00,
  "interestIncome": 1200.00,
  "dividendIncome": null,
  "royaltyIncome": null,
  "otherIncome": null,
  "capitalGainLoss": null,
  "taxYear": 2024
}

Rules:
1. foreignAssetsTotal is most important (determines filing requirement)
2. Thresholds: $50K/$200K (US residents), $200K/$400K (abroad) single
3. Must report max value during year AND year-end value
4. All monetary values in USD as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

export function validateForm8938Data(data: unknown): data is Form8938ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (!Array.isArray(d.foreignDepositAccounts)) return false
  if (!Array.isArray(d.foreignFinancialAssets)) return false
  if (d.foreignAssetsTotal !== null && d.foreignAssetsTotal !== undefined && typeof d.foreignAssetsTotal !== 'number') return false
  return true
}

export const FORM_8938_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  filingStatus: 'Tình trạng khai thuế',
  residesAbroad: 'Cư trú nước ngoài',
  thresholdExceeds: 'Vượt ngưỡng',
  foreignAccountsTotal: 'Tổng tài khoản nước ngoài',
  foreignSecuritiesTotal: 'Tổng chứng khoán nước ngoài',
  foreignAssetsTotal: 'Tổng tài sản nước ngoài',
  interestIncome: 'Thu nhập lãi suất',
  dividendIncome: 'Thu nhập cổ tức',
  royaltyIncome: 'Thu nhập bản quyền',
  otherIncome: 'Thu nhập khác',
  capitalGainLoss: 'Lãi/lỗ vốn',
  taxYear: 'Năm thuế',
}
