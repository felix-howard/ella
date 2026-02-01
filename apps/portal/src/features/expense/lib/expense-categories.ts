/**
 * IRS Schedule C Expense Categories (Simplified)
 * i18n-enabled labels and tooltips for nail tech/nail business clients
 * CPA-approved: Reduced from 28 to 5 fields + dynamic "Other" list
 *
 * Labels resolve dynamically via i18n.t() at access time (not module load),
 * so they react to language changes without page reload.
 */
import i18n from '../../../lib/i18n'

export type FieldType = 'currency' | 'integer' | 'text' | 'date' | 'boolean'
export type CategoryGroup = 'income' | 'general' | 'professional' | 'property' | 'financial' | 'people' | 'car' | 'vehicle' | 'other'

export interface ExpenseCategory {
  /** IRS Schedule C line number */
  line: number
  /** Translated label (resolved dynamically) */
  label: string
  /** Translated tooltip with examples */
  tooltip: string
  /** Translated placeholder */
  placeholder: string
  /** Field type for validation */
  type: FieldType
  /** Translated unit label (e.g., 'miles') */
  unit?: string
  /** Category group for sectioning */
  group: CategoryGroup
  /** Field name in API */
  field: string
  /** Translated description shown below label */
  description?: string
}

// Current IRS mileage rate for 2025 tax year (67 cents per mile)
export const MILEAGE_RATE_2025 = 0.67

// Static config for expense fields (i18n keys, not resolved labels)
interface ExpenseCategoryConfig {
  line: number
  labelKey: string
  tooltipKey: string
  placeholderKey: string
  type: FieldType
  unitKey?: string
  group: CategoryGroup
  field: string
  descriptionKey?: string
}

const SIMPLIFIED_EXPENSE_CONFIGS: ExpenseCategoryConfig[] = [
  {
    line: 24,
    labelKey: 'expense.travelExpense',
    tooltipKey: 'expense.travelTooltip',
    descriptionKey: 'expense.travelDescription',
    placeholderKey: 'expense.travelPlaceholder',
    type: 'currency',
    group: 'other',
    field: 'travel',
  },
  {
    line: 24,
    labelKey: 'expense.mealsExpense',
    tooltipKey: 'expense.mealsTooltip',
    descriptionKey: 'expense.mealsDescription',
    placeholderKey: 'expense.mealsPlaceholder',
    type: 'currency',
    group: 'other',
    field: 'meals',
  },
  {
    line: 22,
    labelKey: 'expense.suppliesExpense',
    tooltipKey: 'expense.suppliesTooltip',
    descriptionKey: 'expense.suppliesDescription',
    placeholderKey: 'expense.suppliesPlaceholder',
    type: 'currency',
    group: 'other',
    field: 'supplies',
  },
]

const CAR_EXPENSE_CONFIGS: ExpenseCategoryConfig[] = [
  {
    line: 9,
    labelKey: 'expense.actualCarExpense',
    tooltipKey: 'expense.actualCarTooltip',
    placeholderKey: 'expense.actualCarPlaceholder',
    type: 'currency',
    group: 'car',
    field: 'carExpense',
  },
]

const VEHICLE_FIELD_CONFIGS: ExpenseCategoryConfig[] = [
  {
    line: 44,
    labelKey: 'expense.totalMiles',
    tooltipKey: 'expense.totalMilesTooltip',
    placeholderKey: 'expense.totalMilesPlaceholder',
    type: 'integer',
    unitKey: 'expense.miles',
    group: 'vehicle',
    field: 'vehicleMiles',
  },
]

// Resolve a config to a category with translated labels (called at access time)
function resolveCategory(cfg: ExpenseCategoryConfig): ExpenseCategory {
  return {
    line: cfg.line,
    label: i18n.t(cfg.labelKey),
    tooltip: i18n.t(cfg.tooltipKey),
    placeholder: i18n.t(cfg.placeholderKey),
    type: cfg.type,
    unit: cfg.unitKey ? i18n.t(cfg.unitKey) : undefined,
    group: cfg.group,
    field: cfg.field,
    description: cfg.descriptionKey ? i18n.t(cfg.descriptionKey) : undefined,
  }
}

// Create a Proxy array that resolves i18n labels on every access
function createReactiveArray(configs: ExpenseCategoryConfig[]): ExpenseCategory[] {
  return new Proxy([] as ExpenseCategory[], {
    get(_, prop: string | symbol) {
      if (prop === 'length') return configs.length
      if (prop === Symbol.iterator) {
        return function* () {
          for (const cfg of configs) yield resolveCategory(cfg)
        }
      }
      const index = typeof prop === 'string' ? Number(prop) : NaN
      if (!isNaN(index) && index >= 0 && index < configs.length) {
        return resolveCategory(configs[index])
      }
      // Support array methods (map, filter, forEach, etc.)
      const arrayMethods = ['map', 'filter', 'forEach', 'find', 'some', 'every', 'reduce', 'flatMap', 'findIndex', 'includes', 'indexOf', 'slice', 'concat', 'join']
      if (typeof prop === 'string' && arrayMethods.includes(prop)) {
        return (...args: unknown[]) => {
          const resolved = configs.map(resolveCategory)
          return (resolved as any)[prop](...args)
        }
      }
      return (configs as any)[prop]
    },
  })
}

// Reactive exports - labels resolve dynamically on each access
export const SIMPLIFIED_EXPENSE_FIELDS: ExpenseCategory[] = createReactiveArray(SIMPLIFIED_EXPENSE_CONFIGS)
export const EXPENSE_CATEGORIES: ExpenseCategory[] = createReactiveArray(CAR_EXPENSE_CONFIGS)
export const VEHICLE_FIELDS: ExpenseCategory[] = createReactiveArray(VEHICLE_FIELD_CONFIGS)

// Group labels config
const GROUP_LABEL_KEYS: Record<CategoryGroup, string> = {
  income: 'expense.income',
  general: 'expense.businessExpenses',
  professional: 'expense.businessExpenses',
  property: 'expense.businessExpenses',
  financial: 'expense.businessExpenses',
  people: 'expense.businessExpenses',
  car: 'expense.carAndMileage',
  vehicle: 'expense.vehicleInfo',
  other: 'expense.otherExpenses',
}

// Reactive GROUP_LABELS - resolves at access time
export const GROUP_LABELS: Record<CategoryGroup, string> = new Proxy(
  {} as Record<CategoryGroup, string>,
  {
    get(_, prop: string) {
      const key = GROUP_LABEL_KEYS[prop as CategoryGroup]
      return key ? i18n.t(key) : undefined
    },
    has(_, prop: string) {
      return prop in GROUP_LABEL_KEYS
    },
    ownKeys() {
      return Object.keys(GROUP_LABEL_KEYS)
    },
    getOwnPropertyDescriptor(_, prop: string) {
      if (prop in GROUP_LABEL_KEYS) {
        return { configurable: true, enumerable: true }
      }
    },
  }
)

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
  const fields = SIMPLIFIED_EXPENSE_CONFIGS.map(c => c.field)
  const filled = fields.filter(field => {
    const value = data[field]
    return value !== null && value !== undefined && value !== '' && value !== 0
  }).length
  return { filled, total: fields.length }
}
