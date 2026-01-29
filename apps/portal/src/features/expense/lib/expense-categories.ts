/**
 * IRS Schedule C Expense Categories
 * Vietnamese labels and tooltips for client-facing expense form
 * Reference: IRS Form 1040 Schedule C (Profit or Loss From Business)
 */

export type FieldType = 'currency' | 'integer' | 'text' | 'date' | 'boolean'
export type CategoryGroup = 'income' | 'general' | 'professional' | 'property' | 'financial' | 'people' | 'car' | 'vehicle' | 'other'

export interface ExpenseCategory {
  /** IRS Schedule C line number */
  line: number
  /** Vietnamese label */
  label: string
  /** Vietnamese tooltip with examples */
  tooltip: string
  /** Placeholder example */
  placeholder: string
  /** Field type for validation */
  type: FieldType
  /** Unit label (e.g., 'dặm') */
  unit?: string
  /** Category group for sectioning */
  group: CategoryGroup
  /** Field name in API */
  field: string
}

// Current IRS mileage rate for 2025 tax year (67 cents per mile)
export const MILEAGE_RATE_2025 = 0.67

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  // ============ INCOME (Part I) ============
  {
    line: 1,
    label: 'Thu nhập gộp (1099-NEC)',
    tooltip: 'Tổng thu nhập từ các form 1099-NEC đã nhận. Số này được điền sẵn từ hồ sơ thuế của bạn.',
    placeholder: '0.00',
    type: 'currency',
    group: 'income',
    field: 'grossReceipts',
  },
  {
    line: 2,
    label: 'Hoàn trả & chiết khấu',
    tooltip: 'Số tiền hoàn trả cho khách hàng, chiết khấu, hoặc điều chỉnh doanh thu.',
    placeholder: 'VD: 500.00',
    type: 'currency',
    group: 'income',
    field: 'returns',
  },
  {
    line: 4,
    label: 'Giá vốn hàng bán',
    tooltip: 'Chi phí mua hàng hóa hoặc nguyên vật liệu để bán (áp dụng cho kinh doanh bán hàng).',
    placeholder: 'VD: 2,000.00',
    type: 'currency',
    group: 'income',
    field: 'costOfGoods',
  },
  {
    line: 6,
    label: 'Thu nhập khác',
    tooltip: 'Thu nhập từ hoạt động kinh doanh ngoài 1099-NEC (VD: tiền mặt, bán lẻ, phí dịch vụ).',
    placeholder: 'VD: 1,200.00',
    type: 'currency',
    group: 'income',
    field: 'otherIncome',
  },

  // ============ GENERAL EXPENSES ============
  {
    line: 8,
    label: 'Quảng cáo',
    tooltip: 'Chi phí quảng cáo: Facebook/Google ads, danh thiếp, tờ rơi, biển hiệu, quảng cáo online.',
    placeholder: 'VD: 1,200.00',
    type: 'currency',
    group: 'general',
    field: 'advertising',
  },
  {
    line: 18,
    label: 'Văn phòng phẩm',
    tooltip: 'Chi phí văn phòng: giấy, mực in, phần mềm, internet, điện thoại kinh doanh.',
    placeholder: 'VD: 800.00',
    type: 'currency',
    group: 'general',
    field: 'officeExpense',
  },
  {
    line: 22,
    label: 'Vật tư & Dụng cụ',
    tooltip: 'Vật tư tiêu hao cho kinh doanh: dụng cụ làm việc, vật liệu, đồ dùng.',
    placeholder: 'VD: 600.00',
    type: 'currency',
    group: 'general',
    field: 'supplies',
  },

  // ============ PROFESSIONAL EXPENSES ============
  {
    line: 17,
    label: 'Dịch vụ pháp lý & chuyên nghiệp',
    tooltip: 'Chi phí thuê luật sư, kế toán, tư vấn chuyên nghiệp cho kinh doanh.',
    placeholder: 'VD: 1,500.00',
    type: 'currency',
    group: 'professional',
    field: 'legalServices',
  },
  {
    line: 10,
    label: 'Hoa hồng & Phí',
    tooltip: 'Hoa hồng trả cho người môi giới, đại lý, hoặc phí giao dịch (VD: phí Stripe, PayPal).',
    placeholder: 'VD: 300.00',
    type: 'currency',
    group: 'professional',
    field: 'commissions',
  },
  {
    line: 11,
    label: 'Nhân công hợp đồng',
    tooltip: 'Chi phí thuê thầu phụ, freelancer làm việc cho bạn (form 1099-NEC).',
    placeholder: 'VD: 5,000.00',
    type: 'currency',
    group: 'professional',
    field: 'contractLabor',
  },

  // ============ PROPERTY EXPENSES ============
  {
    line: 20,
    label: 'Thuê xe/thiết bị',
    tooltip: 'Chi phí thuê xe, máy móc, thiết bị cho kinh doanh (không bao gồm thuê văn phòng).',
    placeholder: 'VD: 400.00',
    type: 'currency',
    group: 'property',
    field: 'rentEquipment',
  },
  {
    line: 20,
    label: 'Thuê mặt bằng',
    tooltip: 'Chi phí thuê văn phòng, cửa hàng, kho bãi cho kinh doanh.',
    placeholder: 'VD: 2,400.00',
    type: 'currency',
    group: 'property',
    field: 'rentProperty',
  },
  {
    line: 21,
    label: 'Sửa chữa & bảo trì',
    tooltip: 'Chi phí sửa chữa thiết bị, máy móc, phương tiện kinh doanh.',
    placeholder: 'VD: 500.00',
    type: 'currency',
    group: 'property',
    field: 'repairs',
  },
  {
    line: 25,
    label: 'Điện nước & tiện ích',
    tooltip: 'Chi phí điện, nước, gas, internet tại địa điểm kinh doanh.',
    placeholder: 'VD: 1,200.00',
    type: 'currency',
    group: 'property',
    field: 'utilities',
  },

  // ============ FINANCIAL EXPENSES ============
  {
    line: 15,
    label: 'Bảo hiểm',
    tooltip: 'Bảo hiểm kinh doanh: bảo hiểm trách nhiệm, bảo hiểm thiết bị, bảo hiểm y tế (nếu self-employed).',
    placeholder: 'VD: 2,000.00',
    type: 'currency',
    group: 'financial',
    field: 'insurance',
  },
  {
    line: 16,
    label: 'Lãi vay thế chấp',
    tooltip: 'Lãi suất vay thế chấp cho bất động sản kinh doanh.',
    placeholder: 'VD: 3,000.00',
    type: 'currency',
    group: 'financial',
    field: 'interestMortgage',
  },
  {
    line: 16,
    label: 'Lãi vay khác',
    tooltip: 'Lãi suất vay kinh doanh khác: thẻ tín dụng kinh doanh, vay thiết bị.',
    placeholder: 'VD: 500.00',
    type: 'currency',
    group: 'financial',
    field: 'interestOther',
  },
  {
    line: 23,
    label: 'Thuế & giấy phép',
    tooltip: 'Thuế kinh doanh địa phương, giấy phép kinh doanh, phí đăng ký.',
    placeholder: 'VD: 300.00',
    type: 'currency',
    group: 'financial',
    field: 'taxesAndLicenses',
  },

  // ============ PEOPLE EXPENSES ============
  {
    line: 26,
    label: 'Lương nhân viên',
    tooltip: 'Tiền lương trả cho nhân viên W-2 (không bao gồm chủ doanh nghiệp).',
    placeholder: 'VD: 30,000.00',
    type: 'currency',
    group: 'people',
    field: 'wages',
  },
  {
    line: 14,
    label: 'Phúc lợi nhân viên',
    tooltip: 'Chi phí phúc lợi: bảo hiểm sức khỏe nhân viên, nghỉ phép có lương.',
    placeholder: 'VD: 5,000.00',
    type: 'currency',
    group: 'people',
    field: 'employeeBenefits',
  },
  {
    line: 19,
    label: 'Quỹ hưu trí',
    tooltip: 'Đóng góp vào quỹ hưu trí cho nhân viên (SEP-IRA, SIMPLE, 401k).',
    placeholder: 'VD: 3,000.00',
    type: 'currency',
    group: 'people',
    field: 'pensionPlans',
  },

  // ============ CAR EXPENSES ============
  {
    line: 9,
    label: 'Chi phí xe thực tế',
    tooltip: 'Chi phí xe thực tế: xăng, bảo hiểm xe, sửa chữa, rửa xe (NẾU không dùng mileage rate).',
    placeholder: 'VD: 3,500.00',
    type: 'currency',
    group: 'car',
    field: 'carExpense',
  },

  // ============ OTHER EXPENSES ============
  {
    line: 24,
    label: 'Chi phí đi lại',
    tooltip: 'Chi phí công tác: vé máy bay, khách sạn, taxi (không bao gồm ăn uống).',
    placeholder: 'VD: 2,000.00',
    type: 'currency',
    group: 'other',
    field: 'travel',
  },
  {
    line: 24,
    label: 'Ăn uống kinh doanh',
    tooltip: 'Chi phí ăn uống với khách hàng, đối tác kinh doanh (chỉ được khấu trừ 50%).',
    placeholder: 'VD: 800.00',
    type: 'currency',
    group: 'other',
    field: 'meals',
  },
  {
    line: 13,
    label: 'Khấu hao tài sản',
    tooltip: 'Khấu hao thiết bị, máy móc, xe cộ theo thời gian sử dụng (thường do CPA tính).',
    placeholder: 'VD: 1,500.00',
    type: 'currency',
    group: 'other',
    field: 'depreciation',
  },
  {
    line: 12,
    label: 'Cạn kiệt tài nguyên',
    tooltip: 'Khấu hao tài nguyên thiên nhiên (áp dụng cho khai thác khoáng sản, dầu khí).',
    placeholder: 'VD: 0.00',
    type: 'currency',
    group: 'other',
    field: 'depletion',
  },
  {
    line: 27,
    label: 'Chi phí khác',
    tooltip: 'Chi phí kinh doanh hợp lệ khác không thuộc các mục trên.',
    placeholder: 'VD: 500.00',
    type: 'currency',
    group: 'other',
    field: 'otherExpenses',
  },
]

