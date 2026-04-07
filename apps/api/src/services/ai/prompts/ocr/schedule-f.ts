/**
 * Schedule F (Form 1040) OCR Extraction Prompt
 * Extracts structured data from Schedule F - Profit or Loss From Farming
 * Net farm profit -> Schedule 1 Line 6
 */

export interface ScheduleFExtractedData {
  taxYear: number | null
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Farm Information
  principalCropOrActivity: string | null // Line A
  accountingMethod: 'Cash' | 'Accrual' | null // Line G
  ein: string | null // Line H
  materialParticipation: boolean | null // Line I

  // Part I: Farm Income (Cash Method)
  salesLivestock: number | null // Line 1
  costBasisLivestock: number | null // Line 2
  livestockProfit: number | null // Line 3
  salesProduce: number | null // Line 4
  cooperativeDistributions: number | null // Line 5a
  agriculturalPayments: number | null // Line 6a
  commodityCreditLoans: number | null // Line 7a
  cropInsurance: number | null // Line 8a
  customHireIncome: number | null // Line 9
  otherFarmIncome: number | null // Line 10
  grossFarmIncome: number | null // Line 11

  // Part II: Farm Expenses
  carAndTruck: number | null // Line 12
  chemicals: number | null // Line 13
  conservation: number | null // Line 14
  customHireExpense: number | null // Line 15
  depreciation: number | null // Line 16
  employeeBenefit: number | null // Line 17
  feed: number | null // Line 18
  fertilizers: number | null // Line 19
  freight: number | null // Line 20
  gasoline: number | null // Line 21
  insurance: number | null // Line 22
  interestMortgage: number | null // Line 23a
  interestOther: number | null // Line 23b
  labor: number | null // Line 24
  pension: number | null // Line 25
  rentVehicles: number | null // Line 26a
  rentOther: number | null // Line 26b
  repairs: number | null // Line 27
  seeds: number | null // Line 28
  storage: number | null // Line 29
  supplies: number | null // Line 30
  taxes: number | null // Line 31
  utilities: number | null // Line 32
  veterinary: number | null // Line 33
  otherExpenses: number | null // Line 34
  totalExpenses: number | null // Line 35

  // Net Farm Profit
  netFarmProfit: number | null // Line 36 (CRITICAL) -> Schedule 1 Line 6
}

export function getScheduleFExtractionPrompt(): string {
  return `You are an OCR system. Extract data from IRS Schedule F (Form 1040) - Profit or Loss From Farming.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in the document
- If a field is blank or not visible, return null (never invent data)
- Monetary amounts: return as numbers without $ or commas (e.g., 50000.00)
- Negative amounts indicate farm losses — use negative numbers

FARM INFORMATION (top section):
- Line A: Principal crop or activity
- Line G: Accounting method (Cash/Accrual)
- Line H: Employer ID number (EIN)
- Line I: Did you materially participate? (Yes/No)

PART I - FARM INCOME (Cash Method):
- Line 1: Sales of livestock/produce you raised
- Line 2: Cost or basis of livestock/items sold
- Line 3: Subtract line 2 from line 1
- Line 4: Sales of produce bought for resale
- Line 5a: Cooperative distributions
- Line 6a: Agricultural program payments
- Line 7a: Commodity Credit Corporation loans
- Line 8a: Crop insurance proceeds
- Line 9: Custom hire (machine work) income
- Line 10: Other farm income
- Line 11: Gross farm income

PART II - FARM EXPENSES:
- Lines 12-34: Individual expense categories
- Line 35: Total expenses

NET FARM PROFIT OR LOSS:
- Line 36: Net farm profit or loss - MOST IMPORTANT -> Schedule 1 Line 6

OUTPUT FORMAT (JSON):
{
  "taxYear": 2023,
  "taxpayerName": "John Doe",
  "taxpayerSSN": "XXX-XX-XXXX",
  "principalCropOrActivity": "Corn, Soybeans",
  "accountingMethod": "Cash",
  "ein": "XX-XXXXXXX",
  "materialParticipation": true,
  "salesLivestock": 80000.00,
  "costBasisLivestock": 25000.00,
  "livestockProfit": 55000.00,
  "salesProduce": null,
  "cooperativeDistributions": 5000.00,
  "agriculturalPayments": 3000.00,
  "commodityCreditLoans": null,
  "cropInsurance": null,
  "customHireIncome": 2000.00,
  "otherFarmIncome": null,
  "grossFarmIncome": 65000.00,
  "carAndTruck": 4000.00,
  "chemicals": 3500.00,
  "conservation": null,
  "customHireExpense": 2000.00,
  "depreciation": 8000.00,
  "employeeBenefit": null,
  "feed": 12000.00,
  "fertilizers": 6000.00,
  "freight": 1500.00,
  "gasoline": 3000.00,
  "insurance": 4000.00,
  "interestMortgage": 2500.00,
  "interestOther": null,
  "labor": 8000.00,
  "pension": null,
  "rentVehicles": null,
  "rentOther": 5000.00,
  "repairs": 3000.00,
  "seeds": 4500.00,
  "storage": 1000.00,
  "supplies": 2000.00,
  "taxes": 2500.00,
  "utilities": 1800.00,
  "veterinary": 1500.00,
  "otherExpenses": 1000.00,
  "totalExpenses": 76800.00,
  "netFarmProfit": -11800.00
}

IMPORTANT:
- Return null for any field not found or blank
- Line 36 (netFarmProfit) is the MOST CRITICAL field -> Schedule 1 Line 6
- Negative netFarmProfit indicates a farm loss`
}

