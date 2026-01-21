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

/**
 * Category styles for category-based checklist grouping
 * Used in CategoryChecklist component for visual hierarchy by document category
 * All categories use consistent emerald color scheme for unified appearance
 */
export const CATEGORY_STYLES = {
  personal: { icon: '👤', color: 'text-emerald-600', bgColor: 'bg-emerald-500/5', borderColor: 'border-emerald-500/20' },
  income: { icon: '💰', color: 'text-emerald-600', bgColor: 'bg-emerald-500/5', borderColor: 'border-emerald-500/20' },
  deductions: { icon: '📝', color: 'text-emerald-600', bgColor: 'bg-emerald-500/5', borderColor: 'border-emerald-500/20' },
  business: { icon: '🏢', color: 'text-emerald-600', bgColor: 'bg-emerald-500/5', borderColor: 'border-emerald-500/20' },
  other: { icon: '📎', color: 'text-emerald-600', bgColor: 'bg-emerald-500/5', borderColor: 'border-emerald-500/20' },
} as const

export type CategoryKey = keyof typeof CATEGORY_STYLES

/**
 * Simplified status display for category-based checklist
 * Consolidates 5 statuses into 3 visual states: MISSING (red), SUBMITTED (blue), VERIFIED (green)
 */
export const SIMPLIFIED_STATUS_DISPLAY = {
  MISSING: { labelVi: 'Thiếu', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  SUBMITTED: { labelVi: 'Đã nộp', color: 'text-primary', bgColor: 'bg-primary-light' },
  VERIFIED: { labelVi: 'Đã xác minh', color: 'text-success', bgColor: 'bg-success/10' },
  NOT_REQUIRED: { labelVi: 'Không cần', color: 'text-muted-foreground', bgColor: 'bg-muted' },
} as const

/**
 * Border styles for document thumbnails based on DigitalDoc.status
 * Used to visually indicate verification status at a glance
 * Uses border-2 (2px) for clear visual differentiation without being too heavy
 * Note: hover:border-primary/50 removed to preserve status indication on hover
 */
export const DOC_STATUS_BORDER_STYLES = {
  PENDING: 'border-2 border-dashed border-gray-400 dark:border-gray-500',
  EXTRACTED: 'border-2 border-amber-500 dark:border-amber-400',
  VERIFIED: 'border-2 border-emerald-500 dark:border-emerald-400',
  // PARTIAL = extraction partially successful (some fields extracted)
  PARTIAL: 'border-2 border-red-500 dark:border-red-400',
  FAILED: 'border-2 border-red-500 dark:border-red-400',
} as const

export type DocStatusKey = keyof typeof DOC_STATUS_BORDER_STYLES

/**
 * Badge styles for verification progress display
 * Used when checklist item has multiple documents (>1)
 * Colors: ALL=green (complete), PARTIAL=amber (in progress), NONE=gray (not started)
 */
export const VERIFICATION_PROGRESS_STYLES = {
  ALL: { bgColor: 'bg-emerald-500/10', textColor: 'text-emerald-600 dark:text-emerald-400' },
  PARTIAL: { bgColor: 'bg-amber-500/10', textColor: 'text-amber-600 dark:text-amber-400' },
  NONE: { bgColor: 'bg-gray-500/10', textColor: 'text-gray-600 dark:text-gray-400' },
} as const
