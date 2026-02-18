/**
 * i18n-powered labels and constants for Ella Workspace
 * Labels are dynamically translated based on current language
 */

import i18n from './i18n'

/**
 * Helper to create a translated label map using Proxy
 * Returns a proxy that calls i18n.t() when properties are accessed
 */
function translatedLabels(keyMap: Record<string, string>): Record<string, string> {
  return new Proxy({} as Record<string, string>, {
    get(_, prop: string) {
      return keyMap[prop] ? i18n.t(keyMap[prop]) : prop
    },
    has(_, prop: string) {
      return prop in keyMap
    },
    ownKeys() {
      return Object.keys(keyMap)
    },
    getOwnPropertyDescriptor(_, prop: string) {
      if (prop in keyMap) {
        return { configurable: true, enumerable: true, value: i18n.t(keyMap[prop]) }
      }
    },
  })
}

/**
 * Helper to create a nested translated object using Proxy
 * Handles deeply nested objects by recursively creating proxies
 */
function translatedNestedObject(keyMap: Record<string, any>): any {
  return new Proxy({} as any, {
    get(_, prop: string) {
      const value = keyMap[prop]
      if (!value) return undefined
      if (typeof value === 'string') {
        return i18n.t(value)
      }
      if (typeof value === 'object') {
        return translatedNestedObject(value)
      }
      return value
    },
    has(_, prop: string) {
      return prop in keyMap
    },
    ownKeys() {
      return Object.keys(keyMap)
    },
    getOwnPropertyDescriptor(_, prop: string) {
      if (prop in keyMap) {
        return { configurable: true, enumerable: true }
      }
    },
  })
}

// Translated labels for DocType
export const DOC_TYPE_LABELS: Record<string, string> = translatedLabels({
  SSN_CARD: 'docType.ssnCard',
  DRIVER_LICENSE: 'docType.driverLicense',
  PASSPORT: 'docType.passport',
  W2: 'docType.w2',
  FORM_1099_INT: 'docType.form1099Int',
  FORM_1099_DIV: 'docType.form1099Div',
  FORM_1099_NEC: 'docType.form1099Nec',
  FORM_1099_MISC: 'docType.form1099Misc',
  FORM_1099_K: 'docType.form1099K',
  FORM_1099_R: 'docType.form1099R',
  FORM_1099_G: 'docType.form1099G',
  FORM_1099_SSA: 'docType.form1099Ssa',
  BANK_STATEMENT: 'docType.bankStatement',
  PROFIT_LOSS_STATEMENT: 'docType.profitLossStatement',
  BUSINESS_LICENSE: 'docType.businessLicense',
  EIN_LETTER: 'docType.einLetter',
  FORM_1098: 'docType.form1098',
  FORM_1098_T: 'docType.form1098T',
  RECEIPT: 'docType.receipt',
  BIRTH_CERTIFICATE: 'docType.birthCertificate',
  DAYCARE_RECEIPT: 'docType.daycareReceipt',
  FORM_1040: 'docType.form1040',
  FORM_1040_SR: 'docType.form1040Sr',
  FORM_1040_NR: 'docType.form1040Nr',
  FORM_1040_X: 'docType.form1040X',
  STATE_TAX_RETURN: 'docType.stateTaxReturn',
  FOREIGN_TAX_RETURN: 'docType.foreignTaxReturn',
  TAX_RETURN_TRANSCRIPT: 'docType.taxReturnTranscript',
  OTHER: 'docType.other',
  UNKNOWN: 'docType.unknown',
})

