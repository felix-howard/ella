/**
 * Schedule C (Form 1040) OCR Extraction Prompt
 * Extracts structured data from Schedule C - Profit or Loss From Business
 * Sole proprietorship business income/expenses
 * Net profit -> Schedule 1 Line 3
 */

/**
 * Schedule C extracted data structure
 */
export interface ScheduleCExtractedData {
  taxYear: number | null

  // Business Information
  businessName: string | null
  proprietorName: string | null
  principalBusinessCode: string | null // NAICS code
  businessAddress: string | null
  ein: string | null // Employer ID Number
  accountingMethod: 'Cash' | 'Accrual' | 'Other' | null

  // Income Section (Part I)
  grossReceipts: number | null // Line 1
  returns: number | null // Line 2
  grossReceiptsLessReturns: number | null // Line 3
  costOfGoodsSold: number | null // Line 4
  grossProfit: number | null // Line 5
  otherIncome: number | null // Line 6
  grossIncome: number | null // Line 7

  // Expenses (Part II) - Key categories
  advertising: number | null // Line 8
  carAndTruck: number | null // Line 9
  commissions: number | null // Line 10
  contractLabor: number | null // Line 11
  depletion: number | null // Line 12
  depreciation: number | null // Line 13
  employeeBenefit: number | null // Line 14
  insurance: number | null // Line 15
  interestMortgage: number | null // Line 16a
  interestOther: number | null // Line 16b
  legalAndProfessional: number | null // Line 17
  officeExpense: number | null // Line 18
  pensionProfitSharing: number | null // Line 19
  rentVehicles: number | null // Line 20a
  rentMachinery: number | null // Line 20b
  repairs: number | null // Line 21
  supplies: number | null // Line 22
  taxesLicenses: number | null // Line 23
  travel: number | null // Line 24a
  mealsDeductible: number | null // Line 24b (50% deductible)
  utilities: number | null // Line 25
  wages: number | null // Line 26
  otherExpensesDescription: string | null // Line 27a description
  otherExpensesAmount: number | null // Line 27a
  totalExpenses: number | null // Line 28

  // Net Profit/Loss
  tentativeProfit: number | null // Line 29
  expensesForHomeUse: number | null // Line 30
  netProfit: number | null // Line 31 (MOST IMPORTANT -> Schedule 1 Line 3)

  // Additional Info
  materialParticipation: boolean | null // Line 32a
  startedOrAcquiredInYear: boolean | null // Line 32b
}

/**
 * Generate Schedule C OCR extraction prompt
 */
export function getScheduleCExtractionPrompt(): string {
  return `You are an OCR system. Extract data from IRS Schedule C (Form 1040) - Profit or Loss From Business.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in the document
- If a field is blank or not visible, return null (never invent data)
- Monetary amounts: return as numbers without $ or commas (e.g., 125000.00)
- Negative amounts indicate losses — use negative numbers
- This schedule reports sole proprietorship business income and expenses

BUSINESS INFORMATION (top section):
- Business name (principal business or profession)
- Proprietor's name
- Principal business code (6-digit NAICS code)
- Business address
- Employer ID number (EIN) - may be masked
- Accounting method: Cash, Accrual, or Other

PART I - INCOME:
- Line 1: Gross receipts or sales
- Line 2: Returns and allowances
- Line 3: Gross receipts less returns (Line 1 - Line 2)
- Line 4: Cost of goods sold (from Part III)
- Line 5: Gross profit (Line 3 - Line 4)
- Line 6: Other income
- Line 7: Gross income (Line 5 + Line 6)

PART II - EXPENSES:
- Line 8: Advertising
- Line 9: Car and truck expenses
- Line 10: Commissions and fees
- Line 11: Contract labor
- Line 12: Depletion
- Line 13: Depreciation (from Form 4562)
- Line 14: Employee benefit programs
- Line 15: Insurance (other than health)
- Line 16a: Interest on mortgage
- Line 16b: Interest on other business debt
- Line 17: Legal and professional services
- Line 18: Office expense
- Line 19: Pension and profit-sharing plans
- Line 20a: Rent on vehicles/equipment
- Line 20b: Rent on other business property
- Line 21: Repairs and maintenance
- Line 22: Supplies
- Line 23: Taxes and licenses
- Line 24a: Travel
- Line 24b: Deductible meals (50%)
- Line 25: Utilities
- Line 26: Wages
- Line 27a: Other expenses (capture description if visible)
- Line 28: Total expenses

NET PROFIT/LOSS:
- Line 29: Tentative profit (or loss) = Line 7 - Line 28
- Line 30: Expenses for business use of home
- Line 31: Net profit (or loss) - MOST IMPORTANT (goes to Schedule 1 Line 3)

CHECKBOXES (bottom):
- Line 32a: Material participation (Yes/No)
- Line 32b: Started or acquired business this year (Yes/No)

OUTPUT FORMAT (JSON):
{
  "taxYear": 2023,
  "businessName": "ABC Consulting",
  "proprietorName": "John Doe",
  "principalBusinessCode": "541611",
  "businessAddress": "123 Business Ave, Houston TX 77001",
  "ein": "XX-XXXXXXX",
  "accountingMethod": "Cash",
  "grossReceipts": 150000.00,
  "returns": 500.00,
  "grossReceiptsLessReturns": 149500.00,
  "costOfGoodsSold": null,
  "grossProfit": 149500.00,
  "otherIncome": null,
  "grossIncome": 149500.00,
  "advertising": 2500.00,
  "carAndTruck": 4800.00,
  "commissions": null,
  "contractLabor": 15000.00,
  "depletion": null,
  "depreciation": 3500.00,
  "employeeBenefit": null,
  "insurance": 2400.00,
  "interestMortgage": null,
  "interestOther": null,
  "legalAndProfessional": 1500.00,
  "officeExpense": 1200.00,
  "pensionProfitSharing": null,
  "rentVehicles": null,
  "rentMachinery": 800.00,
  "repairs": 500.00,
  "supplies": 2000.00,
  "taxesLicenses": 600.00,
  "travel": 3500.00,
  "mealsDeductible": 1000.00,
  "utilities": 1800.00,
  "wages": null,
  "otherExpensesDescription": "Software subscriptions",
  "otherExpensesAmount": 3600.00,
  "totalExpenses": 44700.00,
  "tentativeProfit": 104800.00,
  "expensesForHomeUse": 6000.00,
  "netProfit": 98800.00,
  "materialParticipation": true,
  "startedOrAcquiredInYear": false
}

IMPORTANT REMINDERS:
- Return null for any field not found or blank — never guess
- EIN may be masked as XX-XXXXXXX — return as-is
- Line 31 (netProfit) is the MOST CRITICAL field — flows to Schedule 1 Line 3
- A negative netProfit indicates a business loss`
}

