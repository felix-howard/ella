/**
 * Checklist tier constants for 3-tier priority grouping
 * Used in TieredChecklist component for visual hierarchy
 */

import i18n from './i18n'

const CHECKLIST_TIERS_DATA = {
  REQUIRED: {
    key: 'required',
    labelKey: 'checklistTier.required',
    color: 'text-red-500 dark:text-red-400',
    bgColor: 'bg-red-500/5 dark:bg-red-500/10',
    borderColor: 'border-red-500/20 dark:border-red-500/30',
    icon: '🔴',
  },
  APPLICABLE: {
    key: 'applicable',
    labelKey: 'checklistTier.applicable',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/5 dark:bg-amber-500/10',
    borderColor: 'border-amber-500/20 dark:border-amber-500/30',
    icon: '🟡',
  },
  OPTIONAL: {
    key: 'optional',
    labelKey: 'checklistTier.optional',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/5 dark:bg-emerald-500/10',
    borderColor: 'border-emerald-500/20 dark:border-emerald-500/30',
    icon: '🟢',
  },
} as const

export const CHECKLIST_TIERS = new Proxy({} as typeof CHECKLIST_TIERS_DATA, {
  get(_, prop: string) {
    const data = CHECKLIST_TIERS_DATA[prop as keyof typeof CHECKLIST_TIERS_DATA]
    if (!data) return undefined
    return {
      ...data,
      label: i18n.t(data.labelKey),
    }
  },
  ownKeys() {
    return Object.keys(CHECKLIST_TIERS_DATA)
  },
  getOwnPropertyDescriptor(_, prop: string) {
    if (prop in CHECKLIST_TIERS_DATA) {
      return { configurable: true, enumerable: true }
    }
  },
}) as typeof CHECKLIST_TIERS_DATA

export type ChecklistTierKey = keyof typeof CHECKLIST_TIERS

const CHECKLIST_STATUS_DISPLAY_DATA = {
  VERIFIED: { icon: '✓', labelKey: 'checklistStatusDisplay.verified', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10' },
  HAS_DIGITAL: { icon: '◉', labelKey: 'checklistStatusDisplay.hasDigital', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/10' },
  HAS_RAW: { icon: '○', labelKey: 'checklistStatusDisplay.hasRaw', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10' },
  MISSING: { icon: '✗', labelKey: 'checklistStatusDisplay.missing', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/10' },
  NOT_REQUIRED: { icon: '—', labelKey: 'checklistStatusDisplay.notRequired', color: 'text-muted-foreground', bgColor: 'bg-muted' },
} as const

type ChecklistStatusDisplayType = {
  [K in keyof typeof CHECKLIST_STATUS_DISPLAY_DATA]: {
    icon: string
    label: string
    color: string
    bgColor: string
  }
}

export const CHECKLIST_STATUS_DISPLAY = new Proxy({} as ChecklistStatusDisplayType, {
  get(_, prop: string) {
    const data = CHECKLIST_STATUS_DISPLAY_DATA[prop as keyof typeof CHECKLIST_STATUS_DISPLAY_DATA]
    if (!data) return undefined
    return {
      icon: data.icon,
      label: i18n.t(data.labelKey),
      color: data.color,
      bgColor: data.bgColor,
    }
  },
  ownKeys() {
    return Object.keys(CHECKLIST_STATUS_DISPLAY_DATA)
  },
  getOwnPropertyDescriptor(_, prop: string) {
    if (prop in CHECKLIST_STATUS_DISPLAY_DATA) {
      return { configurable: true, enumerable: true }
    }
  },
}) as ChecklistStatusDisplayType

/**
 * Category styles for category-based checklist grouping
 * Used in CategoryChecklist component for visual hierarchy by document category
 * All categories use consistent emerald color scheme for unified appearance
 */
export const CATEGORY_STYLES = {
  personal: { icon: 'User', color: 'text-emerald-600', bgColor: 'bg-transparent', borderColor: 'border-emerald-500/20' },
  income: { icon: 'Coins', color: 'text-emerald-600', bgColor: 'bg-transparent', borderColor: 'border-emerald-500/20' },
  deductions: { icon: 'FileText', color: 'text-emerald-600', bgColor: 'bg-transparent', borderColor: 'border-emerald-500/20' },
  business: { icon: 'Building2', color: 'text-emerald-600', bgColor: 'bg-transparent', borderColor: 'border-emerald-500/20' },
  other: { icon: 'Paperclip', color: 'text-emerald-600', bgColor: 'bg-transparent', borderColor: 'border-emerald-500/20' },
} as const

export type CategoryKey = keyof typeof CATEGORY_STYLES

/**
 * Simplified status display for category-based checklist
 * Consolidates 5 statuses into 3 visual states: MISSING (red), SUBMITTED (blue), VERIFIED (green)
 */
const SIMPLIFIED_STATUS_DISPLAY_DATA = {
  MISSING: { labelKey: 'checklistStatusDisplay.missing', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  SUBMITTED: { labelKey: 'checklistStatusDisplay.submitted', color: 'text-primary', bgColor: 'bg-primary-light' },
  VERIFIED: { labelKey: 'checklistStatusDisplay.verified', color: 'text-success', bgColor: 'bg-success/10' },
  NOT_REQUIRED: { labelKey: 'checklistStatusDisplay.notRequired', color: 'text-muted-foreground', bgColor: 'bg-muted' },
} as const

type SimplifiedStatusDisplayType = {
  [K in keyof typeof SIMPLIFIED_STATUS_DISPLAY_DATA]: {
    label: string
    color: string
    bgColor: string
  }
}

export const SIMPLIFIED_STATUS_DISPLAY = new Proxy({} as SimplifiedStatusDisplayType, {
  get(_, prop: string) {
    const data = SIMPLIFIED_STATUS_DISPLAY_DATA[prop as keyof typeof SIMPLIFIED_STATUS_DISPLAY_DATA]
    if (!data) return undefined
    return {
      label: i18n.t(data.labelKey),
      color: data.color,
      bgColor: data.bgColor,
    }
  },
  ownKeys() {
    return Object.keys(SIMPLIFIED_STATUS_DISPLAY_DATA)
  },
  getOwnPropertyDescriptor(_, prop: string) {
    if (prop in SIMPLIFIED_STATUS_DISPLAY_DATA) {
      return { configurable: true, enumerable: true }
    }
  },
}) as SimplifiedStatusDisplayType

/**
 * Border styles for document thumbnails based on DigitalDoc.status
 * Subtle visual indication - only verified gets colored border, others use muted border
 */
export const DOC_STATUS_BORDER_STYLES = {
  PENDING: 'border border-border',
  EXTRACTED: 'border border-border',
  VERIFIED: 'border border-emerald-500/50 dark:border-emerald-400/50',
  PARTIAL: 'border border-border',
  FAILED: 'border border-border',
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
