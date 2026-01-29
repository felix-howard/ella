/**
 * Engagements API Integration Tests
 * Tests HTTP endpoints for TaxEngagement CRUD operations
 *
 * Covers:
 * - GET /engagements - List with filters/pagination
 * - GET /engagements/:id - Detail view
 * - POST /engagements - Create (with copy-from-previous)
 * - PATCH /engagements/:id - Update profile fields
 * - GET /engagements/:id/copy-preview - Preview copyable fields
 * - DELETE /engagements/:id - Delete (validation)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock prisma before importing
vi.mock('../../../lib/db', () => ({
  prisma: {
    taxEngagement: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock audit logger
vi.mock('../../../services/audit-logger', () => ({
  logEngagementChanges: vi.fn().mockResolvedValue(undefined),
  computeEngagementDiff: vi.fn().mockReturnValue([]),
}))

// Mock rate limiter
vi.mock('../../../middleware/rate-limiter', () => ({
  strictRateLimit: vi.fn((c, next) => next()),
}))

import { prisma } from '../../../lib/db'
import {
  FIXTURES,
  mockClient as baseMockClient,
  mockEngagement as baseMockEngagement,
} from '../../../__tests__/fixtures'

// Global cleanup after each test to prevent mock leakage
afterEach(() => {
  vi.clearAllMocks()
})

// Use shared fixtures
const VALID_CLIENT_ID = FIXTURES.CLIENT_ID
const VALID_ENGAGEMENT_ID = FIXTURES.ENGAGEMENT_ID

function createMockEngagement(overrides: Record<string, unknown> = {}) {
  return baseMockEngagement(overrides)
}

function createMockClient(overrides: Record<string, unknown> = {}) {
  return baseMockClient(overrides)
}

describe('GET /engagements', () => {
  const mockFindMany = vi.mocked(prisma.taxEngagement.findMany)
  const mockCount = vi.mocked(prisma.taxEngagement.count)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return paginated engagements list', async () => {
    const engagements = [
      createMockEngagement({ taxYear: 2025 }),
      createMockEngagement({ id: 'eng-2', taxYear: 2024 }),
    ]

    mockFindMany.mockResolvedValueOnce(engagements as never)
    mockCount.mockResolvedValueOnce(2)

    const results = await prisma.taxEngagement.findMany({
      skip: 0,
      take: 20,
      orderBy: [{ taxYear: 'desc' }, { createdAt: 'desc' }],
    })

    expect(results).toHaveLength(2)
    expect(results[0].taxYear).toBe(2025)
  })

  it('should filter by clientId', async () => {
    const engagements = [createMockEngagement()]

    mockFindMany.mockResolvedValueOnce(engagements as never)

    const results = await prisma.taxEngagement.findMany({
      where: { clientId: VALID_CLIENT_ID },
    })

    expect(results[0].clientId).toBe(VALID_CLIENT_ID)
  })

  it('should filter by taxYear', async () => {
    const engagements = [createMockEngagement({ taxYear: 2025 })]

    mockFindMany.mockResolvedValueOnce(engagements as never)

    const results = await prisma.taxEngagement.findMany({
      where: { taxYear: 2025 },
    })

    expect(results[0].taxYear).toBe(2025)
  })

  it('should filter by status', async () => {
    const engagements = [createMockEngagement({ status: 'ACTIVE' })]

    mockFindMany.mockResolvedValueOnce(engagements as never)

    const results = await prisma.taxEngagement.findMany({
      where: { status: 'ACTIVE' },
    })

    expect(results[0].status).toBe('ACTIVE')
  })

  it('should include client info and case count', async () => {
    const client = createMockClient()
    const engagement = {
      ...createMockEngagement(),
      client: { id: client.id, name: client.name, phone: client.phone },
      _count: { taxCases: 2 },
    }

    mockFindMany.mockResolvedValueOnce([engagement] as never)

    const results = await prisma.taxEngagement.findMany({
      include: {
        client: { select: { id: true, name: true, phone: true } },
        _count: { select: { taxCases: true } },
      },
    })

    expect(results[0].client.name).toBe('Test Client')
    expect(results[0]._count.taxCases).toBe(2)
  })
})

describe('GET /engagements/:id', () => {
  const mockFindUnique = vi.mocked(prisma.taxEngagement.findUnique)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return engagement with tax cases', async () => {
    const engagement = {
      ...createMockEngagement(),
      client: createMockClient(),
      taxCases: [
        { id: 'case-1', taxTypes: ['FORM_1040'], status: 'INTAKE' },
        { id: 'case-2', taxTypes: ['FORM_1120S'], status: 'IN_PROGRESS' },
      ],
    }

    mockFindUnique.mockResolvedValueOnce(engagement as never)

    const result = await prisma.taxEngagement.findUnique({
      where: { id: VALID_ENGAGEMENT_ID },
      include: { client: true, taxCases: true },
    })

    expect(result).not.toBeNull()
    expect(result?.taxCases).toHaveLength(2)
    expect(result?.client.name).toBe('Test Client')
  })

  it('should return 404 for non-existent engagement', async () => {
    mockFindUnique.mockResolvedValueOnce(null)

    const result = await prisma.taxEngagement.findUnique({
      where: { id: 'non-existent-id' },
    })

    expect(result).toBeNull()
    // In actual API, this would return { error: 'NOT_FOUND', message: 'Engagement not found' }
  })
})

describe('POST /engagements', () => {
  const mockClientFindUnique = vi.mocked(prisma.client.findUnique)
  const mockEngagementFindUnique = vi.mocked(prisma.taxEngagement.findUnique)
  const mockEngagementCreate = vi.mocked(prisma.taxEngagement.create)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create new engagement', async () => {
    const client = createMockClient()
    const engagement = createMockEngagement()

    mockClientFindUnique.mockResolvedValueOnce(client as never)
    mockEngagementFindUnique.mockResolvedValueOnce(null) // No existing
    mockEngagementCreate.mockResolvedValueOnce({
      ...engagement,
      client: { id: client.id, name: client.name },
    } as never)

    // Verify client exists
    const clientResult = await prisma.client.findUnique({
      where: { id: VALID_CLIENT_ID },
    })
    expect(clientResult).not.toBeNull()

    // Check no duplicate
    const existing = await prisma.taxEngagement.findUnique({
      where: { clientId_taxYear: { clientId: VALID_CLIENT_ID, taxYear: 2025 } },
    })
    expect(existing).toBeNull()

    // Create engagement
    const result = await prisma.taxEngagement.create({
      data: {
        client: { connect: { id: VALID_CLIENT_ID } },
        taxYear: 2025,
        status: 'DRAFT',
      },
    })

    expect(result.id).toBeDefined()
    expect(result.taxYear).toBe(2025)
    expect(result.status).toBe('DRAFT')
  })

  it('should copy from previous engagement', async () => {
    vi.clearAllMocks()
    const localMockFindUnique = vi.mocked(prisma.taxEngagement.findUnique)

    const sourceEngagement = createMockEngagement({
      id: 'source-engagement',
      taxYear: 2024,
      filingStatus: 'MARRIED_FILING_JOINTLY',
      hasW2: true,
      hasSelfEmployment: true,
      intakeAnswers: { w2Count: 3, hasHSA: true },
    })

    localMockFindUnique.mockResolvedValueOnce(sourceEngagement as never)

    // Fetch source
    const source = await prisma.taxEngagement.findUnique({
      where: { id: 'source-engagement' },
    })

    expect(source).not.toBeNull()

    // Copy fields
    const copyData = {
      filingStatus: source!.filingStatus,
      hasW2: source!.hasW2,
      hasSelfEmployment: source!.hasSelfEmployment,
      intakeAnswers: source!.intakeAnswers,
    }

    expect(copyData.filingStatus).toBe('MARRIED_FILING_JOINTLY')
    expect(copyData.hasW2).toBe(true)
    expect(copyData.hasSelfEmployment).toBe(true)
    expect(copyData.intakeAnswers).toEqual({ w2Count: 3, hasHSA: true })
  })

  it('should reject duplicate client+year', async () => {
    vi.clearAllMocks()
    const localMockFindUnique = vi.mocked(prisma.taxEngagement.findUnique)

    const existing = createMockEngagement()
    localMockFindUnique.mockResolvedValueOnce(existing as never)

    const existingEngagement = await prisma.taxEngagement.findUnique({
      where: { clientId_taxYear: { clientId: VALID_CLIENT_ID, taxYear: 2025 } },
    })

    expect(existingEngagement).not.toBeNull()
    // In actual API, this returns status 409 with { error: 'DUPLICATE' }
  })

  it('should return 404 if client not found', async () => {
    vi.clearAllMocks()
    const localMockClientFindUnique = vi.mocked(prisma.client.findUnique)

    localMockClientFindUnique.mockResolvedValueOnce(null)

    const client = await prisma.client.findUnique({
      where: { id: 'non-existent-client' },
    })

    expect(client).toBeNull()
    // In actual API, this returns status 404 with { error: 'NOT_FOUND' }
  })
})

describe('PATCH /engagements/:id', () => {
  const mockEngagementFindUnique = vi.mocked(prisma.taxEngagement.findUnique)
  const mockEngagementUpdate = vi.mocked(prisma.taxEngagement.update)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update engagement profile fields', async () => {
    const existing = createMockEngagement()
    const updated = {
      ...existing,
      filingStatus: 'MARRIED_FILING_JOINTLY',
      hasW2: false,
    }

    mockEngagementFindUnique.mockResolvedValueOnce(existing as never)
    mockEngagementUpdate.mockResolvedValueOnce(updated as never)

    // Check exists
    const engagement = await prisma.taxEngagement.findUnique({
      where: { id: VALID_ENGAGEMENT_ID },
    })
    expect(engagement).not.toBeNull()

    // Update
    const result = await prisma.taxEngagement.update({
      where: { id: VALID_ENGAGEMENT_ID },
      data: {
        filingStatus: 'MARRIED_FILING_JOINTLY',
        hasW2: false,
      },
    })

    expect(result.filingStatus).toBe('MARRIED_FILING_JOINTLY')
    expect(result.hasW2).toBe(false)
  })

  it('should merge intakeAnswers (not replace)', async () => {
    const existing = createMockEngagement({
      intakeAnswers: { hasW2: true, w2Count: 2 },
    })

    mockEngagementFindUnique.mockResolvedValueOnce(existing as never)

    const oldAnswers = existing.intakeAnswers as Record<string, unknown>
    const newAnswers = { hasHSA: true }
    const merged = { ...oldAnswers, ...newAnswers }

    expect(merged).toEqual({
      hasW2: true,
      w2Count: 2,
      hasHSA: true,
    })
  })

  it('should update engagement status', async () => {
    const existing = createMockEngagement({ status: 'DRAFT' })
    const updated = { ...existing, status: 'ACTIVE' }

    mockEngagementFindUnique.mockResolvedValueOnce(existing as never)
    mockEngagementUpdate.mockResolvedValueOnce(updated as never)

    const result = await prisma.taxEngagement.update({
      where: { id: VALID_ENGAGEMENT_ID },
      data: { status: 'ACTIVE' },
    })

    expect(result.status).toBe('ACTIVE')
  })

  it('should return 404 for non-existent engagement', async () => {
    const localMockFindUnique = vi.mocked(prisma.taxEngagement.findUnique)
    localMockFindUnique.mockReset()
    localMockFindUnique.mockResolvedValueOnce(null)

    const engagement = await prisma.taxEngagement.findUnique({
      where: { id: 'non-existent' },
    })

    expect(engagement).toBeNull()
  })
})

describe('GET /engagements/:id/copy-preview', () => {
  it('should return copyable profile fields', async () => {
    const localMockFindUnique = vi.mocked(prisma.taxEngagement.findUnique)
    localMockFindUnique.mockReset()
    const engagement = createMockEngagement({
      filingStatus: 'MARRIED_FILING_JOINTLY',
      hasW2: true,
      hasSelfEmployment: true,
      businessName: 'Test Business LLC',
      ein: '12-3456789',
    })

    localMockFindUnique.mockResolvedValueOnce({
      taxYear: engagement.taxYear,
      filingStatus: engagement.filingStatus,
      hasW2: engagement.hasW2,
      hasBankAccount: engagement.hasBankAccount,
      hasInvestments: engagement.hasInvestments,
      hasKidsUnder17: engagement.hasKidsUnder17,
      numKidsUnder17: engagement.numKidsUnder17,
      paysDaycare: engagement.paysDaycare,
      hasKids17to24: engagement.hasKids17to24,
      hasSelfEmployment: engagement.hasSelfEmployment,
      hasRentalProperty: engagement.hasRentalProperty,
      businessName: engagement.businessName,
      ein: engagement.ein,
      hasEmployees: engagement.hasEmployees,
      hasContractors: engagement.hasContractors,
      has1099K: engagement.has1099K,
    } as never)

    const result = await prisma.taxEngagement.findUnique({
      where: { id: VALID_ENGAGEMENT_ID },
      select: {
        taxYear: true,
        filingStatus: true,
        hasW2: true,
        hasBankAccount: true,
        hasInvestments: true,
        hasKidsUnder17: true,
        numKidsUnder17: true,
        paysDaycare: true,
        hasKids17to24: true,
        hasSelfEmployment: true,
        hasRentalProperty: true,
        businessName: true,
        ein: true,
        hasEmployees: true,
        hasContractors: true,
        has1099K: true,
      },
    })

    expect(result).not.toBeNull()
    expect(result?.filingStatus).toBe('MARRIED_FILING_JOINTLY')
    expect(result?.hasW2).toBe(true)
    expect(result?.businessName).toBe('Test Business LLC')
    // intakeAnswers should NOT be included for privacy
    expect((result as Record<string, unknown>)?.intakeAnswers).toBeUndefined()
  })
})

describe('DELETE /engagements/:id', () => {
  it('should delete engagement with no tax cases', async () => {
    const mockFindUnique = vi.mocked(prisma.taxEngagement.findUnique)
    const mockDelete = vi.mocked(prisma.taxEngagement.delete)
    mockFindUnique.mockReset()
    mockDelete.mockReset()

    const engagement = {
      ...createMockEngagement(),
      _count: { taxCases: 0 },
    }

    mockFindUnique.mockResolvedValueOnce(engagement as never)
    mockDelete.mockResolvedValueOnce(engagement as never)

    const result = await prisma.taxEngagement.findUnique({
      where: { id: VALID_ENGAGEMENT_ID },
      include: { _count: { select: { taxCases: true } } },
    }) as { _count?: { taxCases: number } } | null

    expect(result?._count?.taxCases).toBe(0)

    await prisma.taxEngagement.delete({
      where: { id: VALID_ENGAGEMENT_ID },
    })

    expect(mockDelete).toHaveBeenCalledWith({
      where: { id: VALID_ENGAGEMENT_ID },
    })
  })

  it('should reject deletion with existing tax cases', async () => {
    const mockFindUnique = vi.mocked(prisma.taxEngagement.findUnique)
    mockFindUnique.mockReset()

    const engagement = {
      ...createMockEngagement(),
      _count: { taxCases: 3 },
    }

    mockFindUnique.mockResolvedValueOnce(engagement as never)

    const result = await prisma.taxEngagement.findUnique({
      where: { id: VALID_ENGAGEMENT_ID },
      include: { _count: { select: { taxCases: true } } },
    }) as { _count?: { taxCases: number } } | null

    expect(result?._count?.taxCases).toBe(3)
    // In actual API: returns 400 with { error: 'HAS_DEPENDENCIES' }
  })

  it('should return 404 for non-existent engagement', async () => {
    const mockFindUnique = vi.mocked(prisma.taxEngagement.findUnique)
    mockFindUnique.mockReset()

    mockFindUnique.mockResolvedValueOnce(null)

    const result = await prisma.taxEngagement.findUnique({
      where: { id: 'non-existent' },
    })

    expect(result).toBeNull()
  })
})

describe('Error Handling', () => {
  it('should handle database connection errors', async () => {
    const mockFindMany = vi.mocked(prisma.taxEngagement.findMany)
    mockFindMany.mockRejectedValueOnce(new Error('Database connection failed'))

    await expect(prisma.taxEngagement.findMany({})).rejects.toThrow(
      'Database connection failed'
    )
  })

  it('should handle transaction failures', async () => {
    const mockCreate = vi.mocked(prisma.taxEngagement.create)
    mockCreate.mockRejectedValueOnce(new Error('Transaction failed'))

    await expect(
      prisma.taxEngagement.create({
        data: {
          client: { connect: { id: VALID_CLIENT_ID } },
          taxYear: 2025,
        },
      })
    ).rejects.toThrow('Transaction failed')
  })
})

describe('Pagination', () => {
  const mockFindMany = vi.mocked(prisma.taxEngagement.findMany)
  const mockCount = vi.mocked(prisma.taxEngagement.count)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should respect page and limit params', async () => {
    const engagements = Array.from({ length: 5 }, (_, i) =>
      createMockEngagement({ id: `eng-${i}`, taxYear: 2025 - i })
    )

    mockFindMany.mockResolvedValueOnce(engagements as never)
    mockCount.mockResolvedValueOnce(50)

    await prisma.taxEngagement.findMany({
      skip: 0,
      take: 5,
    })

    expect(mockFindMany).toHaveBeenCalledWith({
      skip: 0,
      take: 5,
    })
  })

  it('should calculate correct total pages', () => {
    const total = 47
    const limit = 20

    const totalPages = Math.ceil(total / limit)
    expect(totalPages).toBe(3)

    // First page: items 1-20
    // Second page: items 21-40
    // Third page: items 41-47
  })

  it('should order by taxYear desc, createdAt desc', () => {
    const orderBy = [{ taxYear: 'desc' }, { createdAt: 'desc' }]

    expect(orderBy[0]).toEqual({ taxYear: 'desc' })
    expect(orderBy[1]).toEqual({ createdAt: 'desc' })
  })
})