// Vehicle information fields (Part IV)
export const VEHICLE_FIELDS: ExpenseCategory[] = [
  {
    line: 44,
    label: 'Tổng số dặm kinh doanh',
    tooltip: 'Tổng số dặm bạn lái xe cho mục đích kinh doanh trong năm (giao hàng, gặp khách, công việc).',
    placeholder: 'VD: 12,000',
    type: 'integer',
    unit: 'dặm',
    group: 'vehicle',
    field: 'vehicleMiles',
  },
  {
    line: 45,
    label: 'Số dặm đi làm',
    tooltip: 'Số dặm đi từ nhà đến nơi làm việc chính (commute - KHÔNG được khấu trừ).',
    placeholder: 'VD: 3,000',
    type: 'integer',
    unit: 'dặm',
    group: 'vehicle',
    field: 'vehicleCommuteMiles',
  },
  {
    line: 46,
    label: 'Số dặm cá nhân khác',
    tooltip: 'Số dặm cho mục đích cá nhân (đi chợ, đưa con đi học, du lịch).',
    placeholder: 'VD: 5,000',
    type: 'integer',
    unit: 'dặm',
    group: 'vehicle',
    field: 'vehicleOtherMiles',
  },
  {
    line: 43,
    label: 'Ngày bắt đầu sử dụng',
    tooltip: 'Ngày xe bắt đầu được sử dụng cho kinh doanh.',
    placeholder: 'Chọn ngày',
    type: 'date',
    group: 'vehicle',
    field: 'vehicleDateInService',
  },
]

