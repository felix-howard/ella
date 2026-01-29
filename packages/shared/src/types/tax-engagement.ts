/**
 * TaxEngagement types for multi-year client support
 * Represents a client's tax filing profile for a specific year
 */

// Engagement status enum (mirrors Prisma EngagementStatus)
export type EngagementStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETE' | 'ARCHIVED'

/**
 * Full TaxEngagement type with all fields
 * Used in detail views and API responses
 */
export interface TaxEngagement {
  id: string
  clientId: string
  taxYear: number
  status: EngagementStatus

  // Profile fields (year-specific)
  filingStatus: string | null
  hasW2: boolean
  hasBankAccount: boolean
  hasInvestments: boolean
  hasKidsUnder17: boolean
  numKidsUnder17: number
  paysDaycare: boolean
  hasKids17to24: boolean
  hasSelfEmployment: boolean
  hasRentalProperty: boolean
  businessName: string | null
  ein: string | null
  hasEmployees: boolean
  hasContractors: boolean
  has1099K: boolean
  intakeAnswers: Record<string, unknown>

  // Timestamps
  createdAt: string
  updatedAt: string

  // Optional relations (included in some responses)
  client?: {
    id: string
    name: string
    phone: string
  }
  _count?: {
    taxCases: number
  }
}

/**
 * TaxEngagement summary for list views
 * Lighter version with only essential fields
 */
export interface TaxEngagementSummary {
  id: string
  clientId: string
  taxYear: number
  status: EngagementStatus
  filingStatus: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    taxCases: number
  }
}
