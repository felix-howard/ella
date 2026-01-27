/**
 * Document categories for Files Tab
 * Groups DocTypes into user-friendly categories with Vietnamese labels
 */

import { User, Briefcase, Building, TrendingUp, Calendar, Receipt, Store, File } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface DocCategory {
  labelVi: string
  labelEn: string
  icon: LucideIcon
  docTypes: readonly string[]
}

/**
 * Document categories with Vietnamese labels
 * Used for grouping files in Files Tab
 */
export const DOC_CATEGORIES = {
  personal: {
    labelVi: 'Giấy tờ cá nhân',
    labelEn: 'Personal Documents',
    icon: User,
    docTypes: ['SSN_CARD', 'DRIVER_LICENSE', 'PASSPORT', 'BIRTH_CERTIFICATE', 'ITIN_LETTER'],
  },
  employment_income: {
    labelVi: 'Thu nhập từ việc làm',
    labelEn: 'Employment Income',
    icon: Briefcase,
    docTypes: ['W2', 'W2G'],
  },
  self_employment: {
    labelVi: 'Thu nhập tự do',
    labelEn: 'Self-Employment Income',
    icon: Building,
    docTypes: ['FORM_1099_NEC', 'FORM_1099_MISC', 'FORM_1099_K'],
  },
  investment_income: {
    labelVi: 'Thu nhập đầu tư',
    labelEn: 'Investment Income',
    icon: TrendingUp,
    docTypes: ['FORM_1099_INT', 'FORM_1099_DIV', 'FORM_1099_B', 'SCHEDULE_K1', 'SCHEDULE_K1_1065', 'SCHEDULE_K1_1120S'],
  },
  retirement: {
    labelVi: 'Hưu trí',
    labelEn: 'Retirement',
    icon: Calendar,
    docTypes: ['FORM_1099_R', 'FORM_1099_SSA', 'FORM_1099_G'],
  },
  deductions: {
    labelVi: 'Khấu trừ',
    labelEn: 'Deductions',
    icon: Receipt,
    docTypes: ['FORM_1098', 'FORM_1098_T', 'FORM_1098_E', 'DAYCARE_RECEIPT', 'CHARITY_RECEIPT', 'MEDICAL_RECEIPT', 'RECEIPT'],
  },
  business: {
    labelVi: 'Kinh doanh',
    labelEn: 'Business Documents',
    icon: Store,
    docTypes: ['BANK_STATEMENT', 'PROFIT_LOSS_STATEMENT', 'EIN_LETTER', 'BUSINESS_LICENSE'],
  },
  other: {
    labelVi: 'Khác',
    labelEn: 'Other',
    icon: File,
    docTypes: ['OTHER', 'UNKNOWN'],
  },
} as const satisfies Record<string, DocCategory>

export type DocCategoryKey = keyof typeof DOC_CATEGORIES

/**
 * Get category key for a given DocType
 * Returns 'other' if type not found in any category
 */
export function getCategoryForDocType(docType: string | null): DocCategoryKey {
  if (!docType) return 'other'

  for (const [categoryKey, config] of Object.entries(DOC_CATEGORIES)) {
    if ((config.docTypes as readonly string[]).includes(docType)) {
      return categoryKey as DocCategoryKey
    }
  }
  return 'other'
}

/**
 * Get category config by key
 */
export function getCategory(key: DocCategoryKey): DocCategory {
  return DOC_CATEGORIES[key]
}
