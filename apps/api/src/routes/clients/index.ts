/**
 * Clients API routes
 * CRUD operations for client management
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import {
  getPaginationParams,
  buildPaginationResponse,
} from '../../lib/constants'
import { sanitizeSearchInput, sanitizeTextInput, pickFields } from '../../lib/validation'
import {
  createClientSchema,
  updateClientSchema,
  updateProfileSchema,
  listClientsQuerySchema,
  clientIdParamSchema,
  cascadeCleanupSchema,
} from './schemas'
import { generateChecklist, cascadeCleanupOnFalse, refreshChecklist } from '../../services/checklist-generator'
import {
  logProfileChanges,
  computeIntakeAnswersDiff,
  computeProfileFieldDiff,
} from '../../services/audit-logger'
import { createMagicLink } from '../../services/magic-link'
import { sendWelcomeMessage, isSmsEnabled } from '../../services/sms'
import { findOrCreateEngagement } from '../../services/engagement-helpers'
import { computeStatus, calculateStaleDays } from '@ella/shared'
import type { ActionCounts, ClientWithActions } from '@ella/shared'
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Prisma } from '@ella/db'
import type { TaxType, Language } from '@ella/db'
import { buildClientScopeFilter } from '../../lib/org-scope'
import type { AuthVariables } from '../../middleware/auth'

const clientsRoute = new Hono<{ Variables: AuthVariables }>()

// GET /clients/intake-questions - Get intake questions for selected tax types
// This is used by the client creation form to dynamically load questions
clientsRoute.get('/intake-questions', async (c) => {
  const taxTypesParam = c.req.query('taxTypes')

  // Parse tax types from query string (comma-separated)
  const taxTypes = taxTypesParam
    ? taxTypesParam.split(',').filter((t) => ['FORM_1040', 'FORM_1120S', 'FORM_1065'].includes(t))
    : ['FORM_1040'] // Default to individual form

  // Fetch active questions that apply to any of the selected tax types
  const questions = await prisma.intakeQuestion.findMany({
    where: {
      isActive: true,
      taxTypes: { hasSome: taxTypes as TaxType[] },
    },
    orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      questionKey: true,
      taxTypes: true,
      labelVi: true,
      labelEn: true,
      hintVi: true,
      hintEn: true,
      fieldType: true,
      options: true,
      condition: true,
      section: true,
      sortOrder: true,
    },
  })

  return c.json({ data: questions })
})

// GET /clients - List all clients with pagination, computed status, and action counts
// Optimized: Uses Prisma _count for aggregation instead of fetching all records
clientsRoute.get('/', zValidator('query', listClientsQuerySchema), async (c) => {
  const { page, limit, search, status, sort } = c.req.valid('query')
  const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)

  // Build where clause with org + assignment scope
  const user = c.get('user')
  const isAdmin = user.orgRole === 'org:admin' || user.role === 'ADMIN'
  const where: Record<string, unknown> = { ...buildClientScopeFilter(user) }

  if (search) {
    const sanitizedSearch = sanitizeSearchInput(search)
    if (sanitizedSearch) {
      where.OR = [
        { name: { contains: sanitizedSearch, mode: 'insensitive' } },
        { phone: { contains: sanitizedSearch } },
      ]
    }
  }

  if (status) {
    where.taxCases = { some: { status } }
  }

  // Determine sort order based on sort parameter
  type OrderByType = { name: 'asc' } | { createdAt: 'desc' }
  let orderBy: OrderByType = { createdAt: 'desc' }
  if (sort === 'name') {
    orderBy = { name: 'asc' }
  }
  // For activity and stale sorting, we sort in JS after fetching due to relation complexity

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy,
      include: {
        profile: {
          select: { intakeAnswers: true }
        },
        // Include assigned staff names for admin list view
        ...(isAdmin ? {
          assignments: {
            select: {
              staff: { select: { id: true, name: true } },
            },
          },
        } : {}),
        taxCases: {
          take: 1,
          orderBy: { lastActivityAt: 'desc' },
          select: {
            id: true,
            taxYear: true,
            taxTypes: true,
            isInReview: true,
            isFiled: true,
            lastActivityAt: true,
            // Use _count for efficient aggregation (single query instead of fetching all records)
            _count: {
              select: {
                checklistItems: { where: { status: 'MISSING' } },
              }
            },
            digitalDocs: {
              select: {
                status: true,
                entryCompleted: true
              }
            },
            conversation: {
              select: { unreadCount: true }
            }
          }
        }
      },
    }),
    prisma.client.count({ where }),
  ])

  // Transform to ClientWithActions
  const data: ClientWithActions[] = clients.map((client) => {
    const latestCase = client.taxCases[0]
    const intakeAnswers = (client.profile?.intakeAnswers as Record<string, unknown>) || {}
    const hasIntakeAnswers = Object.keys(intakeAnswers).length > 0

    let computedStatusValue = null
    let actionCounts: ActionCounts | null = null

    if (latestCase) {
      // Use _count for missingDocs (efficient aggregation)
      const missingDocs = latestCase._count.checklistItems
      // Filter docs in JS for complex conditions (minimal data fetched)
      const toVerify = latestCase.digitalDocs.filter(
        (d) => d.status === 'EXTRACTED'
      ).length
      const unverifiedDocs = latestCase.digitalDocs.filter(
        (d) => d.status !== 'VERIFIED'
      ).length
      const toEnter = latestCase.digitalDocs.filter(
        (d) => d.status === 'VERIFIED' && !d.entryCompleted
      ).length

      computedStatusValue = computeStatus({
        hasIntakeAnswers,
        missingDocsCount: missingDocs,
        unverifiedDocsCount: unverifiedDocs,
        pendingEntryCount: toEnter,
        isInReview: latestCase.isInReview,
        isFiled: latestCase.isFiled,
      })

      actionCounts = {
        missingDocs,
        toVerify,
        toEnter,
        staleDays: calculateStaleDays(latestCase.lastActivityAt),
        hasNewActivity: (latestCase.conversation?.unreadCount || 0) > 0,
      }
    }

    // Map assigned staff for admin view
    const assignedStaff = isAdmin && 'assignments' in client
      ? (client.assignments as unknown as { staff: { id: string; name: string } }[]).map((a) => a.staff)
      : undefined

    return {
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email,
      language: client.language as 'VI' | 'EN',
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
      computedStatus: computedStatusValue,
      ...(assignedStaff ? { assignedStaff } : {}),
      actionCounts,
      latestCase: latestCase ? {
        id: latestCase.id,
        taxYear: latestCase.taxYear,
        taxTypes: latestCase.taxTypes as string[],
        isInReview: latestCase.isInReview,
        isFiled: latestCase.isFiled,
        lastActivityAt: latestCase.lastActivityAt.toISOString(),
      } : null,
    }
  })

  // Apply activity-based sorting in JS (Prisma doesn't support nested relation sorting well)
  let sortedData = data
  if (sort === 'activity') {
    sortedData = [...data].sort((a, b) => {
      const aTime = a.latestCase?.lastActivityAt ? new Date(a.latestCase.lastActivityAt).getTime() : 0
      const bTime = b.latestCase?.lastActivityAt ? new Date(b.latestCase.lastActivityAt).getTime() : 0
      return bTime - aTime // Most recent first
    })
  } else if (sort === 'stale') {
    sortedData = [...data].sort((a, b) => {
      const aTime = a.latestCase?.lastActivityAt ? new Date(a.latestCase.lastActivityAt).getTime() : Infinity
      const bTime = b.latestCase?.lastActivityAt ? new Date(b.latestCase.lastActivityAt).getTime() : Infinity
      return aTime - bTime // Oldest first (most stale)
    })
  }

  return c.json({
    data: sortedData,
    pagination: buildPaginationResponse(safePage, safeLimit, total),
  })
})

// POST /clients - Create new client with profile and tax case
clientsRoute.post('/', zValidator('json', createClientSchema), async (c) => {
  const body = c.req.valid('json')
  const { profile, ...clientData } = body
  const user = c.get('user')

  try {
  // Create client with profile and tax case in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create client with org scope
    const client = await tx.client.create({
      data: {
        ...clientData,
        language: clientData.language as Language,
        organizationId: user.organizationId,
        profile: {
          create: {
            // Legacy fields for backward compatibility
            filingStatus: profile.filingStatus,
            hasW2: profile.hasW2,
            hasBankAccount: profile.hasBankAccount,
            hasInvestments: profile.hasInvestments,
            hasKidsUnder17: profile.hasKidsUnder17,
            numKidsUnder17: profile.numKidsUnder17,
            paysDaycare: profile.paysDaycare,
            hasKids17to24: profile.hasKids17to24,
            hasSelfEmployment: profile.hasSelfEmployment,
            hasRentalProperty: profile.hasRentalProperty,
            businessName: profile.businessName,
            ein: profile.ein,
            hasEmployees: profile.hasEmployees,
            hasContractors: profile.hasContractors,
            has1099K: profile.has1099K,
            // NEW: Store full intake answers JSON
            intakeAnswers: profile.intakeAnswers ?? {},
          },
        },
      },
      include: { profile: true },
    })

    // Find or create engagement for this client + year
    const { engagementId } = await findOrCreateEngagement(
      tx,
      client.id,
      profile.taxYear,
      client.profile
    )

    // Create tax case
    const taxCase = await tx.taxCase.create({
      data: {
        clientId: client.id,
        taxYear: profile.taxYear,
        engagementId,
        taxTypes: profile.taxTypes as TaxType[],
        status: 'INTAKE',
      },
    })

    // Create conversation for the case with lastMessageAt set to ensure
    // it appears in Messages tab immediately (fixes race condition with async SMS)
    // Note: SMS will overwrite lastMessageAt with correct timestamp when message sent
    await tx.conversation.create({
      data: {
        caseId: taxCase.id,
        lastMessageAt: new Date(),
      },
    })

    return { client, taxCase, profile: client.profile! }
  })

  // Generate checklist based on profile (outside transaction)
  await generateChecklist(
    result.taxCase.id,
    profile.taxTypes as TaxType[],
    result.profile
  )

  // Create magic link
  const magicLink = await createMagicLink(result.taxCase.id)

  // Send welcome SMS with magic link (async, non-blocking)
  let smsStatus: { sent: boolean; error?: string } = { sent: false }
  if (isSmsEnabled()) {
    try {
      const smsResult = await sendWelcomeMessage(
        result.taxCase.id,
        result.client.name,
        result.client.phone,
        magicLink,
        result.taxCase.taxYear,
        (result.client.language as 'VI' | 'EN') || 'VI'
      )
      smsStatus = { sent: smsResult.smsSent, error: smsResult.error }
    } catch (error) {
      console.error('[Create Client] Failed to send welcome SMS:', error)
      smsStatus = { sent: false, error: 'SMS_SEND_FAILED' }
    }
  }

  return c.json(
    {
      client: {
        id: result.client.id,
        name: result.client.name,
        phone: result.client.phone,
        email: result.client.email,
        language: result.client.language,
        createdAt: result.client.createdAt.toISOString(),
        updatedAt: result.client.updatedAt.toISOString(),
      },
      taxCase: {
        id: result.taxCase.id,
        taxYear: result.taxCase.taxYear,
        status: result.taxCase.status,
      },
      magicLink,
      smsStatus,
    },
    201
  )
  } catch (error) {
    console.error('[Create Client] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('[Create Client] Stack:', errorStack)
    return c.json(
      {
        error: 'CREATE_CLIENT_FAILED',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      500
    )
  }
})

// GET /clients/:id - Get client details with magic link and SMS status
clientsRoute.get('/:id', zValidator('param', clientIdParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const user = c.get('user')

  const client = await prisma.client.findFirst({
    where: { id, ...buildClientScopeFilter(user) },
    include: {
      profile: true,
      taxCases: {
        orderBy: { taxYear: 'desc' },
        include: {
          magicLinks: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              rawImages: true,
              digitalDocs: true,
              checklistItems: true,
            },
          },
        },
      },
    },
  })

  if (!client) {
    return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
  }

  // Build portal URL per taxCase from active magic links
  const portalBaseUrl = process.env.PORTAL_URL

  // Check SMS configuration status
  const smsEnabled = isSmsEnabled()

  const taxCasesWithPortal = client.taxCases.map((tc) => {
    const activeMagicLink = tc.magicLinks?.[0]
    const portalUrl = activeMagicLink && portalBaseUrl
      ? `${portalBaseUrl}/u/${activeMagicLink.token}`
      : null
    return {
      ...tc,
      magicLinks: undefined,
      portalUrl,
      createdAt: tc.createdAt.toISOString(),
      updatedAt: tc.updatedAt.toISOString(),
    }
  })

  // Keep top-level portalUrl for backwards compatibility (latest case)
  const portalUrl = taxCasesWithPortal[0]?.portalUrl ?? null

  return c.json({
    ...client,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    taxCases: taxCasesWithPortal,
    portalUrl,
    smsEnabled,
  })
})

// POST /clients/:id/resend-sms - Resend welcome SMS with magic link
clientsRoute.post('/:id/resend-sms', zValidator('param', clientIdParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const user = c.get('user')

  // Fetch client with latest case and active magic link (org-scoped)
  const client = await prisma.client.findFirst({
    where: { id, ...buildClientScopeFilter(user) },
    include: {
      taxCases: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          magicLinks: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  if (!client) {
    return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
  }

  const taxCase = client.taxCases[0]
  const magicLink = taxCase?.magicLinks?.[0]

  if (!taxCase || !magicLink) {
    return c.json({
      success: false,
      error: 'NO_MAGIC_LINK',
      smsEnabled: isSmsEnabled(),
    })
  }

  // Check if SMS is enabled
  if (!isSmsEnabled()) {
    return c.json({
      success: false,
      error: 'SMS_NOT_CONFIGURED',
      smsEnabled: false,
    })
  }

  // Require PORTAL_URL to be configured
  const portalBaseUrl = process.env.PORTAL_URL
  if (!portalBaseUrl) {
    return c.json({
      success: false,
      error: 'PORTAL_URL_NOT_CONFIGURED',
      smsEnabled: true,
    })
  }

  // Build portal URL and send welcome SMS
  const portalUrl = `${portalBaseUrl}/u/${magicLink.token}`

  try {
    const result = await sendWelcomeMessage(
      taxCase.id,
      client.name,
      client.phone,
      portalUrl,
      taxCase.taxYear,
      (client.language as 'VI' | 'EN') || 'VI'
    )

    if (result.smsSent) {
      return c.json({
        success: true,
        error: null,
        smsEnabled: true,
      })
    } else {
      return c.json({
        success: false,
        error: result.error || 'SMS_SEND_FAILED',
        smsEnabled: true,
      })
    }
  } catch (error) {
    console.error('[Resend SMS] Error:', error)
    return c.json({
      success: false,
      error: 'SMS_SEND_ERROR',
      smsEnabled: true,
    })
  }
})

// PATCH /clients/:id - Update client
clientsRoute.patch(
  '/:id',
  zValidator('param', clientIdParamSchema),
  zValidator('json', updateClientSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const user = c.get('user')

    // Verify access before update (org + assignment scope)
    const existing = await prisma.client.findFirst({
      where: { id, ...buildClientScopeFilter(user) },
      select: { id: true },
    })
    if (!existing) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    // Explicitly pick only allowed fields to prevent mass assignment
    const allowedFields = ['name', 'phone', 'email', 'language'] as const
    const updateData = pickFields(body, [...allowedFields])

    const client = await prisma.client.update({
      where: { id },
      data: updateData as { name?: string; phone?: string; email?: string | null; language?: Language },
    })

    return c.json({
      ...client,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    })
  }
)

// PATCH /clients/:id/profile - Update client profile (intakeAnswers + filingStatus)
// Supports partial updates - merges with existing intakeAnswers
//
// Security Notes:
// - Input validation via Zod (key format, value types, max counts)
// - Audit values stored as JSON - frontend MUST escape when rendering to prevent XSS
// - Consider adding rate limiting middleware (e.g., 10 req/min per client) in production
// - Audit log retention: IRS requires 7 years - implement scheduled cleanup job
clientsRoute.patch(
  '/:id/profile',
  zValidator('param', clientIdParamSchema),
  zValidator('json', updateProfileSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    const user = c.get('user')

    try {
      // Fetch current profile with client's active tax case (org-scoped)
      const client = await prisma.client.findFirst({
        where: { id, ...buildClientScopeFilter(user) },
        include: {
          profile: true,
          taxCases: {
            where: { status: { not: 'FILED' } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })

      if (!client) {
        return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
      }

      if (!client.profile) {
        return c.json({ error: 'NO_PROFILE', message: 'Client has no profile' }, 400)
      }

      const currentProfile = client.profile
      const currentIntakeAnswers = (currentProfile.intakeAnswers as Record<string, unknown>) || {}
      const activeCaseId = client.taxCases[0]?.id

      // Sanitize string values in intakeAnswers to prevent XSS
      // Note: Frontend MUST also escape when rendering for defense-in-depth
      const sanitizedIntakeAnswers = body.intakeAnswers
        ? Object.fromEntries(
            Object.entries(body.intakeAnswers).map(([key, value]) => [
              key,
              typeof value === 'string' ? sanitizeTextInput(value, 500) : value,
            ])
          )
        : undefined

      // Merge intakeAnswers (partial update)
      const mergedIntakeAnswers = sanitizedIntakeAnswers
        ? { ...currentIntakeAnswers, ...sanitizedIntakeAnswers }
        : currentIntakeAnswers

      // Compute diffs for audit logging (using sanitized values)
      const intakeChanges = sanitizedIntakeAnswers
        ? computeIntakeAnswersDiff(currentIntakeAnswers, mergedIntakeAnswers)
        : []
      const profileChanges = computeProfileFieldDiff(currentProfile, body)
      const allChanges = [...intakeChanges, ...profileChanges]

      // Build update data with proper Prisma types
      const updateData: Prisma.ClientProfileUpdateInput = {}
      if (sanitizedIntakeAnswers) {
        updateData.intakeAnswers = mergedIntakeAnswers as Prisma.InputJsonValue
      }
      if (body.filingStatus !== undefined) {
        updateData.filingStatus = body.filingStatus
      }

      // Skip if no changes
      if (Object.keys(updateData).length === 0) {
        return c.json({
          profile: currentProfile,
          checklistRefreshed: false,
          cascadeCleanup: { triggeredBy: [] },
        })
      }

      // Update profile
      const updatedProfile = await prisma.clientProfile.update({
        where: { clientId: id },
        data: updateData,
      })

      // Detect boolean fields that changed to false (for cascade cleanup)
      const changedToFalse: string[] = []
      if (sanitizedIntakeAnswers) {
        for (const [key, newValue] of Object.entries(sanitizedIntakeAnswers)) {
          const oldValue = currentIntakeAnswers[key]
          if (oldValue === true && newValue === false) {
            changedToFalse.push(key)
          }
        }
      }

      // Cascade cleanup for each boolean that changed to false (parallel execution)
      if (changedToFalse.length > 0) {
        await Promise.all(
          changedToFalse.map((key) => cascadeCleanupOnFalse(id, key, activeCaseId))
        )
      }

      // Refresh checklist if there's an active case and intakeAnswers changed
      let checklistRefreshed = false
      if (activeCaseId && sanitizedIntakeAnswers) {
        await refreshChecklist(activeCaseId)
        checklistRefreshed = true
      }

      // Log changes asynchronously (non-blocking)
      // Note: staffId can be extracted from auth context in future
      if (allChanges.length > 0) {
        logProfileChanges(id, allChanges).catch((err) => {
          console.error('[Profile Update] Failed to log changes:', err)
        })
      }

      return c.json({
        profile: {
          ...updatedProfile,
          createdAt: updatedProfile.createdAt.toISOString(),
          updatedAt: updatedProfile.updatedAt.toISOString(),
        },
        checklistRefreshed,
        cascadeCleanup: { triggeredBy: changedToFalse },
      })
    } catch (error) {
      console.error('[Profile Update] Error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return c.json(
        { error: 'PROFILE_UPDATE_FAILED', message: errorMessage },
        500
      )
    }
  }
)

// POST /clients/:id/cascade-cleanup - Cascade cleanup when parent answer changes to false
clientsRoute.post(
  '/:id/cascade-cleanup',
  zValidator('param', clientIdParamSchema),
  zValidator('json', cascadeCleanupSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const { changedKey, caseId } = c.req.valid('json')
    const user = c.get('user')

    // Verify access before cleanup (org + assignment scope)
    const client = await prisma.client.findFirst({
      where: { id, ...buildClientScopeFilter(user) },
      select: { id: true },
    })
    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    try {
      const result = await cascadeCleanupOnFalse(id, changedKey, caseId)

      return c.json({
        success: true,
        deletedAnswers: result.deletedAnswers,
        deletedItems: result.deletedItems,
      })
    } catch (error) {
      console.error('[Cascade Cleanup] Error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return c.json(
        { success: false, error: 'CASCADE_CLEANUP_FAILED', message: errorMessage },
        500
      )
    }
  }
)

// DELETE /clients/:id - Delete client
clientsRoute.delete('/:id', zValidator('param', clientIdParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const user = c.get('user')

  // Verify access before delete (org + assignment scope)
  const client = await prisma.client.findFirst({
    where: { id, ...buildClientScopeFilter(user) },
    select: { id: true },
  })
  if (!client) {
    return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
  }

  await prisma.client.delete({ where: { id } })

  return c.json({ success: true, message: 'Client deleted successfully' })
})

export { clientsRoute }