export function validateScheduleFData(data: unknown): data is ScheduleFExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const hasNet = d.netFarmProfit !== null && d.netFarmProfit !== undefined && typeof d.netFarmProfit === 'number'
  const hasGross = d.grossFarmIncome !== null && d.grossFarmIncome !== undefined && typeof d.grossFarmIncome === 'number'
  return hasNet || hasGross
}

export const SCHEDULE_F_FIELD_LABELS_VI: Record<string, string> = {
  taxYear: 'Năm thuế',
  taxpayerName: 'Tên người nộp thuế',
  taxpayerSSN: 'Số an sinh xã hội',
  principalCropOrActivity: 'Cây trồng/hoạt động chính',
  accountingMethod: 'Phương pháp kế toán',
  ein: 'Mã số thuế (EIN)',
  materialParticipation: 'Tham gia điều hành',
  // Part I: Farm Income
  salesLivestock: 'Bán gia súc/sản phẩm (Line 1)',
  costBasisLivestock: 'Giá vốn gia súc (Line 2)',
  livestockProfit: 'Lợi nhuận gia súc (Line 3)',
  salesProduce: 'Bán sản phẩm mua lại (Line 4)',
  cooperativeDistributions: 'Phân phối hợp tác xã (Line 5a)',
  agriculturalPayments: 'Trợ cấp nông nghiệp (Line 6a)',
  commodityCreditLoans: 'Vay CCC (Line 7a)',
  cropInsurance: 'Bảo hiểm mùa vụ (Line 8a)',
  customHireIncome: 'Thu nhập thuê máy (Line 9)',
  otherFarmIncome: 'Thu nhập nông trại khác (Line 10)',
  grossFarmIncome: 'Tổng thu nhập nông trại (Line 11)',
  // Part II: Farm Expenses
  carAndTruck: 'Chi phí xe (Line 12)',
  chemicals: 'Hóa chất (Line 13)',
  conservation: 'Bảo tồn (Line 14)',
  customHireExpense: 'Thuê máy (Line 15)',
  depreciation: 'Khấu hao (Line 16)',
  employeeBenefit: 'Phúc lợi nhân viên (Line 17)',
  feed: 'Thức ăn chăn nuôi (Line 18)',
  fertilizers: 'Phân bón (Line 19)',
  freight: 'Vận chuyển (Line 20)',
  gasoline: 'Xăng dầu (Line 21)',
  insurance: 'Bảo hiểm (Line 22)',
  interestMortgage: 'Lãi thế chấp (Line 23a)',
  interestOther: 'Lãi khác (Line 23b)',
  labor: 'Nhân công (Line 24)',
  pension: 'Lương hưu (Line 25)',
  rentVehicles: 'Thuê xe (Line 26a)',
  rentOther: 'Thuê khác (Line 26b)',
  repairs: 'Sửa chữa (Line 27)',
  seeds: 'Hạt giống (Line 28)',
  storage: 'Kho bãi (Line 29)',
  supplies: 'Vật tư (Line 30)',
  taxes: 'Thuế (Line 31)',
  utilities: 'Tiện ích (Line 32)',
  veterinary: 'Thú y (Line 33)',
  otherExpenses: 'Chi phí khác (Line 34)',
  totalExpenses: 'Tổng chi phí (Line 35)',
  netFarmProfit: 'Lợi nhuận ròng nông trại (Line 36)',
}
