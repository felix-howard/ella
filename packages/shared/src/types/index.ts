import type { z } from 'zod'
import type { paginationSchema } from '../schemas'

// Infer types from schemas
export type Pagination = z.infer<typeof paginationSchema>

// Intake Answers type for ClientProfile.intakeAnswers JSON field
export type { IntakeAnswers } from './intake-answers'
export { isIntakeAnswers, parseIntakeAnswers, validateIntakeAnswers } from './intake-answers'

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
