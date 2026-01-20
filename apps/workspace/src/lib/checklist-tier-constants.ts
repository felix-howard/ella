/**
 * Checklist tier constants for 3-tier priority grouping
 * Used in TieredChecklist component for visual hierarchy
 */

export const CHECKLIST_TIERS = {
  REQUIRED: {
    key: 'required',
    labelVi: 'BẮT BUỘC',
    labelEn: 'Required',
    color: 'text-red-500 dark:text-red-400',
    bgColor: 'bg-red-500/5 dark:bg-red-500/10',
    borderColor: 'border-red-500/20 dark:border-red-500/30',
    icon: '🔴',
  },
  APPLICABLE: {
    key: 'applicable',
    labelVi: 'THEO TÌNH HUỐNG',
    labelEn: 'Based on your answers',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/5 dark:bg-amber-500/10',
    borderColor: 'border-amber-500/20 dark:border-amber-500/30',
    icon: '🟡',
  },
  OPTIONAL: {
    key: 'optional',
    labelVi: 'CÓ THỂ CẦN',
    labelEn: 'Optional',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/5 dark:bg-emerald-500/10',
    borderColor: 'border-emerald-500/20 dark:border-emerald-500/30',
    icon: '🟢',
  },
} as const

export type ChecklistTierKey = keyof typeof CHECKLIST_TIERS

export const CHECKLIST_STATUS_DISPLAY = {
  VERIFIED: { icon: '✓', labelVi: 'Đã xác minh', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10' },
  HAS_DIGITAL: { icon: '◉', labelVi: 'Đã trích xuất', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/10' },
  HAS_RAW: { icon: '○', labelVi: 'Đã nhận ảnh', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10' },
  MISSING: { icon: '✗', labelVi: 'Chưa có', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/10' },
  NOT_REQUIRED: { icon: '—', labelVi: 'Không cần', color: 'text-muted-foreground', bgColor: 'bg-muted' },
} as const
