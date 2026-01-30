/**
 * IRS Schedule C Expense Categories (Simplified)
 * Vietnamese labels and tooltips for nail tech/nail business clients
 * CPA-approved: Reduced from 28 to 5 fields + dynamic "Other" list
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

// Simplified expense fields (CPA-approved for nail tech clients)
export const SIMPLIFIED_EXPENSE_FIELDS: ExpenseCategory[] = [
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
    line: 22,
    label: 'Vật tư & Dụng cụ',
    tooltip: 'Vật tư tiêu hao cho kinh doanh: dụng cụ làm việc, vật liệu, đồ dùng.',
    placeholder: 'VD: 600.00',
    type: 'currency',
    group: 'other',
    field: 'supplies',
  },
]

// Car expense category (used by CarExpenseSection)
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  {
    line: 9,
    label: 'Chi phí xe thực tế',
    tooltip: 'Chi phí xe thực tế: xăng, bảo hiểm xe, sửa chữa, rửa xe (NẾU không dùng mileage rate).',
    placeholder: 'VD: 3,500.00',
    type: 'currency',
    group: 'car',
    field: 'carExpense',
  },
]

// Vehicle miles field (used by CarExpenseSection mileage input)
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
]

// === Backward-compatible exports (used by expense-section.tsx, kept to avoid build breaks) ===
// @deprecated - Will be removed in future cleanup PR
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

// @deprecated - Will be removed in future cleanup PR
export function getCategoriesByGroup(group: CategoryGroup): ExpenseCategory[] {
  return EXPENSE_CATEGORIES.filter(cat => cat.group === group)
}

// @deprecated - Will be removed in future cleanup PR
export const EXPENSE_GROUPS: CategoryGroup[] = [
  'general', 'professional', 'property', 'financial', 'people', 'car', 'other',
]

// @deprecated - Will be removed in future cleanup PR
export function countFilledFields(data: Record<string, unknown>): { filled: number; total: number } {
  const fields = SIMPLIFIED_EXPENSE_FIELDS.map(c => c.field)
  const filled = fields.filter(field => {
    const value = data[field]
    return value !== null && value !== undefined && value !== '' && value !== 0
  }).length
  return { filled, total: fields.length }
}
