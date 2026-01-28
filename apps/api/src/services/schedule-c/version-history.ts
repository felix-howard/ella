/**
 * Schedule C Version History Service
 * Track changes between versions of Schedule C expense data
 */
import type { ScheduleCExpense } from '@ella/db'
import { Prisma } from '@ella/db'

const Decimal = Prisma.Decimal

// Version history entry stored in versionHistory JSON field
export interface VersionHistoryEntry {
  version: number
  submittedAt: string
  changes: string[]
  data: Partial<ScheduleCExpenseSnapshot>
}

// Snapshot of expense fields for version history
export interface ScheduleCExpenseSnapshot {
  businessName: string | null
  businessDesc: string | null
  grossReceipts: string | null
  returns: string | null
  costOfGoods: string | null
  otherIncome: string | null
  advertising: string | null
  carExpense: string | null
  commissions: string | null
  contractLabor: string | null
  depletion: string | null
  depreciation: string | null
  employeeBenefits: string | null
  insurance: string | null
  interestMortgage: string | null
  interestOther: string | null
  legalServices: string | null
  officeExpense: string | null
  pensionPlans: string | null
  rentEquipment: string | null
  rentProperty: string | null
  repairs: string | null
  supplies: string | null
  taxesAndLicenses: string | null
  travel: string | null
  meals: string | null
  utilities: string | null
  wages: string | null
  otherExpenses: string | null
  otherExpensesNotes: string | null
  vehicleMiles: number | null
  vehicleCommuteMiles: number | null
  vehicleOtherMiles: number | null
}

// Fields to track for changes (excluding metadata like id, status, timestamps)
const TRACKED_FIELDS = [
  'businessName',
  'businessDesc',
  'grossReceipts',
  'returns',
  'costOfGoods',
  'otherIncome',
  'advertising',
  'carExpense',
  'commissions',
  'contractLabor',
  'depletion',
  'depreciation',
  'employeeBenefits',
  'insurance',
  'interestMortgage',
  'interestOther',
  'legalServices',
  'officeExpense',
  'pensionPlans',
  'rentEquipment',
  'rentProperty',
  'repairs',
  'supplies',
  'taxesAndLicenses',
  'travel',
  'meals',
  'utilities',
  'wages',
  'otherExpenses',
  'otherExpensesNotes',
  'vehicleMiles',
  'vehicleCommuteMiles',
  'vehicleOtherMiles',
] as const

// Vietnamese field labels for change descriptions
const FIELD_LABELS_VI: Record<string, string> = {
  businessName: 'Tên doanh nghiệp',
  businessDesc: 'Mô tả kinh doanh',
  grossReceipts: 'Tổng thu',
  returns: 'Trả hàng/giảm giá',
  costOfGoods: 'Giá vốn hàng bán',
  otherIncome: 'Thu nhập khác',
  advertising: 'Quảng cáo',
  carExpense: 'Chi phí xe',
  commissions: 'Hoa hồng',
  contractLabor: 'Thuê ngoài',
  depletion: 'Khấu hao tài nguyên',
  depreciation: 'Khấu hao tài sản',
  employeeBenefits: 'Phúc lợi nhân viên',
  insurance: 'Bảo hiểm',
  interestMortgage: 'Lãi vay thế chấp',
  interestOther: 'Lãi vay khác',
  legalServices: 'Dịch vụ pháp lý',
  officeExpense: 'Chi phí văn phòng',
  pensionPlans: 'Kế hoạch hưu trí',
  rentEquipment: 'Thuê thiết bị',
  rentProperty: 'Thuê mặt bằng',
  repairs: 'Sửa chữa',
  supplies: 'Vật tư',
  taxesAndLicenses: 'Thuế & giấy phép',
  travel: 'Đi lại',
  meals: 'Ăn uống',
  utilities: 'Tiện ích',
  wages: 'Lương',
  otherExpenses: 'Chi phí khác',
  otherExpensesNotes: 'Ghi chú chi phí khác',
  vehicleMiles: 'Số dặm xe',
  vehicleCommuteMiles: 'Dặm đi làm',
  vehicleOtherMiles: 'Dặm cá nhân',
}

/**
 * Convert Decimal to string for comparison and storage
 */
function toStringValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Decimal) return value.toString()
  return String(value)
}