// Group labels for section headers
export const GROUP_LABELS: Record<CategoryGroup, string> = {
  income: 'Thu nhập (Part I)',
  general: 'Chi phí chung',
  professional: 'Dịch vụ chuyên nghiệp',
  property: 'Bất động sản & Thiết bị',
  financial: 'Tài chính & Bảo hiểm',
  people: 'Nhân sự',
  car: 'Chi phí xe',
  vehicle: 'Thông tin xe (Part IV)',
  other: 'Chi phí khác',
}

// Get categories by group
export function getCategoriesByGroup(group: CategoryGroup): ExpenseCategory[] {
  return EXPENSE_CATEGORIES.filter(cat => cat.group === group)
}

// Get all expense groups in display order
export const EXPENSE_GROUPS: CategoryGroup[] = [
  'general',
  'professional',
  'property',
  'financial',
  'people',
  'car',
  'other',
]

// Count non-empty fields for progress indicator
export function countFilledFields(data: Record<string, unknown>): { filled: number; total: number } {
  const expenseFields = EXPENSE_CATEGORIES.filter(c => c.group !== 'income').map(c => c.field)
  const filled = expenseFields.filter(field => {
    const value = data[field]
    return value !== null && value !== undefined && value !== '' && value !== 0
  }).length
  return { filled, total: expenseFields.length }
}