// Document type categories for tree view organization
const DOC_TYPE_CATEGORIES_DATA: Record<string, { labelKey: string; docTypes: string[] }> = {
  personal: {
    labelKey: 'docCategory.personal',
    docTypes: ['SSN_CARD', 'DRIVER_LICENSE', 'PASSPORT', 'BIRTH_CERTIFICATE'],
  },
  income: {
    labelKey: 'docCategory.income',
    docTypes: ['W2', 'FORM_1099_INT', 'FORM_1099_DIV', 'FORM_1099_NEC', 'FORM_1099_MISC', 'FORM_1099_K', 'FORM_1099_R', 'FORM_1099_G', 'FORM_1099_SSA'],
  },
  deductions: {
    labelKey: 'docCategory.deductions',
    docTypes: ['FORM_1098', 'FORM_1098_T', 'RECEIPT', 'DAYCARE_RECEIPT'],
  },
  business: {
    labelKey: 'docCategory.business',
    docTypes: ['PROFIT_LOSS_STATEMENT', 'BUSINESS_LICENSE', 'EIN_LETTER', 'BANK_STATEMENT'],
  },
  other: {
    labelKey: 'docCategory.other',
    docTypes: ['OTHER', 'UNKNOWN'],
  },
}

export const DOC_TYPE_CATEGORIES: Record<string, { label: string; docTypes: string[] }> = new Proxy({} as Record<string, { label: string; docTypes: string[] }>, {
  get(_, prop: string) {
    const data = DOC_TYPE_CATEGORIES_DATA[prop]
    if (!data) return undefined
    return {
      label: i18n.t(data.labelKey),
      docTypes: data.docTypes,
    }
  },
  ownKeys() {
    return Object.keys(DOC_TYPE_CATEGORIES_DATA)
  },
  getOwnPropertyDescriptor(_, prop: string) {
    if (prop in DOC_TYPE_CATEGORIES_DATA) {
      return { configurable: true, enumerable: true }
    }
  },
})

// Translated labels for TaxCaseStatus
export const CASE_STATUS_LABELS: Record<string, string> = translatedLabels({
  INTAKE: 'caseStatus.intake',
  WAITING_DOCS: 'caseStatus.waitingDocs',
  IN_PROGRESS: 'caseStatus.inProgress',
  READY_FOR_ENTRY: 'caseStatus.readyForEntry',
  ENTRY_COMPLETE: 'caseStatus.entryComplete',
  REVIEW: 'caseStatus.review',
  FILED: 'caseStatus.filed',
})

// Status colors for UI
export const CASE_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  INTAKE: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
  WAITING_DOCS: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  IN_PROGRESS: { bg: 'bg-primary-light', text: 'text-primary', border: 'border-primary' },
  READY_FOR_ENTRY: { bg: 'bg-accent-light', text: 'text-accent', border: 'border-accent' },
  ENTRY_COMPLETE: { bg: 'bg-primary-light', text: 'text-primary-dark', border: 'border-primary-dark' },
  REVIEW: { bg: 'bg-orange-500/15', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/30' },
  FILED: { bg: 'bg-success/10', text: 'text-success', border: 'border-success' },
}

// Translated labels for ChecklistItemStatus
export const CHECKLIST_STATUS_LABELS: Record<string, string> = translatedLabels({
  MISSING: 'checklistStatus.missing',
  HAS_RAW: 'checklistStatus.hasRaw',
  HAS_DIGITAL: 'checklistStatus.hasDigital',
  VERIFIED: 'checklistStatus.verified',
  NOT_REQUIRED: 'checklistStatus.notRequired',
})

// Checklist status colors
export const CHECKLIST_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  MISSING: { bg: 'bg-error-light', text: 'text-error' },
  HAS_RAW: { bg: 'bg-warning-light', text: 'text-warning' },
  HAS_DIGITAL: { bg: 'bg-primary-light', text: 'text-primary' },
  VERIFIED: { bg: 'bg-success/10', text: 'text-success' },
  NOT_REQUIRED: { bg: 'bg-muted', text: 'text-muted-foreground' },
}

// Translated labels for ActionType
export const ACTION_TYPE_LABELS: Record<string, string> = translatedLabels({
  VERIFY_DOCS: 'actionType.verifyDocs',
  AI_FAILED: 'actionType.aiFailed',
  BLURRY_DETECTED: 'actionType.blurryDetected',
  READY_FOR_ENTRY: 'actionType.readyForEntry',
  REMINDER_DUE: 'actionType.reminderDue',
  CLIENT_REPLIED: 'actionType.clientReplied',
})

