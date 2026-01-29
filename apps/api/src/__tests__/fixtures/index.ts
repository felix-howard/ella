/**
 * Shared Test Fixtures
 * Centralized mock data helpers for consistent test data across all test files
 *
 * Usage:
 * import { FIXTURES, mockClient, mockEngagement, mockTaxCase } from '../../__tests__/fixtures'
 */

// Common IDs for consistent referencing
export const FIXTURES = {
  CLIENT_ID: 'cm123456789012345678901234',
  ENGAGEMENT_ID: 'cm098765432109876543210987',
  CASE_ID: 'cmcase12345678901234567890',
  PROFILE_ID: 'cmprof12345678901234567890',
} as const

/**
 * Create mock client with optional overrides
 */
export function mockClient(overrides: Record<string, unknown> = {}) {
  return {
    id: FIXTURES.CLIENT_ID,
    name: 'Test Client',
    phone: '+14155551234',
    email: 'test@example.com',
    language: 'VI',
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
    ...overrides,
  }
}

/**
 * Create mock client with profile (for routes that include profile)
 */
export function mockClientWithProfile(overrides: Record<string, unknown> = {}) {
  const client = mockClient(overrides)
  return {
    ...client,
    profile: {
      id: FIXTURES.PROFILE_ID,
      clientId: client.id,
      filingStatus: 'SINGLE',
      hasW2: true,
      hasBankAccount: false,
      hasInvestments: false,
      hasKidsUnder17: false,
      numKidsUnder17: 0,
      paysDaycare: false,
      hasKids17to24: false,
      hasSelfEmployment: false,
      hasRentalProperty: false,
      businessName: null,
      ein: null,
      hasEmployees: false,
      hasContractors: false,
      has1099K: false,
      intakeAnswers: {},
      createdAt: new Date('2025-01-01T10:00:00Z'),
      updatedAt: new Date('2025-01-01T10:00:00Z'),
      ...(overrides.profile || {}),
    },
    taxCases: overrides.taxCases || [],
  }
}

/**
 * Create mock TaxEngagement with optional overrides
 */
export function mockEngagement(overrides: Record<string, unknown> = {}) {
  return {
    id: FIXTURES.ENGAGEMENT_ID,
    clientId: FIXTURES.CLIENT_ID,
    taxYear: 2025,
    status: 'DRAFT',
    filingStatus: 'SINGLE',
    hasW2: true,
    hasBankAccount: false,
    hasInvestments: false,
    hasKidsUnder17: false,
    numKidsUnder17: 0,
    paysDaycare: false,
    hasKids17to24: false,
    hasSelfEmployment: false,
    hasRentalProperty: false,
    businessName: null,
    ein: null,
    hasEmployees: false,
    hasContractors: false,
    has1099K: false,
    intakeAnswers: {},
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
    ...overrides,
  }
}

/**
 * Create mock TaxCase with optional overrides
 */
export function mockTaxCase(overrides: Record<string, unknown> = {}) {
  return {
    id: FIXTURES.CASE_ID,
    clientId: FIXTURES.CLIENT_ID,
    engagementId: FIXTURES.ENGAGEMENT_ID,
    taxYear: 2025,
    taxTypes: ['FORM_1040'],
    status: 'INTAKE',
    isInReview: false,
    isFiled: false,
    lastActivityAt: null,
    entryCompletedAt: null,
    filedAt: null,
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
    ...overrides,
  }
}

/**
 * Create mock engagement with client (for routes that include client relation)
 */
export function mockEngagementWithClient(overrides: Record<string, unknown> = {}) {
  const engagement = mockEngagement(overrides)
  const clientOverrides = overrides.client || {}
  return {
    ...engagement,
    client: {
      id: engagement.clientId,
      name: 'Test Client',
      phone: '+14155551234',
      ...(clientOverrides as Record<string, unknown>),
    },
  }
}

/**
 * Create mock engagement with tax cases count
 */
export function mockEngagementWithCount(overrides: Record<string, unknown> = {}) {
  const engagement = mockEngagement(overrides)
  const caseCount = typeof overrides._count === 'object'
    ? (overrides._count as { taxCases: number }).taxCases
    : 0
  return {
    ...engagement,
    _count: { taxCases: caseCount },
  }
}

/**
 * Create mock tax case with engagement (for routes that include engagement relation)
 */
export function mockTaxCaseWithEngagement(overrides: Record<string, unknown> = {}) {
  const taxCase = mockTaxCase(overrides)
  const engagementOverrides = overrides.engagement || {}
  return {
    ...taxCase,
    engagement: mockEngagement(engagementOverrides as Record<string, unknown>),
  }
}

// Type exports for TypeScript users
export type MockClient = ReturnType<typeof mockClient>
export type MockEngagement = ReturnType<typeof mockEngagement>
export type MockTaxCase = ReturnType<typeof mockTaxCase>