/**
 * Create snapshot of expense data for version history
 */
export function createExpenseSnapshot(expense: ScheduleCExpense): ScheduleCExpenseSnapshot {
  const snapshot: ScheduleCExpenseSnapshot = {
    businessName: expense.businessName,
    businessDesc: expense.businessDesc,
    grossReceipts: toStringValue(expense.grossReceipts),
    returns: toStringValue(expense.returns),
    costOfGoods: toStringValue(expense.costOfGoods),
    otherIncome: toStringValue(expense.otherIncome),
    advertising: toStringValue(expense.advertising),
    carExpense: toStringValue(expense.carExpense),
    commissions: toStringValue(expense.commissions),
    contractLabor: toStringValue(expense.contractLabor),
    depletion: toStringValue(expense.depletion),
    depreciation: toStringValue(expense.depreciation),
    employeeBenefits: toStringValue(expense.employeeBenefits),
    insurance: toStringValue(expense.insurance),
    interestMortgage: toStringValue(expense.interestMortgage),
    interestOther: toStringValue(expense.interestOther),
    legalServices: toStringValue(expense.legalServices),
    officeExpense: toStringValue(expense.officeExpense),
    pensionPlans: toStringValue(expense.pensionPlans),
    rentEquipment: toStringValue(expense.rentEquipment),
    rentProperty: toStringValue(expense.rentProperty),
    repairs: toStringValue(expense.repairs),
    supplies: toStringValue(expense.supplies),
    taxesAndLicenses: toStringValue(expense.taxesAndLicenses),
    travel: toStringValue(expense.travel),
    meals: toStringValue(expense.meals),
    utilities: toStringValue(expense.utilities),
    wages: toStringValue(expense.wages),
    otherExpenses: toStringValue(expense.otherExpenses),
    otherExpensesNotes: expense.otherExpensesNotes,
    vehicleMiles: expense.vehicleMiles,
    vehicleCommuteMiles: expense.vehicleCommuteMiles,
    vehicleOtherMiles: expense.vehicleOtherMiles,
  }
  return snapshot
}

/**
 * Detect changes between current and previous expense data
 * Returns list of Vietnamese change descriptions
 */
export function detectChanges(
  current: ScheduleCExpense,
  previous: ScheduleCExpenseSnapshot | null
): string[] {
  if (!previous) {
    return ['Tạo mới']
  }

  const changes: string[] = []

  for (const field of TRACKED_FIELDS) {
    const currentValue = toStringValue(current[field as keyof ScheduleCExpense])
    const previousValue = previous[field as keyof ScheduleCExpenseSnapshot]

    // Compare as strings to handle Decimal comparison
    const currentStr = currentValue || ''
    const previousStr = previousValue?.toString() || ''

    if (currentStr !== previousStr) {
      const label = FIELD_LABELS_VI[field] || field
      if (!previousStr && currentStr) {
        changes.push(`Thêm ${label}`)
      } else if (previousStr && !currentStr) {
        changes.push(`Xóa ${label}`)
      } else {
        changes.push(`Cập nhật ${label}`)
      }
    }
  }

  return changes
}

/**
 * Create a version history entry
 */
export function createVersionEntry(
  currentData: ScheduleCExpense,
  previousData: ScheduleCExpenseSnapshot | null,
  version: number
): VersionHistoryEntry {
  const changes = detectChanges(currentData, previousData)
  const snapshot = createExpenseSnapshot(currentData)

  return {
    version,
    submittedAt: new Date().toISOString(),
    changes,
    data: snapshot,
  }
}

/**
 * Parse version history from JSON field
 */
export function parseVersionHistory(versionHistory: unknown): VersionHistoryEntry[] {
  if (!versionHistory) return []
  if (Array.isArray(versionHistory)) return versionHistory as VersionHistoryEntry[]
  if (typeof versionHistory === 'string') {
    try {
      return JSON.parse(versionHistory) as VersionHistoryEntry[]
    } catch {
      return []
    }
  }
  return []
}

/**
 * Add new version entry to history
 */
export function appendVersionHistory(
  existingHistory: unknown,
  newEntry: VersionHistoryEntry
): VersionHistoryEntry[] {
  const history = parseVersionHistory(existingHistory)
  history.push(newEntry)
  return history
}
