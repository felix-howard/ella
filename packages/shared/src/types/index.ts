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

// Action counts types for client list
export type { ActionCounts, ClientWithActions } from './action-counts'
