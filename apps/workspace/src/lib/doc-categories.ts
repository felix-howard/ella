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
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type DocCategoryKey = 'IDENTITY' | 'INCOME' | 'EXPENSE' | 'ASSET' | 'EDUCATION' | 'HEALTHCARE' | 'OTHER'

export interface DocCategoryConfig {
  labelVi: string
  labelEn: string
  icon: LucideIcon
  bgColor: string
  textColor: string
  borderColor: string
}

export const DOC_CATEGORIES: Record<DocCategoryKey, DocCategoryConfig> = {
  IDENTITY: {
    labelVi: 'Giấy tờ tùy thân',
    labelEn: 'Identity Documents',
    icon: User,
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-600',
    borderColor: 'border-purple-500/20',
  },
  INCOME: {
    labelVi: 'Thu nhập',
    labelEn: 'Income',
    icon: DollarSign,
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-500/20',
  },
  EXPENSE: {
    labelVi: 'Chi phí',
    labelEn: 'Expenses',
    icon: Receipt,
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-500/20',
  },
  ASSET: {
    labelVi: 'Tài sản',
    labelEn: 'Assets',
    icon: Home,
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-500/20',
  },
  EDUCATION: {
    labelVi: 'Giáo dục',
    labelEn: 'Education',
    icon: GraduationCap,
    bgColor: 'bg-indigo-500/10',
    textColor: 'text-indigo-600',
    borderColor: 'border-indigo-500/20',
  },
  HEALTHCARE: {
    labelVi: 'Y tế',
    labelEn: 'Healthcare',
    icon: Heart,
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-600',
    borderColor: 'border-red-500/20',
  },
  OTHER: {
    labelVi: 'Khác',
    labelEn: 'Other',
    icon: File,
    bgColor: 'bg-gray-500/10',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-500/20',
  },
}

// Category display order
export const CATEGORY_ORDER: DocCategoryKey[] = [
  'IDENTITY',
  'INCOME',
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
  return value in DOC_CATEGORIES
}
