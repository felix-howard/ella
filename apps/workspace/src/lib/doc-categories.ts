/**
 * Document categories for Files Tab
 * 7 categories matching DocCategory enum from database
 */

import {
  User,
  DollarSign,
  Receipt,
  Home,
  GraduationCap,
  Heart,
  File,
  FileText,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import i18n from './i18n'

export type DocCategoryKey = 'IDENTITY' | 'INCOME' | 'TAX_RETURNS' | 'EXPENSE' | 'ASSET' | 'EDUCATION' | 'HEALTHCARE' | 'OTHER'

export interface DocCategoryConfig {
  label: string
  icon: LucideIcon
  bgColor: string
  textColor: string
  borderColor: string
}

const DOC_CATEGORIES_DATA: Record<DocCategoryKey, { labelKey: string; icon: LucideIcon; bgColor: string; textColor: string; borderColor: string }> = {
  IDENTITY: {
    labelKey: 'docCategory.identity',
    icon: User,
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-600',
    borderColor: 'border-purple-500/20',
  },
  INCOME: {
    labelKey: 'docCategory.income',
    icon: DollarSign,
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-500/20',
  },
  TAX_RETURNS: {
    labelKey: 'docCategory.taxReturns',
    icon: FileText,
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-500/20',
  },
  EXPENSE: {
    labelKey: 'docCategory.expense',
    icon: Receipt,
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-500/20',
  },
  ASSET: {
    labelKey: 'docCategory.asset',
    icon: Home,
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-500/20',
  },
  EDUCATION: {
    labelKey: 'docCategory.education',
    icon: GraduationCap,
    bgColor: 'bg-indigo-500/10',
    textColor: 'text-indigo-600',
    borderColor: 'border-indigo-500/20',
  },
  HEALTHCARE: {
    labelKey: 'docCategory.healthcare',
    icon: Heart,
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-600',
    borderColor: 'border-red-500/20',
  },
  OTHER: {
    labelKey: 'docCategory.other',
    icon: File,
    bgColor: 'bg-gray-500/10',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-500/20',
  },
}

export const DOC_CATEGORIES: Record<DocCategoryKey, DocCategoryConfig> = new Proxy({} as Record<DocCategoryKey, DocCategoryConfig>, {
  get(_, prop: string) {
    const data = DOC_CATEGORIES_DATA[prop as DocCategoryKey]
    if (!data) return undefined
    return {
      label: i18n.t(data.labelKey),
      icon: data.icon,
      bgColor: data.bgColor,
      textColor: data.textColor,
      borderColor: data.borderColor,
    }
  },
  has(_, prop: string) {
    return prop in DOC_CATEGORIES_DATA
  },
  ownKeys() {
    return Object.keys(DOC_CATEGORIES_DATA)
  },
  getOwnPropertyDescriptor(_, prop: string) {
    if (prop in DOC_CATEGORIES_DATA) {
      return { configurable: true, enumerable: true }
    }
  },
})

// Category display order
export const CATEGORY_ORDER: DocCategoryKey[] = [
  'IDENTITY',
  'INCOME',
  'TAX_RETURNS',
  'EXPENSE',
  'ASSET',
  'EDUCATION',
  'HEALTHCARE',
  'OTHER',
]

/**
 * Get category config by key
 */
export function getCategory(key: DocCategoryKey): DocCategoryConfig {
  return DOC_CATEGORIES[key]
}

/**
 * Check if a value is a valid DocCategoryKey
 * Used for runtime validation of DB category values
 */
export function isValidCategory(value: string | null | undefined): value is DocCategoryKey {
  if (!value) return false
  return value in DOC_CATEGORIES_DATA
}
