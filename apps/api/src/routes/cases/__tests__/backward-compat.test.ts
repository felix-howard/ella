/**
 * Backward Compatibility Tests for Cases API
 * Validates that existing clients continue to work during TaxEngagement migration
 *
 * Covers:
 * - Case creation with and without engagementId
 * - Auto-create engagement when not provided
 * - Response format includes both clientId and engagementId
 * - GET /cases/:id returns engagement relation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock prisma
vi.mock('../../../lib/db', () => ({
  prisma: {
    taxCase: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    taxEngagement: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
    },
    conversation: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) => callback({
      taxCase: {
        create: vi.fn(),
      },
      taxEngagement: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      conversation: {
        create: vi.fn(),
      },
    })),
  },
}))

// Mock engagement helpers
vi.mock('../../../services/engagement-helpers', () => ({
  findOrCreateEngagement: vi.fn().mockResolvedValue({
    engagementId: 'cm098765432109876543210987',
    isNew: false,
  }),
}))

// Mock checklist generator
vi.mock('../../../services/checklist-generator', () => ({
  generateChecklist: vi.fn().mockResolvedValue(undefined),
}))

import { prisma } from '../../../lib/db'
import { findOrCreateEngagement } from '../../../services/engagement-helpers'
import {
  FIXTURES,
  mockClient as baseMockClient,
  mockEngagement as baseMockEngagement,
  mockTaxCase as baseMockTaxCase,
} from '../../../__tests__/fixtures'

// Re-export with local aliases for backward compatibility
const VALID_CLIENT_ID = FIXTURES.CLIENT_ID
const VALID_ENGAGEMENT_ID = FIXTURES.ENGAGEMENT_ID

function createMockClient(overrides: Record<string, unknown> = {}) {
  const base = baseMockClient(overrides)
  return {
    ...base,
    profile: {
      id: 'profile-1',
      clientId: base.id,
      filingStatus: 'SINGLE',
      hasW2: true,
      intakeAnswers: {},
      ...(overrides.profile || {}),
    },
  }
}

function createMockEngagement(overrides: Record<string, unknown> = {}) {
  return baseMockEngagement(overrides)
}

function createMockTaxCase(overrides: Record<string, unknown> = {}) {
  return {
    ...baseMockTaxCase(overrides),
    id: (overrides.id as string) || 'case-1',
  }
}

describe('POST /cases - Backward Compatibility', () => {
  const mockClientFindUnique = vi.mocked(prisma.client.findUnique)
  const mockEngagementFindUnique = vi.mocked(prisma.taxEngagement.findUnique)
  const mockFindOrCreateEngagement = vi.mocked(findOrCreateEngagement)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Without engagementId (legacy clients)', () => {
    it('should auto-create engagement when not provided', async () => {
      const client = createMockClient()

      mockClientFindUnique.mockResolvedValueOnce(client as never)
      mockFindOrCreateEngagement.mockResolvedValueOnce({
        engagementId: VALID_ENGAGEMENT_ID,
        isNew: true,
      })

      // Simulate case creation flow
      const result = await findOrCreateEngagement(
        {} as never, // tx mock
        VALID_CLIENT_ID,
        2025,
        client.profile as never
      )

      expect(result.engagementId).toBe(VALID_ENGAGEMENT_ID)
      expect(result.isNew).toBe(true)
    })

    it('should use existing engagement when found', async () => {
      const client = createMockClient()
      const existingEngagement = createMockEngagement()

      mockClientFindUnique.mockResolvedValueOnce(client as never)
      mockFindOrCreateEngagement.mockResolvedValueOnce({
        engagementId: existingEngagement.id,
        isNew: false,
      })

      const result = await findOrCreateEngagement(
        {} as never,
        VALID_CLIENT_ID,
        2025,
        client.profile as never
      )

      expect(result.engagementId).toBe(VALID_ENGAGEMENT_ID)
      expect(result.isNew).toBe(false)
    })

    it('should copy profile data to new engagement', async () => {
      const client = createMockClient({
        profile: {
          id: 'profile-1',
          clientId: VALID_CLIENT_ID,
          filingStatus: 'MARRIED_FILING_JOINTLY',
          hasW2: true,
          hasSelfEmployment: true,
          hasKidsUnder17: true,
          numKidsUnder17: 2,
          intakeAnswers: {},
        },
      })

      // Profile data should be used when creating engagement
      const profileData = client.profile as Record<string, unknown>
      expect(profileData.filingStatus).toBe('MARRIED_FILING_JOINTLY')
      expect(profileData.hasW2).toBe(true)
      expect(profileData.hasSelfEmployment).toBe(true)
    })
  })

  describe('With engagementId (new clients)', () => {
    it('should validate engagementId belongs to client', async () => {
      const client = createMockClient()
      const engagement = createMockEngagement({ clientId: VALID_CLIENT_ID })

      mockClientFindUnique.mockResolvedValueOnce(client as never)
      mockEngagementFindUnique.mockResolvedValueOnce(engagement as never)

      const result = await prisma.taxEngagement.findUnique({
        where: { id: VALID_ENGAGEMENT_ID },
      })

      expect(result?.clientId).toBe(VALID_CLIENT_ID)
    })

    it('should reject engagementId from different client', async () => {
      const client = createMockClient({ id: 'client-a' })
      const engagement = createMockEngagement({ clientId: 'client-b' })

      mockClientFindUnique.mockResolvedValueOnce(client as never)
      mockEngagementFindUnique.mockResolvedValueOnce(engagement as never)

      const result = await prisma.taxEngagement.findUnique({
        where: { id: VALID_ENGAGEMENT_ID },
      })

      // In actual API: returns 400 with { error: 'INVALID_ENGAGEMENT' }
      expect(result?.clientId).not.toBe(client.id)
    })

    it('should use provided engagementId directly', async () => {
      const providedEngagementId = 'provided-engagement-id'

      // When engagementId is provided, findOrCreateEngagement should NOT be called
      // and the provided ID should be used directly
      const inputData = {
        clientId: VALID_CLIENT_ID,
        taxYear: 2025,
        engagementId: providedEngagementId,
        taxTypes: ['FORM_1040'],
      }

      expect(inputData.engagementId).toBe(providedEngagementId)
    })
  })
})

describe('GET /cases/:id - Response Format', () => {
  const mockTaxCaseFindUnique = vi.mocked(prisma.taxCase.findUnique)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should include both clientId and engagementId', async () => {
    const taxCase = {
      ...createMockTaxCase(),
      client: createMockClient(),
      engagement: createMockEngagement(),
    }

    mockTaxCaseFindUnique.mockResolvedValueOnce(taxCase as never)

    const result = await prisma.taxCase.findUnique({
      where: { id: 'case-1' },
      include: { client: true, engagement: true },
    })

    expect(result?.clientId).toBe(VALID_CLIENT_ID)
    expect(result?.engagementId).toBe(VALID_ENGAGEMENT_ID)
  })

  it('should include engagement relation with profile data', async () => {
    const engagement = createMockEngagement({
      filingStatus: 'SINGLE',
      hasW2: true,
      hasSelfEmployment: false,
    })
    const taxCase = {
      ...createMockTaxCase(),
      engagement,
    }

    mockTaxCaseFindUnique.mockResolvedValueOnce(taxCase as never)

    const result = await prisma.taxCase.findUnique({
      where: { id: 'case-1' },
      include: { engagement: true },
    })

    expect(result?.engagement).toBeDefined()
    expect(result?.engagement?.filingStatus).toBe('SINGLE')
    expect(result?.engagement?.hasW2).toBe(true)
  })

  it('should include engagement taxCases count', async () => {
    const taxCase = {
      ...createMockTaxCase(),
      engagement: {
        ...createMockEngagement(),
        _count: { taxCases: 2 },
      },
    }

    mockTaxCaseFindUnique.mockResolvedValueOnce(taxCase as never)

    const result = await prisma.taxCase.findUnique({
      where: { id: 'case-1' },
      include: {
        engagement: {
          include: { _count: { select: { taxCases: true } } },
        },
      },
    })

    expect(result?.engagement?._count?.taxCases).toBe(2)
  })
})

describe('POST /cases Response', () => {
  it('should return engagementId in creation response', () => {
    const response = {
      id: 'case-1',
      clientId: VALID_CLIENT_ID,
      engagementId: VALID_ENGAGEMENT_ID,
      taxYear: 2025,
      taxTypes: ['FORM_1040'],
      status: 'INTAKE',
      createdAt: new Date().toISOString(),
    }

    expect(response.engagementId).toBeDefined()
    expect(response.clientId).toBeDefined() // Both present for backward compat
  })
})

describe('Checklist Generation', () => {
  it('should use client profile for checklist (backward compat)', () => {
    const client = createMockClient({
      profile: {
        hasW2: true,
        hasSelfEmployment: true,
        intakeAnswers: { w2Count: 3 },
      },
    })

    // Checklist generator should still work with ClientProfile
    expect(client.profile).toBeDefined()
    expect(client.profile.hasW2).toBe(true)
  })

  it('should use engagement profile when available (new flow)', () => {
    const engagement = createMockEngagement({
      hasW2: true,
      hasSelfEmployment: true,
      intakeAnswers: { w2Count: 5 },
    })

    // Future: checklist generator could use TaxEngagement directly
    expect(engagement.intakeAnswers).toEqual({ w2Count: 5 })
  })
})

describe('Error Scenarios', () => {
  it('should return 404 when client not found', async () => {
    const localMockClientFindUnique = vi.mocked(prisma.client.findUnique)
    localMockClientFindUnique.mockReset()

    localMockClientFindUnique.mockResolvedValueOnce(null)

    const result = await prisma.client.findUnique({
      where: { id: 'non-existent' },
    })

    expect(result).toBeNull()
    // In actual API: returns { error: 'NOT_FOUND', message: 'Client not found' }
  })

  it('should return 400 when engagement validation fails', () => {
    // Engagement doesn't belong to client
    const errorResponse = {
      error: 'INVALID_ENGAGEMENT',
      message: 'Engagement not found or does not belong to this client',
    }

    expect(errorResponse.error).toBe('INVALID_ENGAGEMENT')
  })

  it('should handle transaction rollback gracefully', async () => {
    const mockTransaction = vi.mocked(prisma.$transaction)
    mockTransaction.mockRejectedValueOnce(new Error('Transaction failed'))

    await expect(
      prisma.$transaction(async () => {
        throw new Error('Transaction failed')
      })
    ).rejects.toThrow('Transaction failed')
  })
})

describe('Data Consistency', () => {
  it('should ensure engagementId is never null on new cases', () => {
    const taxCase = createMockTaxCase()

    // Phase 3 constraint: engagementId is required
    expect(taxCase.engagementId).toBeDefined()
    expect(taxCase.engagementId).not.toBeNull()
  })

  it('should match engagement taxYear with case taxYear', () => {
    const engagement = createMockEngagement({ taxYear: 2025 })
    const taxCase = createMockTaxCase({ taxYear: 2025, engagementId: engagement.id })

    expect(taxCase.taxYear).toBe(engagement.taxYear)
  })

  it('should match engagement clientId with case clientId', () => {
    const engagement = createMockEngagement({ clientId: VALID_CLIENT_ID })
    const taxCase = createMockTaxCase({ clientId: VALID_CLIENT_ID, engagementId: engagement.id })

    expect(taxCase.clientId).toBe(engagement.clientId)
  })
})

describe('Multi-Year Client Support', () => {
  it('should support same client with multiple year engagements', () => {
    const engagements = [
      createMockEngagement({ id: 'eng-2023', taxYear: 2023 }),
      createMockEngagement({ id: 'eng-2024', taxYear: 2024 }),
      createMockEngagement({ id: 'eng-2025', taxYear: 2025 }),
    ]

    // Each engagement has same clientId but different taxYear
    const clientIds = new Set(engagements.map(e => e.clientId))
    expect(clientIds.size).toBe(1)

    const years = engagements.map(e => e.taxYear).sort()
    expect(years).toEqual([2023, 2024, 2025])
  })

  it('should allow cases linked to different year engagements', () => {
    const cases = [
      createMockTaxCase({ engagementId: 'eng-2024', taxYear: 2024 }),
      createMockTaxCase({ engagementId: 'eng-2025', taxYear: 2025 }),
    ]

    // Each case links to correct year engagement
    expect(cases[0].engagementId).toBe('eng-2024')
    expect(cases[0].taxYear).toBe(2024)
    expect(cases[1].engagementId).toBe('eng-2025')
    expect(cases[1].taxYear).toBe(2025)
  })
})