// Action type colors
export const ACTION_TYPE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  VERIFY_DOCS: { bg: 'bg-primary-light', text: 'text-primary', icon: 'CheckCircle' },
  AI_FAILED: { bg: 'bg-error-light', text: 'text-error', icon: 'AlertTriangle' },
  BLURRY_DETECTED: { bg: 'bg-warning-light', text: 'text-warning', icon: 'Eye' },
  READY_FOR_ENTRY: { bg: 'bg-accent-light', text: 'text-accent', icon: 'FileText' },
  REMINDER_DUE: { bg: 'bg-warning-light', text: 'text-warning', icon: 'Bell' },
  CLIENT_REPLIED: { bg: 'bg-success/10', text: 'text-success', icon: 'MessageCircle' },
}

// Translated labels for ActionPriority
export const ACTION_PRIORITY_LABELS: Record<string, string> = translatedLabels({
  URGENT: 'actionPriority.urgent',
  HIGH: 'actionPriority.high',
  NORMAL: 'actionPriority.normal',
  LOW: 'actionPriority.low',
})

// Priority colors
export const ACTION_PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  URGENT: { bg: 'bg-error', text: 'text-white' },
  HIGH: { bg: 'bg-accent', text: 'text-white' },
  NORMAL: { bg: 'bg-primary', text: 'text-white' },
  LOW: { bg: 'bg-muted', text: 'text-muted-foreground' },
}

// Translated labels for TaxType
export const TAX_TYPE_LABELS: Record<string, string> = translatedLabels({
  FORM_1040: 'taxType.form1040',
  FORM_1120S: 'taxType.form1120s',
  FORM_1065: 'taxType.form1065',
})

// Translated labels for Language
export const LANGUAGE_LABELS: Record<string, string> = translatedLabels({
  VI: 'language.vi',
  EN: 'language.en',
})

// Translated labels for FilingStatus
export const FILING_STATUS_LABELS: Record<string, string> = translatedLabels({
  SINGLE: 'filingStatus.single',
  MARRIED_FILING_JOINTLY: 'filingStatus.marriedFilingJointly',
  MARRIED_FILING_SEPARATELY: 'filingStatus.marriedFilingSeparately',
  HEAD_OF_HOUSEHOLD: 'filingStatus.headOfHousehold',
  QUALIFYING_WIDOW: 'filingStatus.qualifyingWidow',
})

// AI Classification thresholds
// Used for determining when documents need manual review
export const AI_CONFIDENCE_THRESHOLDS = {
  /** High confidence - auto-approve */
  HIGH: 0.85,
  /** Medium confidence - needs review */
  MEDIUM: 0.60,
} as const

// AI Classification confidence level config
// Used for confidence badges in image gallery and review workflow
const CONFIDENCE_LEVELS_DATA = {
  HIGH: { min: AI_CONFIDENCE_THRESHOLDS.HIGH, labelKey: 'confidenceLevel.high', color: 'text-success', bg: 'bg-success/10' },
  MEDIUM: { min: AI_CONFIDENCE_THRESHOLDS.MEDIUM, labelKey: 'confidenceLevel.medium', color: 'text-warning', bg: 'bg-warning/10' },
  LOW: { min: 0, labelKey: 'confidenceLevel.low', color: 'text-error', bg: 'bg-error/10' },
} as const

export const CONFIDENCE_LEVELS = new Proxy({} as typeof CONFIDENCE_LEVELS_DATA, {
  get(_, prop: string) {
    const data = CONFIDENCE_LEVELS_DATA[prop as keyof typeof CONFIDENCE_LEVELS_DATA]
    if (!data) return undefined
    return {
      ...data,
      label: i18n.t(data.labelKey),
    }
  },
  ownKeys() {
    return Object.keys(CONFIDENCE_LEVELS_DATA)
  },
  getOwnPropertyDescriptor(_, prop: string) {
    if (prop in CONFIDENCE_LEVELS_DATA) {
      return { configurable: true, enumerable: true }
    }
  },
}) as typeof CONFIDENCE_LEVELS_DATA

