/**
 * Rental Form Categories
 * i18n-enabled labels for Schedule E rental property form
 * Labels resolve dynamically via i18n.t() at access time (not module load)
 */
import i18n from '../../../lib/i18n'
import type { ScheduleEPropertyType } from '@ella/shared'

export type RentalFieldType = 'currency' | 'integer' | 'text'

export interface RentalExpenseField {
  field: string
  label: string
  tooltip: string
  placeholder: string
  type: RentalFieldType
  line: number
}

export interface PropertyTypeOption {
  value: ScheduleEPropertyType
  label: string
}

// Static config for expense fields
interface ExpenseFieldConfig {
  field: string
  labelKey: string
  tooltipKey: string
  placeholderKey: string
  type: RentalFieldType
  line: number
}

const RENTAL_EXPENSE_CONFIGS: ExpenseFieldConfig[] = [
  {
    field: 'insurance',
    labelKey: 'rental.insurance',
    tooltipKey: 'rental.insuranceTooltip',
    placeholderKey: 'rental.expensePlaceholder',
    type: 'currency',
    line: 9,
  },
  {
    field: 'mortgageInterest',
    labelKey: 'rental.mortgageInterest',
    tooltipKey: 'rental.mortgageInterestTooltip',
    placeholderKey: 'rental.expensePlaceholder',
    type: 'currency',
    line: 12,
  },
  {
    field: 'repairs',
    labelKey: 'rental.repairs',
    tooltipKey: 'rental.repairsTooltip',
    placeholderKey: 'rental.expensePlaceholder',
    type: 'currency',
    line: 14,
  },
  {
    field: 'taxes',
    labelKey: 'rental.taxes',
    tooltipKey: 'rental.taxesTooltip',
    placeholderKey: 'rental.expensePlaceholder',
    type: 'currency',
    line: 16,
  },
  {
    field: 'utilities',
    labelKey: 'rental.utilities',
    tooltipKey: 'rental.utilitiesTooltip',
    placeholderKey: 'rental.expensePlaceholder',
    type: 'currency',
    line: 17,
  },
  {
    field: 'managementFees',
    labelKey: 'rental.managementFees',
    tooltipKey: 'rental.managementFeesTooltip',
    placeholderKey: 'rental.expensePlaceholder',
    type: 'currency',
    line: 11,
  },
  {
    field: 'cleaningMaintenance',
    labelKey: 'rental.cleaningMaintenance',
    tooltipKey: 'rental.cleaningMaintenanceTooltip',
    placeholderKey: 'rental.expensePlaceholder',
    type: 'currency',
    line: 7,
  },
]

// Property type config
interface PropertyTypeConfig {
  value: ScheduleEPropertyType
  labelKey: string
}

const PROPERTY_TYPE_CONFIGS: PropertyTypeConfig[] = [
  { value: 1, labelKey: 'rental.typeSingleFamily' },
  { value: 2, labelKey: 'rental.typeMultiFamily' },
  { value: 3, labelKey: 'rental.typeVacation' },
  { value: 4, labelKey: 'rental.typeCommercial' },
  { value: 5, labelKey: 'rental.typeLand' },
  { value: 7, labelKey: 'rental.typeSelfRental' },
  { value: 8, labelKey: 'rental.typeOther' },
]

// Resolve expense field config to translated field
function resolveExpenseField(cfg: ExpenseFieldConfig): RentalExpenseField {
  return {
    field: cfg.field,
    label: i18n.t(cfg.labelKey),
    tooltip: i18n.t(cfg.tooltipKey),
    placeholder: i18n.t(cfg.placeholderKey),
    type: cfg.type,
    line: cfg.line,
  }
}

// Resolve property type config to translated option
function resolvePropertyType(cfg: PropertyTypeConfig): PropertyTypeOption {
  return {
    value: cfg.value,
    label: i18n.t(cfg.labelKey),
  }
}

// Create a Proxy array that resolves i18n labels on every access
function createReactiveExpenseArray(configs: ExpenseFieldConfig[]): RentalExpenseField[] {
  return new Proxy([] as RentalExpenseField[], {
    get(_, prop: string | symbol) {
      if (prop === 'length') return configs.length
      if (prop === Symbol.iterator) {
        return function* () {
          for (const cfg of configs) yield resolveExpenseField(cfg)
        }
      }
      const index = typeof prop === 'string' ? Number(prop) : NaN
      if (!isNaN(index) && index >= 0 && index < configs.length) {
        return resolveExpenseField(configs[index])
      }
      const arrayMethods = ['map', 'filter', 'forEach', 'find', 'some', 'every', 'reduce', 'flatMap', 'findIndex', 'includes', 'indexOf', 'slice', 'concat', 'join']
      if (typeof prop === 'string' && arrayMethods.includes(prop)) {
        return (...args: unknown[]) => {
          const resolved = configs.map(resolveExpenseField)
          return (resolved as any)[prop](...args)
        }
      }
      return (configs as any)[prop]
    },
  })
}

// Create a Proxy array for property types
function createReactivePropertyTypeArray(configs: PropertyTypeConfig[]): PropertyTypeOption[] {
  return new Proxy([] as PropertyTypeOption[], {
    get(_, prop: string | symbol) {
      if (prop === 'length') return configs.length
      if (prop === Symbol.iterator) {
        return function* () {
          for (const cfg of configs) yield resolvePropertyType(cfg)
        }
      }
      const index = typeof prop === 'string' ? Number(prop) : NaN
      if (!isNaN(index) && index >= 0 && index < configs.length) {
        return resolvePropertyType(configs[index])
      }
      const arrayMethods = ['map', 'filter', 'forEach', 'find', 'some', 'every', 'reduce', 'flatMap', 'findIndex', 'includes', 'indexOf', 'slice', 'concat', 'join']
      if (typeof prop === 'string' && arrayMethods.includes(prop)) {
        return (...args: unknown[]) => {
          const resolved = configs.map(resolvePropertyType)
          return (resolved as any)[prop](...args)
        }
      }
      return (configs as any)[prop]
    },
  })
}

// Reactive exports - labels resolve dynamically on each access
export const RENTAL_EXPENSE_FIELDS: RentalExpenseField[] = createReactiveExpenseArray(RENTAL_EXPENSE_CONFIGS)
export const PROPERTY_TYPES: PropertyTypeOption[] = createReactivePropertyTypeArray(PROPERTY_TYPE_CONFIGS)