/**
 * Validate Schedule C extracted data
 * Requires netProfit or grossReceipts as key financial fields
 */
export function validateScheduleCData(data: unknown): data is ScheduleCExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  // Must have at least one key financial field (not just taxYear or businessName)
  const hasNetProfit =
    d.netProfit !== null &&
    d.netProfit !== undefined &&
    typeof d.netProfit === 'number'

  const hasGrossReceipts =
    d.grossReceipts !== null &&
    d.grossReceipts !== undefined &&
    typeof d.grossReceipts === 'number'

  return hasNetProfit || hasGrossReceipts
}

/**
 * Vietnamese field labels for Schedule C
 */
export const SCHEDULE_C_FIELD_LABELS_VI: Record<string, string> = {
  taxYear: 'Năm thuế',
  // Business Info
  businessName: 'Tên doanh nghiệp',
  proprietorName: 'Tên chủ sở hữu',
  principalBusinessCode: 'Mã ngành nghề (NAICS)',
  businessAddress: 'Địa chỉ kinh doanh',
  ein: 'Mã số thuế doanh nghiệp (EIN)',
  accountingMethod: 'Phương pháp kế toán',
  // Income
  grossReceipts: 'Tổng doanh thu (Line 1)',
  returns: 'Hàng trả lại (Line 2)',
  grossReceiptsLessReturns: 'Doanh thu ròng (Line 3)',
  costOfGoodsSold: 'Giá vốn hàng bán (Line 4)',
  grossProfit: 'Lợi nhuận gộp (Line 5)',
  otherIncome: 'Thu nhập khác (Line 6)',
  grossIncome: 'Tổng thu nhập (Line 7)',
  // Expenses
  advertising: 'Chi phí quảng cáo (Line 8)',
  carAndTruck: 'Chi phí xe (Line 9)',
  commissions: 'Hoa hồng (Line 10)',
  contractLabor: 'Nhân công thuê ngoài (Line 11)',
  depletion: 'Cạn kiệt tài nguyên (Line 12)',
  depreciation: 'Khấu hao (Line 13)',
  employeeBenefit: 'Phúc lợi nhân viên (Line 14)',
  insurance: 'Bảo hiểm (Line 15)',
  interestMortgage: 'Lãi thế chấp (Line 16a)',
  interestOther: 'Lãi khác (Line 16b)',
  legalAndProfessional: 'Pháp lý & chuyên môn (Line 17)',
  officeExpense: 'Chi phí văn phòng (Line 18)',
  pensionProfitSharing: 'Lương hưu (Line 19)',
  rentVehicles: 'Thuê xe/thiết bị (Line 20a)',
  rentMachinery: 'Thuê BĐS kinh doanh (Line 20b)',
  repairs: 'Sửa chữa (Line 21)',
  supplies: 'Vật tư (Line 22)',
  taxesLicenses: 'Thuế & giấy phép (Line 23)',
  travel: 'Chi phí đi lại (Line 24a)',
  mealsDeductible: 'Ăn uống được khấu trừ (Line 24b)',
  utilities: 'Tiện ích (Line 25)',
  wages: 'Lương nhân viên (Line 26)',
  otherExpensesDescription: 'Mô tả chi phí khác (Line 27a)',
  otherExpensesAmount: 'Chi phí khác (Line 27a)',
  totalExpenses: 'Tổng chi phí (Line 28)',
  // Net Profit
  tentativeProfit: 'Lợi nhuận tạm tính (Line 29)',
  expensesForHomeUse: 'Chi phí văn phòng tại nhà (Line 30)',
  netProfit: 'Lợi nhuận ròng (Line 31)',
  // Additional
  materialParticipation: 'Tham gia điều hành (Line 32a)',
  startedOrAcquiredInYear: 'Bắt đầu trong năm (Line 32b)',
}
