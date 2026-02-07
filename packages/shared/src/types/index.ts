import type { z } from 'zod'
import type { paginationSchema } from '../schemas'

// Infer types from schemas
export type Pagination = z.infer<typeof paginationSchema>

// Intake Answers type for ClientProfile.intakeAnswers JSON field
export type { IntakeAnswers } from './intake-answers'
export { isIntakeAnswers, parseIntakeAnswers, validateIntakeAnswers } from './intake-answers'

// Condition types for checklist template evaluation
export type {
  ComparisonOperator,
  SimpleCondition,
  CompoundCondition,
  LegacyCondition,
  Condition,
} from './condition'
export {
  isSimpleCondition,
  isCompoundCondition,
  isLegacyCondition,
  isValidOperator,
  parseCondition,
} from './condition'

// Common utility types
export type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: string
}

// Placeholder types - expand as needed
export type UserId = string
export type ClientId = string
export type DocumentId = string
export type EngagementId = string

// Action counts types for client list
export type { ActionCounts, ClientWithActions } from './action-counts'

// TaxEngagement types for multi-year client support
export type { TaxEngagement, EngagementStatus, TaxEngagementSummary } from './tax-engagement'

// Document category mapping utility
export type { DocCategory, DocType } from './doc-category'
export {
  DOC_TYPE_TO_CATEGORY,
  getCategoryFromDocType,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from './doc-category'

// Schedule E rental property types
export type {
  ScheduleEPropertyAddress,
  ScheduleEOtherExpense,
  ScheduleEPropertyType,
  ScheduleEPropertyId,
  ScheduleEProperty,
  ScheduleEVersionHistoryEntry,
  ScheduleETotals,
  ScheduleEStatus,
} from './schedule-e'
export {
  createEmptyProperty,
  PROPERTY_TYPE_LABELS,
} from './schedule-e'