/**
 * Check if classification needs manual review based on confidence
 * @param confidence - Confidence score from 0-1
 * @returns true if confidence is below HIGH threshold
 */
export function needsClassificationReview(confidence: number | null): boolean {
  return !confidence || confidence < AI_CONFIDENCE_THRESHOLDS.HIGH
}

/**
 * Get confidence level based on score
 * @param confidence - Confidence score from 0-1
 * @returns Confidence level config (HIGH, MEDIUM, or LOW)
 */
export function getConfidenceLevel(confidence: number | null) {
  if (!confidence || confidence < AI_CONFIDENCE_THRESHOLDS.MEDIUM) return CONFIDENCE_LEVELS.LOW
  if (confidence < AI_CONFIDENCE_THRESHOLDS.HIGH) return CONFIDENCE_LEVELS.MEDIUM
  return CONFIDENCE_LEVELS.HIGH
}

// Sidebar navigation items
const NAV_ITEMS_DATA = [
  { path: '/', labelKey: 'nav.dashboard', icon: 'LayoutDashboard' },
  { path: '/clients', labelKey: 'nav.clients', icon: 'Users' },
  { path: '/messages', labelKey: 'nav.messages', icon: 'MessageSquare' },
  { path: '/settings', labelKey: 'nav.settings', icon: 'Settings' },
] as const

export const NAV_ITEMS = new Proxy([] as any, {
  get(_, prop: string | symbol) {
    if (prop === 'length') return NAV_ITEMS_DATA.length
    if (typeof prop === 'symbol' || prop === 'constructor') return (NAV_ITEMS_DATA as any)[prop]
    const index = Number(prop)
    if (!isNaN(index) && index >= 0 && index < NAV_ITEMS_DATA.length) {
      const item = NAV_ITEMS_DATA[index]
      return { ...item, label: i18n.t(item.labelKey) }
    }
    return (NAV_ITEMS_DATA as any)[prop]
  },
  ownKeys() {
    return Object.keys(NAV_ITEMS_DATA)
  },
}) as readonly { path: string; label: string; icon: string }[]

/** Action badge labels for client list action indicators */
export const ACTION_BADGE_LABELS = translatedLabels({
  missing: 'actionBadge.missing',
  verify: 'actionBadge.verify',
  entry: 'actionBadge.entry',
  stale: 'actionBadge.stale',
  ready: 'actionBadge.ready',
  'new-activity': 'actionBadge.newActivity',
})

/** Action badge ARIA labels for accessibility */
export const ACTION_BADGE_ARIA_LABELS = translatedLabels({
  missing: 'actionBadgeAria.missing',
  verify: 'actionBadgeAria.verify',
  entry: 'actionBadgeAria.entry',
  stale: 'actionBadgeAria.stale',
  ready: 'actionBadgeAria.ready',
  'new-activity': 'actionBadgeAria.newActivity',
})

/** Time format strings for localization */
export const TIME_FORMATS = {
  /** Days abbreviation (e.g., "7d" for 7 days) */
  daysShort: (days: number) => `${days}d`,
  /** Days full with translation */
  daysFull: (days: number) => i18n.t('timeFormat.daysFull', { days }),
} as const

/** Stale threshold for activity tracking (days without activity) */
export const STALE_THRESHOLD_DAYS = 7 as const

// Sort options for client list
const CLIENT_SORT_OPTIONS_DATA = [
  { value: 'activity' as const, labelKey: 'clientSort.activity' },
  { value: 'stale' as const, labelKey: 'clientSort.stale' },
  { value: 'name' as const, labelKey: 'clientSort.name' },
] as const

export type ClientSortOption = typeof CLIENT_SORT_OPTIONS_DATA[number]['value']

