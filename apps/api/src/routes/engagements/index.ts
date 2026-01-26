/**
 * TaxEngagement API routes
 * CRUD operations for multi-year client engagement management
 *
 * Security: All endpoints require authentication via authMiddleware (applied in app.ts)
 * Rate limiting: Applied to mutation endpoints (POST, PATCH, DELETE)
 * Audit logging: All changes logged to AuditLog table
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import {
  getPaginationParams,
  buildPaginationResponse,
} from '../../lib/constants'
import {
  createEngagementSchema,
  updateEngagementSchema,
  engagementIdParamSchema,
  listEngagementsQuerySchema,
} from './schemas'
import { strictRateLimit } from '../../middleware/rate-limiter'
import { logEngagementChanges, computeEngagementDiff, type FieldChange } from '../../services/audit-logger'
import type { EngagementStatus, Prisma } from '@ella/db'
import type { AuthUser, AuthVariables } from '../../middleware/auth'

const engagementsRoute = new Hono<{ Variables: AuthVariables }>()

// GET /engagements - List engagements with filters
engagementsRoute.get('/', zValidator('query', listEngagementsQuerySchema), async (c) => {
  const { clientId, taxYear, status, page, limit } = c.req.valid('query')
  const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)

  const where: Prisma.TaxEngagementWhereInput = {}
  if (clientId) where.clientId = clientId
  if (taxYear) where.taxYear = taxYear
  if (status) where.status = status as EngagementStatus

  const [engagements, total] = await Promise.all([
    prisma.taxEngagement.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: [{ taxYear: 'desc' }, { createdAt: 'desc' }],
      include: {
        client: { select: { id: true, name: true, phone: true } },
        _count: { select: { taxCases: true } },
      },
    }),
    prisma.taxEngagement.count({ where }),
  ])

  return c.json({
    data: engagements.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
    pagination: buildPaginationResponse(safePage, safeLimit, total),
  })
})

// GET /engagements/:id - Get engagement details
engagementsRoute.get('/:id', zValidator('param', engagementIdParamSchema), async (c) => {
  const { id } = c.req.valid('param')

  const engagement = await prisma.taxEngagement.findUnique({
    where: { id },
    include: {
      client: true,
      taxCases: {
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { rawImages: true, digitalDocs: true, checklistItems: true } },
        },
      },
    },
  })

  if (!engagement) {
    return c.json({ error: 'NOT_FOUND', message: 'Engagement not found' }, 404)
  }

  return c.json({
    data: {
      ...engagement,
      createdAt: engagement.createdAt.toISOString(),
      updatedAt: engagement.updatedAt.toISOString(),
      taxCases: engagement.taxCases.map((tc) => ({
        ...tc,
        createdAt: tc.createdAt.toISOString(),
        updatedAt: tc.updatedAt.toISOString(),
      })),
    },
  })
})

// POST /engagements - Create engagement (with optional copy from previous)
// Rate limited: 10 requests/minute per user
engagementsRoute.post('/', strictRateLimit, zValidator('json', createEngagementSchema), async (c) => {
  const { clientId, taxYear, copyFromEngagementId, ...profileData } = c.req.valid('json')
  const user = c.get('user') as AuthUser | undefined

  // Verify client exists
  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) {
    return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
  }

  // Check for existing engagement (unique constraint: clientId + taxYear)
  const existing = await prisma.taxEngagement.findUnique({
    where: { clientId_taxYear: { clientId, taxYear } },
  })
  if (existing) {
    return c.json({ error: 'DUPLICATE', message: 'Engagement already exists for this client and year' }, 409)
  }

  // Copy profile data from previous engagement if specified
  interface ProfileFields {
    filingStatus?: string | null
    hasW2?: boolean
    hasBankAccount?: boolean
    hasInvestments?: boolean
    hasKidsUnder17?: boolean
    numKidsUnder17?: number
    paysDaycare?: boolean
    hasKids17to24?: boolean
    hasSelfEmployment?: boolean
    hasRentalProperty?: boolean
    businessName?: string | null
    ein?: string | null
    hasEmployees?: boolean
    hasContractors?: boolean
    has1099K?: boolean
    intakeAnswers?: Prisma.InputJsonValue
  }

  let copyData: ProfileFields = {}
  if (copyFromEngagementId) {
    const source = await prisma.taxEngagement.findUnique({
      where: { id: copyFromEngagementId },
    })
    // Only copy if source exists and belongs to same client
    if (source && source.clientId === clientId) {
      copyData = {
        filingStatus: source.filingStatus,
        hasW2: source.hasW2,
        hasBankAccount: source.hasBankAccount,
        hasInvestments: source.hasInvestments,
        hasKidsUnder17: source.hasKidsUnder17,
        numKidsUnder17: source.numKidsUnder17,
        paysDaycare: source.paysDaycare,
        hasKids17to24: source.hasKids17to24,
        hasSelfEmployment: source.hasSelfEmployment,
        hasRentalProperty: source.hasRentalProperty,
        businessName: source.businessName,
        ein: source.ein,
        hasEmployees: source.hasEmployees,
        hasContractors: source.hasContractors,
        has1099K: source.has1099K,
        intakeAnswers: source.intakeAnswers as Prisma.InputJsonValue,
      }
    }
  }

  // Merge profile data: copy data first, then explicit fields override
  const mergedData: ProfileFields = {
    ...copyData,
    ...(profileData.filingStatus !== undefined && { filingStatus: profileData.filingStatus }),
    ...(profileData.intakeAnswers !== undefined && { intakeAnswers: profileData.intakeAnswers as Prisma.InputJsonValue }),
  }

  const engagement = await prisma.taxEngagement.create({
    data: {
      client: { connect: { id: clientId } },
      taxYear,
      status: 'DRAFT',
      ...mergedData,
    },
    include: { client: { select: { id: true, name: true } } },
  })

  // Audit log: Log creation (async, non-blocking)
  const createChanges: FieldChange[] = [
    { field: 'created', oldValue: null, newValue: { clientId, taxYear, copiedFrom: copyFromEngagementId || null } },
  ]
  logEngagementChanges(engagement.id, createChanges, user?.staffId || undefined).catch(() => {})

  return c.json({
    data: {
      ...engagement,
      createdAt: engagement.createdAt.toISOString(),
      updatedAt: engagement.updatedAt.toISOString(),
    },
  }, 201)
})

// PATCH /engagements/:id - Update engagement profile
// Rate limited: 10 requests/minute per user
engagementsRoute.patch(
  '/:id',
  strictRateLimit,
  zValidator('param', engagementIdParamSchema),
  zValidator('json', updateEngagementSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const user = c.get('user') as AuthUser | undefined

    // Check engagement exists
    const existing = await prisma.taxEngagement.findUnique({ where: { id } })
    if (!existing) {
      return c.json({ error: 'NOT_FOUND', message: 'Engagement not found' }, 404)
    }

    // Build update data, handling intakeAnswers specially (merge, not replace)
    const { intakeAnswers, ...directFields } = body
    const updateData: Prisma.TaxEngagementUpdateInput = { ...directFields }

    if (intakeAnswers !== undefined) {
      // Merge with existing intakeAnswers
      const existingAnswers = (existing.intakeAnswers as Record<string, unknown>) || {}
      updateData.intakeAnswers = { ...existingAnswers, ...intakeAnswers } as Prisma.InputJsonValue
    }

    const engagement = await prisma.taxEngagement.update({
      where: { id },
      data: updateData,
    })

    // Audit log: Compute and log changes (async, non-blocking)
    const changes = computeEngagementDiff(
      existing as unknown as Record<string, unknown>,
      { ...body, intakeAnswers: updateData.intakeAnswers }
    )
    if (changes.length > 0) {
      logEngagementChanges(id, changes, user?.staffId || undefined).catch(() => {})
    }

    return c.json({
      data: {
        ...engagement,
        createdAt: engagement.createdAt.toISOString(),
        updatedAt: engagement.updatedAt.toISOString(),
      },
    })
  }
)

// GET /engagements/:id/copy-preview - Preview what would be copied from this engagement
engagementsRoute.get('/:id/copy-preview', zValidator('param', engagementIdParamSchema), async (c) => {
  const { id } = c.req.valid('param')

  const engagement = await prisma.taxEngagement.findUnique({
    where: { id },
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
      // Exclude intakeAnswers from preview for privacy (can be large)
    },
  })

  if (!engagement) {
    return c.json({ error: 'NOT_FOUND', message: 'Engagement not found' }, 404)
  }

  return c.json({ data: engagement })
})

// DELETE /engagements/:id - Delete engagement (only if no tax cases)
// Rate limited: 10 requests/minute per user
engagementsRoute.delete('/:id', strictRateLimit, zValidator('param', engagementIdParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const user = c.get('user') as AuthUser | undefined

  // Check if engagement has tax cases
  const engagement = await prisma.taxEngagement.findUnique({
    where: { id },
    include: { _count: { select: { taxCases: true } } },
  })

  if (!engagement) {
    return c.json({ error: 'NOT_FOUND', message: 'Engagement not found' }, 404)
  }

  if (engagement._count.taxCases > 0) {
    return c.json({
      error: 'HAS_DEPENDENCIES',
      message: `Cannot delete engagement with ${engagement._count.taxCases} tax case(s). Delete tax cases first.`,
    }, 400)
  }

  await prisma.taxEngagement.delete({ where: { id } })

  // Audit log: Log deletion (async, non-blocking)
  const deleteChanges: FieldChange[] = [
    { field: 'deleted', oldValue: { clientId: engagement.clientId, taxYear: engagement.taxYear }, newValue: null },
  ]
  logEngagementChanges(id, deleteChanges, user?.staffId || undefined).catch(() => {})

  return c.json({ success: true, message: 'Engagement deleted successfully' })
})

export { engagementsRoute }