export const CLIENT_SORT_OPTIONS = new Proxy([] as any, {
  get(_, prop: string | symbol) {
    if (prop === 'length') return CLIENT_SORT_OPTIONS_DATA.length
    if (typeof prop === 'symbol' || prop === 'constructor') return (CLIENT_SORT_OPTIONS_DATA as any)[prop]
    const index = Number(prop)
    if (!isNaN(index) && index >= 0 && index < CLIENT_SORT_OPTIONS_DATA.length) {
      const item = CLIENT_SORT_OPTIONS_DATA[index]
      return { value: item.value, label: i18n.t(item.labelKey) }
    }
    return (CLIENT_SORT_OPTIONS_DATA as any)[prop]
  },
  ownKeys() {
    return Object.keys(CLIENT_SORT_OPTIONS_DATA)
  },
}) as readonly { value: ClientSortOption; label: string }[]

// Common UI text - i18n powered
const UI_TEXT_KEYS = {
  // General
  loading: 'common.loading',
  error: 'common.error',
  retry: 'common.retry',
  save: 'common.save',
  cancel: 'common.cancel',
  delete: 'common.delete',
  edit: 'common.edit',
  create: 'common.create',
  search: 'common.search',
  noData: 'common.noData',
  confirm: 'common.confirm',
  logout: 'common.logout',
  notifications: 'common.notifications',
  addClient: 'common.addClient',

  // Dashboard
  dashboard: {
    greeting: 'dashboard.greeting',
    greetingSubtext: 'dashboard.greetingSubtext',
    todaySummary: 'dashboard.todaySummary',
    pendingActions: 'dashboard.pendingActions',
    newClients: 'dashboard.newClients',
    docsReceived: 'dashboard.docsReceived',
    blurryDocs: 'dashboard.blurryDocs',
    quickActions: 'dashboard.quickActions',
    recentActivity: 'dashboard.recentActivity',
    noRecentActivity: 'dashboard.noRecentActivity',
  },

  // Quick Actions
  quickAction: {
    addClient: 'quickAction.addClient',
    viewActions: 'quickAction.viewActions',
    verifyDocs: 'quickAction.verifyDocs',
    handleBlurry: 'quickAction.handleBlurry',
  },

  // Clients
  clients: {
    title: 'clients.title',
    newClient: 'clients.newClient',
    noClients: 'clients.noClients',
    noClientsHint: 'clients.noClientsHint',
    noCase: 'clients.noCase',
    searchPlaceholder: 'clients.searchPlaceholder',
    viewKanban: 'clients.viewKanban',
    viewList: 'clients.viewList',
    backToList: 'clients.backToList',
    count: 'clients.count',
    personalInfo: 'clients.personalInfo',
    taxProfile: 'clients.taxProfile',
    checklistTitle: 'clients.checklistTitle',
    tabs: {
      overview: 'clientsTabs.overview',
      documents: 'clientsTabs.documents',
      messages: 'clientsTabs.messages',
    },
  },

  // Kanban
  kanban: {
    noClients: 'kanban.noClients',
  },

  // Actions
  actions: {
    title: 'actions.title',
    noActions: 'actions.noActions',
    markComplete: 'actions.markComplete',
    complete: 'actions.complete',
    viewDetail: 'actions.viewDetail',
    refresh: 'actions.refresh',
    filterBy: 'actions.filterBy',
    typeFilter: 'actions.typeFilter',
    priorityFilter: 'actions.priorityFilter',
    all: 'actions.all',
    allDone: 'actions.allDone',
    pendingCount: 'actions.pendingCount',
  },

  // Forms
  form: {
    clientName: 'form.clientName',
    phone: 'form.phone',
    email: 'form.email',
    language: 'form.language',
    taxYear: 'form.taxYear',
    taxTypes: 'form.taxTypes',
    filingStatus: 'form.filingStatus',
    required: 'form.required',
  },

  // Error boundary
  errorBoundary: {
    title: 'errorBoundary.title',
    message: 'errorBoundary.message',
    retry: 'errorBoundary.retry',
  },

  // Staff info (placeholder)
  staff: {
    defaultName: 'staff.defaultName',
    defaultEmail: 'staff.defaultEmail',
  },

  // Settings
  settings: {
    title: 'settings.title',
    appearance: 'settings.appearance',
    theme: 'settings.theme',
    lightMode: 'settings.lightMode',
    darkMode: 'settings.darkMode',
  },
}

export const UI_TEXT = translatedNestedObject(UI_TEXT_KEYS)
