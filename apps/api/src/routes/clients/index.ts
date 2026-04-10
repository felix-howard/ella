/**
 * Clients API routes
 * CRUD operations for client management
 */
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../../lib/db'
import type { ClientSource } from '@ella/db'
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
  avatarPresignedUrlSchema,
  avatarConfirmSchema,
  updateNotesSchema,
  createWithBusinessSchema,
  linkBusinessSchema,
} from './schemas'
import { generateChecklist, cascadeCleanupOnFalse, refreshChecklist } from '../../services/checklist-generator'
import {
  logProfileChanges,
  computeIntakeAnswersDiff,
  computeProfileFieldDiff,
} from '../../services/audit-logger'
import { createMagicLink } from '../../services/magic-link'
import { getSignedUploadUrl, generateClientAvatarKey, resolveAvatarUrl } from '../../services/storage'
import { sendWelcomeMessage, isSmsEnabled, getOrgSmsLanguage } from '../../services/sms'
import { findOrCreateEngagement } from '../../services/engagement-helpers'
import { computeStatus, calculateStaleDays } from '@ella/shared'
import type { ActionCounts, ClientWithActions } from '@ella/shared'
import { Prisma } from '@ella/db'
import type { TaxType, Language, ClientType, BusinessType } from '@ella/db'
import { encryptSSN, maskEIN } from '../../services/crypto'
import type { ClientUploads } from '@ella/shared'
import { buildClientScopeFilter } from '../../lib/org-scope'
import { rateLimiter } from '../../middleware/rate-limiter'
import { requireOrgAdmin } from '../../middleware/auth'
import type { AuthVariables } from '../../middleware/auth'

const clientsRoute = new Hono<{ Variables: AuthVariables }>()

/**
 * Compute display name from firstName and lastName
 */
function computeDisplayName(firstName: string, lastName?: string | null): string {
  return lastName ? `${firstName} ${lastName}` : firstName
}


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
  const { page, limit, search, managedById, attention, tag, clientType } = c.req.valid('query')
  const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)

  // Build where clause with org + assignment scope
  const user = c.get('user')
  const isAdmin = user.orgRole === 'org:admin' || user.role === 'ADMIN'
  const where: Record<string, unknown> = { ...buildClientScopeFilter(user) }

  if (search) {
    const sanitizedSearch = sanitizeSearchInput(search)
    if (sanitizedSearch) {
      // Normalize phone: strip non-digits, use if >= 3 digits to match E.164 stored format
      const digitsOnly = sanitizedSearch.replace(/\D/g, '')
      const phoneSearch = digitsOnly.length >= 3 ? digitsOnly : sanitizedSearch

      const namePhoneFilter = [
        { firstName: { contains: sanitizedSearch, mode: 'insensitive' as const } },
        { lastName: { contains: sanitizedSearch, mode: 'insensitive' as const } },
        { name: { contains: sanitizedSearch, mode: 'insensitive' as const } },
        { phone: { contains: phoneSearch } },
      ]

      // Also include linked group members: if search matches a client in a group,
      // show all members of that group (e.g. searching "john" shows John Wick + his business)
      const matchingGroupIds = await prisma.client.findMany({
        where: {
          ...buildClientScopeFilter(user),
          clientGroupId: { not: null },
          OR: namePhoneFilter,
        },
        select: { clientGroupId: true },
        distinct: ['clientGroupId'],
      })
      const groupIds = matchingGroupIds
        .map(c => c.clientGroupId)
        .filter((id): id is string => id !== null)

      where.OR = [
        ...namePhoneFilter,
        ...(groupIds.length > 0 ? [{ clientGroupId: { in: groupIds } }] : []),
      ]
    }
  }

  // Managed By filter (admin only — non-admins already scoped by buildClientScopeFilter)
  if (managedById && isAdmin) {
    where.managedById = managedById
  }

  if (tag) {
    where.tags = { has: tag }
  }

  // Filter by client type (entity separation)
  if (clientType) {
    where.clientType = clientType
  }

  const orderBy = { createdAt: 'desc' as const }

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
        // Include managing staff for list view
        managedBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
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
                magicLinks: { where: { isActive: true } },
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
            },
          }
        }
      },
    }),
    prisma.client.count({ where }),
  ])

  // Compute upload stats per client using raw SQL for efficiency
  // Counts new uploads (no DocumentView for current staff) and total uploads
  const clientIds = clients.map(c => c.id)
  let uploadStatsMap = new Map<string, ClientUploads>()

  if (clientIds.length > 0 && user.staffId) {
    const uploadStats = await prisma.$queryRaw<Array<{
      clientId: string
      totalCount: bigint
      newCount: bigint
      latestAt: Date | null
    }>>`
      SELECT
        c.id as "clientId",
        COUNT(ri.id) as "totalCount",
        COUNT(ri.id) FILTER (WHERE dv.id IS NULL) as "newCount",
        MAX(ri."createdAt") as "latestAt"
      FROM "Client" c
      LEFT JOIN "TaxCase" tc ON tc."clientId" = c.id
      LEFT JOIN "RawImage" ri ON ri."caseId" = tc.id
      LEFT JOIN "DocumentView" dv ON dv."rawImageId" = ri.id AND dv."staffId" = ${user.staffId}
      WHERE c.id IN (${Prisma.join(clientIds)})
      GROUP BY c.id
    `

    uploadStatsMap = new Map(
      uploadStats.map(s => [s.clientId, {
        // Cap at 9999 for display (bigint safety)
        newCount: Math.min(Number(s.newCount), 9999),
        totalCount: Math.min(Number(s.totalCount), 9999),
        latestAt: s.latestAt ? s.latestAt.toISOString() : null,
      }])
    )
  }

  // Transform to ClientWithActions
  const data: ClientWithActions[] = await Promise.all(clients.map(async (client) => {
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

    // Map managed by staff
    const managedBy = client.managedBy
      ? { id: client.managedBy.id, name: client.managedBy.name, avatarUrl: await resolveAvatarUrl(client.managedBy.avatarUrl) }
      : null

    // Map created by staff
    const createdBy = client.createdBy
      ? { id: client.createdBy.id, name: client.createdBy.name }
      : null

    // Get upload stats for this client
    const uploads = uploadStatsMap.get(client.id) ?? { newCount: 0, totalCount: 0, latestAt: null }

    return {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      name: computeDisplayName(client.firstName, client.lastName),
      phone: client.phone,
      email: client.email,
      language: client.language as 'VI' | 'EN',
      source: client.source as ClientSource,
      tags: client.tags,
      clientType: client.clientType,
      clientGroupId: client.clientGroupId,
      businessType: client.businessType,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
      computedStatus: computedStatusValue,
      managedBy,
      createdBy,
      actionCounts,
      uploads,
      hasUploadLink: latestCase ? latestCase._count.magicLinks > 0 : false,
      latestCase: latestCase ? {
        id: latestCase.id,
        taxYear: latestCase.taxYear,
        taxTypes: latestCase.taxTypes as string[],
        isInReview: latestCase.isInReview,
        isFiled: latestCase.isFiled,
        lastActivityAt: latestCase.lastActivityAt.toISOString(),
      } : null,
    }
  }))

  // Compute attention summary from fetched page (max 100 records).
  // Counts reflect current page only — accurate for orgs with <200 clients.
  const STALE_THRESHOLD_DAYS = 7
  const attentionSummary = {
    newUploads: data.filter(c => (c.uploads?.newCount ?? 0) > 0).length,
    needsVerification: data.filter(c => (c.actionCounts?.toVerify ?? 0) > 0).length,
    stale: data.filter(c => (c.actionCounts?.staleDays ?? 0) >= STALE_THRESHOLD_DAYS).length,
    readyForEntry: data.filter(c => c.computedStatus === 'READY_FOR_ENTRY').length,
  }

  // Apply attention filter (post-filter since these are computed fields)
  let filteredData = data
  if (attention) {
    filteredData = data.filter((client) => {
      switch (attention) {
        case 'newUploads':
          return (client.uploads?.newCount ?? 0) > 0
        case 'needsVerification':
          return (client.actionCounts?.toVerify ?? 0) > 0
        case 'stale':
          return (client.actionCounts?.staleDays ?? 0) >= STALE_THRESHOLD_DAYS
        case 'readyForEntry':
          return client.computedStatus === 'READY_FOR_ENTRY'
        default:
          return true
      }
    })
  }

  return c.json({
    data: filteredData,
    pagination: buildPaginationResponse(safePage, safeLimit, attention ? filteredData.length : total),
    attentionSummary,
  })
})

// GET /clients/tags - Get distinct tags for filter dropdown
clientsRoute.get('/tags', async (c) => {
  const user = c.get('user')
  const scopeFilter = buildClientScopeFilter(user)
  const orgId = scopeFilter.organizationId as string
  if (!orgId) {
    return c.json({ success: true, data: [] })
  }
  const result = await prisma.$queryRaw<Array<{ tag: string }>>`
    SELECT DISTINCT unnest(tags) as tag
    FROM "Client"
    WHERE "organizationId" = ${orgId}
    ORDER BY tag
  `
  return c.json({ success: true, data: result.map((r) => r.tag) })
})

// POST /clients - Create new client with profile and tax case
clientsRoute.post('/', zValidator('json', createClientSchema), async (c) => {
  const body = c.req.valid('json')
  const { profile, customMessage, firstName, lastName, clientType, businessType, ein, businessAddress, businessCity, businessState, businessZip, ...clientData } = body
  const user = c.get('user')

  // For BUSINESS clients, firstName = business name, ignore lastName
  const displayName = clientType === 'BUSINESS'
    ? firstName
    : computeDisplayName(firstName, lastName)

  try {
  // Check phone uniqueness among INDIVIDUAL clients in same org
  if (clientType !== 'BUSINESS') {
    const existingClient = await prisma.client.findFirst({
      where: {
        phone: clientData.phone,
        clientType: 'INDIVIDUAL',
        organizationId: user.organizationId,
      },
    })
    if (existingClient) {
      throw new HTTPException(409, { message: 'A client with this phone number already exists' })
    }
  }

  // Create client with profile and tax case in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create client with org scope and managed-by
    const client = await tx.client.create({
      data: {
        firstName,
        lastName: lastName || null,
        name: displayName,  // Computed for backward compatibility
        ...clientData,
        language: clientData.language as Language,
        clientType: clientType as ClientType,
        // Business-specific fields (only set for BUSINESS clients)
        ...(clientType === 'BUSINESS' ? {
          businessType: businessType as BusinessType,
          einEncrypted: ein ? encryptSSN(ein) : undefined,
          businessAddress,
          businessCity,
          businessState,
          businessZip,
        } : {}),
        organizationId: user.organizationId,
        managedById: user.staffId,  // Always set creator as manager
        createdById: user.staffId,  // Track who created this client
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
  // Use client's language preference (from form), not org default
  let smsStatus: { sent: boolean; error?: string } = { sent: false }
  if (isSmsEnabled()) {
    try {
      const smsResult = await sendWelcomeMessage(
        result.taxCase.id,
        result.client.name,
        result.client.phone,
        magicLink,
        result.taxCase.taxYear,
        result.client.language as 'VI' | 'EN',
        customMessage, // Pass custom message from form
        user.staffId
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
        firstName: result.client.firstName,
        lastName: result.client.lastName,
        name: computeDisplayName(result.client.firstName, result.client.lastName),
        phone: result.client.phone,
        email: result.client.email,
        language: result.client.language,
        clientType: result.client.clientType,
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
      managedBy: { select: { id: true, name: true, avatarUrl: true } },
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
      // Include client group with sibling clients for cross-linking (excludes self)
      clientGroup: {
        include: {
          clients: {
            where: { id: { not: id } },
            select: {
              id: true, name: true, clientType: true, phone: true,
              email: true, businessType: true, einEncrypted: true,
              taxCases: {
                orderBy: { taxYear: 'desc' },
                take: 1,
                include: {
                  magicLinks: {
                    where: { isActive: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { token: true },
                  },
                },
              },
            },
          },
        },
      },
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

  // Strip encrypted EIN — send masked version only
  const { einEncrypted, ...clientSafe } = client

  // Mask EIN and build portalUrl/latestCaseId for sibling clients in the group
  const clientGroupSafe = clientSafe.clientGroup
    ? {
        ...clientSafe.clientGroup,
        clients: clientSafe.clientGroup.clients.map(({ einEncrypted: siblingEin, taxCases, ...sibling }) => {
          const siblingCase = taxCases?.[0]
          const siblingMagicLink = siblingCase?.magicLinks?.[0]
          return {
            ...sibling,
            einMasked: maskEIN(siblingEin),
            latestCaseId: siblingCase?.id ?? null,
            portalUrl: siblingMagicLink && portalBaseUrl
              ? `${portalBaseUrl}/u/${siblingMagicLink.token}`
              : null,
          }
        }),
      }
    : null

  return c.json({
    ...clientSafe,
    einMasked: maskEIN(einEncrypted),
    name: computeDisplayName(client.firstName, client.lastName),
    avatarUrl: await resolveAvatarUrl(client.avatarUrl),
    clientGroup: clientGroupSafe,
    managedBy: client.managedBy
      ? { ...client.managedBy, avatarUrl: await resolveAvatarUrl(client.managedBy.avatarUrl) }
      : null,
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
    const smsLanguage = await getOrgSmsLanguage(user.organizationId)
    const result = await sendWelcomeMessage(
      taxCase.id,
      client.name,
      client.phone,
      portalUrl,
      taxCase.taxYear,
      smsLanguage,
      undefined,
      user.staffId
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
      select: { id: true, firstName: true, lastName: true, clientType: true },
    })
    if (!existing) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    // Reject business field updates on INDIVIDUAL clients
    const businessFields = ['businessType', 'ein', 'businessAddress', 'businessCity', 'businessState', 'businessZip'] as const
    const hasBusinessFieldUpdate = businessFields.some((f) => f in body)
    if (hasBusinessFieldUpdate && existing.clientType !== 'BUSINESS') {
      return c.json({ error: 'INVALID_UPDATE', message: 'Business fields can only be set on BUSINESS clients' }, 400)
    }

    // Explicitly pick only allowed fields to prevent mass assignment
    const allowedFields = ['firstName', 'lastName', 'phone', 'email', 'language', 'tags', 'businessType', 'ein', 'businessAddress', 'businessCity', 'businessState', 'businessZip'] as const
    const updateData = pickFields(body, [...allowedFields]) as {
      firstName?: string
      lastName?: string | null
      phone?: string
      email?: string | null
      language?: Language
      tags?: string[]
      businessType?: string
      ein?: string | null
      businessAddress?: string | null
      businessCity?: string | null
      businessState?: string | null
      businessZip?: string | null
    }

    // Normalize tags (consistent with lead tag handling)
    if (updateData.tags) {
      updateData.tags = updateData.tags.map(t => t.trim().toLowerCase())
    }

    // Recompute display name if firstName or lastName changed
    if (updateData.firstName !== undefined || updateData.lastName !== undefined) {
      const newFirstName = updateData.firstName ?? existing.firstName
      const newLastName = updateData.lastName !== undefined ? updateData.lastName : existing.lastName
      ;(updateData as Record<string, unknown>).name = computeDisplayName(newFirstName, newLastName)
    }

    // Build Prisma-compatible update data: encrypt EIN, cast enums
    const prismaUpdateData: Record<string, unknown> = { ...updateData }
    if (updateData.businessType) {
      prismaUpdateData.businessType = updateData.businessType as BusinessType
    }
    if ('ein' in updateData) {
      prismaUpdateData.einEncrypted = updateData.ein ? encryptSSN(updateData.ein) : null
      delete prismaUpdateData.ein
    }

    const client = await prisma.client.update({
      where: { id },
      data: { ...prismaUpdateData, updatedById: user.staffId },
    })

    return c.json({
      ...client,
      name: computeDisplayName(client.firstName, client.lastName),
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

      // Update profile + track who updated the client
      const [updatedProfile] = await Promise.all([
        prisma.clientProfile.update({
          where: { clientId: id },
          data: updateData,
        }),
        prisma.client.update({
          where: { id },
          data: { updatedById: user.staffId },
        }),
      ])

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

// POST /clients/:id/avatar/presigned-url - Get presigned R2 upload URL for avatar
clientsRoute.post(
  '/:id/avatar/presigned-url',
  zValidator('param', clientIdParamSchema),
  zValidator('json', avatarPresignedUrlSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const { contentType, fileSize } = c.req.valid('json')
    const user = c.get('user')

    // Verify access (org + assignment scope)
    const client = await prisma.client.findFirst({
      where: { id, ...buildClientScopeFilter(user) },
      select: { id: true },
    })
    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    // Generate R2 key for client avatar (with correct extension)
    const r2Key = generateClientAvatarKey(id, contentType)

    // Get presigned URL (15 min expiry)
    const uploadUrl = await getSignedUploadUrl(r2Key, contentType, fileSize)
    if (!uploadUrl) {
      return c.json({ error: 'STORAGE_ERROR', message: 'Failed to generate upload URL' }, 500)
    }

    return c.json({ uploadUrl, r2Key })
  }
)

// PATCH /clients/:id/avatar - Confirm avatar upload
clientsRoute.patch(
  '/:id/avatar',
  zValidator('param', clientIdParamSchema),
  zValidator('json', avatarConfirmSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const { r2Key } = c.req.valid('json')
    const user = c.get('user')

    // Verify access (org + assignment scope)
    const client = await prisma.client.findFirst({
      where: { id, ...buildClientScopeFilter(user) },
      select: { id: true },
    })
    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    // Validate r2Key belongs to this client (prevent path traversal)
    if (!r2Key.startsWith(`client-avatars/${id}/`)) {
      return c.json({ error: 'INVALID_KEY', message: 'Avatar key does not belong to this client' }, 400)
    }

    // Store the R2 key directly (not a presigned URL) so it never expires.
    // Fresh presigned URLs are generated on read via resolveAvatarUrl().
    const updated = await prisma.client.update({
      where: { id },
      data: { avatarUrl: r2Key },
      select: { id: true, avatarUrl: true, updatedAt: true },
    })

    return c.json({
      ...updated,
      avatarUrl: await resolveAvatarUrl(updated.avatarUrl),
      updatedAt: updated.updatedAt.toISOString(),
    })
  }
)

// DELETE /clients/:id/avatar - Remove avatar
clientsRoute.delete(
  '/:id/avatar',
  zValidator('param', clientIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const user = c.get('user')

    // Verify access (org + assignment scope)
    const client = await prisma.client.findFirst({
      where: { id, ...buildClientScopeFilter(user) },
      select: { id: true },
    })
    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    // Set avatarUrl to null (optionally could delete from R2, but leaving orphaned is acceptable)
    const updated = await prisma.client.update({
      where: { id },
      data: { avatarUrl: null },
      select: { id: true, avatarUrl: true, updatedAt: true },
    })

    return c.json({
      ...updated,
      updatedAt: updated.updatedAt.toISOString(),
    })
  }
)

// PATCH /clients/:id/notes - Update notes content
clientsRoute.patch(
  '/:id/notes',
  zValidator('param', clientIdParamSchema),
  zValidator('json', updateNotesSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const { notes } = c.req.valid('json')
    const user = c.get('user')

    // Verify access (org + assignment scope)
    const client = await prisma.client.findFirst({
      where: { id, ...buildClientScopeFilter(user) },
      select: { id: true },
    })
    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    // Notes are stored as HTML from Tiptap editor
    // XSS prevention is handled on frontend display (React auto-escapes)
    // We only validate length here - HTML is preserved for rich text formatting
    // Update notes and notesUpdatedAt
    const updated = await prisma.client.update({
      where: { id },
      data: {
        notes: notes.substring(0, 50000), // Truncate to max length
        notesUpdatedAt: new Date(),
      },
      select: { id: true, notes: true, notesUpdatedAt: true, updatedAt: true },
    })

    return c.json({
      ...updated,
      notesUpdatedAt: updated.notesUpdatedAt?.toISOString() ?? null,
      updatedAt: updated.updatedAt.toISOString(),
    })
  }
)

// GET /clients/:id/activity - Get recent activity timeline
clientsRoute.get(
  '/:id/activity',
  zValidator('param', clientIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const user = c.get('user')

    // Verify access (org + assignment scope)
    const client = await prisma.client.findFirst({
      where: { id, ...buildClientScopeFilter(user) },
      select: { id: true },
    })
    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    // Get all tax case IDs for this client
    const taxCases = await prisma.taxCase.findMany({
      where: { clientId: id },
      select: { id: true },
    })
    const caseIds = taxCases.map((tc) => tc.id)

    if (caseIds.length === 0) {
      return c.json({ data: [] })
    }

    // Query multiple sources in parallel
    const [rawImages, messages, taxCaseChanges] = await Promise.all([
      // RawImage uploads - fetch more for batching
      prisma.rawImage.findMany({
        where: { caseId: { in: caseIds } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, createdAt: true },
      }),
      // Messages
      prisma.message.findMany({
        where: { conversation: { caseId: { in: caseIds } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, direction: true, content: true, channel: true, callStatus: true, recordingDuration: true, createdAt: true },
      }),
      // TaxCase status changes (use updatedAt as proxy)
      prisma.taxCase.findMany({
        where: { clientId: id },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, taxYear: true, status: true, updatedAt: true },
      }),
    ])

    // Batch uploads by time bucket (same hour = same batch)
    const getTimeBucket = (date: Date) => {
      const d = new Date(date)
      d.setMinutes(0, 0, 0)
      return d.toISOString()
    }

    const uploadBatches = new Map<string, { count: number; latestAt: Date }>()
    for (const img of rawImages) {
      const bucket = getTimeBucket(img.createdAt)
      const existing = uploadBatches.get(bucket)
      if (existing) {
        existing.count++
        if (img.createdAt > existing.latestAt) existing.latestAt = img.createdAt
      } else {
        uploadBatches.set(bucket, { count: 1, latestAt: img.createdAt })
      }
    }

    // Combine, sort by date desc, limit 10
    type ActivityItem = {
      type: 'upload' | 'message' | 'case_updated'
      id: string
      timestamp: string
      description: string
      count?: number
      channel?: string
      callStatus?: string | null
      recordingDuration?: number | null
      direction?: string
    }

    const activities: ActivityItem[] = [
      // Batched uploads
      ...Array.from(uploadBatches.entries()).map(([bucket, data]) => ({
        type: 'upload' as const,
        id: `upload-batch-${bucket}`,
        timestamp: data.latestAt.toISOString(),
        description: data.count === 1 ? 'Uploaded 1 document' : `Uploaded ${data.count} documents`,
        count: data.count,
      })),
      // Individual messages
      ...messages.map((msg) => ({
        type: 'message' as const,
        id: msg.id,
        timestamp: msg.createdAt.toISOString(),
        description:
          msg.direction === 'INBOUND'
            ? `Client sent: "${(msg.content || '').substring(0, 50)}${(msg.content || '').length > 50 ? '...' : ''}"`
            : `Staff sent: "${(msg.content || '').substring(0, 50)}${(msg.content || '').length > 50 ? '...' : ''}"`,
        channel: msg.channel,
        callStatus: msg.callStatus,
        recordingDuration: msg.recordingDuration,
        direction: msg.direction,
      })),
      // Case updates
      ...taxCaseChanges.map((tc) => ({
        type: 'case_updated' as const,
        id: tc.id,
        timestamp: tc.updatedAt.toISOString(),
        description: `Tax year ${tc.taxYear} updated (status: ${tc.status})`,
      })),
    ]

    // Sort by timestamp desc and take top 10
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    const top10 = activities.slice(0, 10)

    return c.json({ data: top10 })
  }
)

// GET /clients/:id/stats - Get quick stats
clientsRoute.get(
  '/:id/stats',
  zValidator('param', clientIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const user = c.get('user')

    // Verify access (org + assignment scope)
    const client = await prisma.client.findFirst({
      where: { id, ...buildClientScopeFilter(user) },
      select: { id: true },
    })
    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    // Get tax case IDs
    const taxCases = await prisma.taxCase.findMany({
      where: { clientId: id },
      select: { id: true, taxYear: true },
    })
    const caseIds = taxCases.map((tc) => tc.id)
    const taxYears = [...new Set(taxCases.map((tc) => tc.taxYear))].sort((a, b) => b - a)

    // Aggregate queries in parallel
    const [totalFiles, verifiedDocs, totalDocs, lastMessage] = await Promise.all([
      // Count of RawImage
      prisma.rawImage.count({
        where: { caseId: { in: caseIds } },
      }),
      // Verified docs count
      prisma.digitalDoc.count({
        where: { caseId: { in: caseIds }, status: 'VERIFIED' },
      }),
      // Total docs count
      prisma.digitalDoc.count({
        where: { caseId: { in: caseIds } },
      }),
      // Most recent message
      prisma.message.findFirst({
        where: { conversation: { caseId: { in: caseIds } } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ])

    const verifiedPercent = totalDocs > 0 ? Math.round((verifiedDocs / totalDocs) * 100) : 0

    return c.json({
      totalFiles,
      taxYears,
      verifiedPercent,
      lastMessageAt: lastMessage?.createdAt?.toISOString() ?? null,
    })
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

// PATCH /clients/:id/managed-by - Change client manager (admin only)
clientsRoute.patch(
  '/:id/managed-by',
  requireOrgAdmin,
  zValidator('param', clientIdParamSchema),
  zValidator('json', z.object({ staffId: z.string().nullable() })),
  async (c) => {
    const { id } = c.req.valid('param')
    const { staffId } = c.req.valid('json')
    const user = c.get('user')

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id, organizationId: user.organizationId },
      select: { id: true, clientGroupId: true },
    })
    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    // If assigning to a staff, verify they belong to org and are active
    if (staffId) {
      const staff = await prisma.staff.findFirst({
        where: { id: staffId, organizationId: user.organizationId, isActive: true },
      })
      if (!staff) {
        return c.json({ error: 'NOT_FOUND', message: 'Staff not found' }, 404)
      }
    }

    // Use transaction for atomic group update
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.client.update({
        where: { id },
        data: { managedById: staffId },
        include: { managedBy: { select: { id: true, name: true, avatarUrl: true } } },
      })

      // Propagate to all group members if client belongs to a group
      if (client.clientGroupId) {
        const propagateResult = await tx.client.updateMany({
          where: {
            clientGroupId: client.clientGroupId,
            id: { not: id },
            organizationId: user.organizationId,
          },
          data: { managedById: staffId },
        })

        console.log(
          `[managedById sync] Propagated managedById=${staffId ?? 'null'} to ${propagateResult.count} members (group: ${client.clientGroupId})`
        )
      }

      return result
    })

    const managedBy = updated.managedBy
      ? { ...updated.managedBy, avatarUrl: await resolveAvatarUrl(updated.managedBy.avatarUrl) }
      : null
    return c.json({ data: { managedBy } })
  }
)

// POST /clients/:id/send-upload-link - Send upload link SMS to client
clientsRoute.post(
  '/:id/send-upload-link',
  rateLimiter({ keyPrefix: 'send-upload-link', maxRequests: 5, windowMs: 60000 }),
  zValidator('param', clientIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const user = c.get('user')

    // Parse optional custom message from body
    let customMessage: string | undefined
    try {
      const body = await c.req.json()
      customMessage = body?.customMessage
    } catch {
      // No body or invalid JSON - use default template
    }

    if (!user?.organizationId) {
      return c.json({ error: 'No organization' }, 403)
    }

    const client = await prisma.client.findFirst({
      where: { id, ...buildClientScopeFilter(user) },
      select: {
        id: true,
        name: true,
        phone: true,
        language: true,
        clientType: true,
        clientGroupId: true,
        taxCases: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, taxYear: true },
        },
      },
    })

    if (!client) {
      return c.json({ error: 'Client not found' }, 404)
    }

    const latestCase = client.taxCases[0]
    if (!latestCase) {
      return c.json({ error: 'No tax case found' }, 400)
    }

    if (!isSmsEnabled()) {
      return c.json({ error: 'SMS not configured' }, 500)
    }

    // Resolve SMS recipient and target taxCase
    // For business clients with group, redirect to individual's phone + taxCase
    let smsPhone = client.phone
    let smsName = client.name
    let smsLanguage = client.language
    let targetCaseId = latestCase.id

    if (client.clientType === 'BUSINESS' && client.clientGroupId) {
      // Each group has exactly one individual in current data model.
      // orderBy createdAt desc as a safe tiebreaker if multiple exist.
      const individual = await prisma.client.findFirst({
        where: {
          clientGroupId: client.clientGroupId,
          clientType: 'INDIVIDUAL',
          organizationId: user.organizationId,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          phone: true,
          name: true,
          language: true,
          taxCases: {
            where: { taxYear: latestCase.taxYear },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true },
          },
        },
      })
      if (individual) {
        smsPhone = individual.phone
        smsName = individual.name
        smsLanguage = individual.language

        // Use individual's taxCase for magic link so portal uploads go to individual
        const indivCase = individual.taxCases[0]
        if (indivCase) {
          targetCaseId = indivCase.id
          console.log(`[Send Upload Link] Redirected business ${id} → individual case ${indivCase.id}`)
        } else {
          console.warn(`[Send Upload Link] Individual ${individual.id} has no taxCase for year ${latestCase.taxYear} — using business case`)
        }
      } else {
        console.warn(`[Send Upload Link] Business client ${id} in group ${client.clientGroupId} has no individual — falling back to business phone`)
      }
    }

    // createMagicLink returns full URL (e.g., https://portal.ellatax.com/u/abc123)
    const portalUrl = await createMagicLink(targetCaseId)

    try {
      const result = await sendWelcomeMessage(
        targetCaseId,
        smsName,
        smsPhone,
        portalUrl,
        latestCase.taxYear,
        smsLanguage as 'VI' | 'EN',
        customMessage,
        user.staffId,
      )

      if (!result.smsSent) {
        return c.json({ error: result.error || 'Failed to send SMS' }, 500)
      }

      return c.json({ success: true, messageId: result.messageId })
    } catch (error) {
      console.error('[Send Upload Link] Error:', error)
      return c.json({ error: 'Failed to send upload link' }, 500)
    }
  }
)

// ============================================
// POST /clients/create-with-business — Combo: individual + business + group
// ============================================
clientsRoute.post(
  '/create-with-business',
  zValidator('json', createWithBusinessSchema),
  async (c) => {
    const { individual, businesses, groupName, customMessage } = c.req.valid('json')
    const user = c.get('user')

    if (!user.organizationId || !user.staffId) {
      throw new HTTPException(403, { message: 'Organization and staff record required' })
    }

    // Check phone uniqueness for individual client in same org
    const existingClient = await prisma.client.findFirst({
        where: {
          phone: individual.phone,
          clientType: 'INDIVIDUAL',
          organizationId: user.organizationId,
        },
      })
      if (existingClient) {
        throw new HTTPException(409, { message: 'A client with this phone number already exists' })
      }

      const result = await prisma.$transaction(async (tx) => {
        // Create individual client
        const indivName = computeDisplayName(individual.firstName, individual.lastName)
        const individualClient = await tx.client.create({
          data: {
            firstName: individual.firstName,
            lastName: individual.lastName || null,
            name: indivName,
            phone: individual.phone,
            email: individual.email || null,
            language: individual.language as Language,
            clientType: 'INDIVIDUAL' as ClientType,
            organizationId: user.organizationId,
            managedById: user.staffId,
            createdById: user.staffId,
            profile: {
              create: {
                intakeAnswers: {},
              },
            },
          },
          include: { profile: true },
        })

        // Create engagement + tax case for individual
        const { engagementId: indivEngId } = await findOrCreateEngagement(
          tx,
          individualClient.id,
          individual.profile.taxYear,
          null
        )
        const indivCase = await tx.taxCase.create({
          data: {
            clientId: individualClient.id,
            taxYear: individual.profile.taxYear,
            engagementId: indivEngId,
            taxTypes: (individual.profile.taxTypes || ['FORM_1040']) as TaxType[],
            status: 'INTAKE',
          },
        })
        await tx.conversation.create({
          data: { caseId: indivCase.id, lastMessageAt: new Date() },
        })

        // Create business clients (loop over array)
        const businessClients: { id: string; name: string; clientType: ClientType }[] = []
        const bizCaseInfos: { caseId: string; taxTypes: TaxType[]; profileId: string }[] = []
        for (const biz of businesses) {
          const businessClient = await tx.client.create({
            data: {
              firstName: biz.firstName,
              lastName: null,
              name: biz.firstName,
              phone: biz.phone,
              email: biz.email || null,
              language: biz.language as Language,
              clientType: 'BUSINESS' as ClientType,
              businessType: biz.businessType as BusinessType,
              einEncrypted: biz.ein ? encryptSSN(biz.ein) : undefined,
              businessAddress: biz.businessAddress,
              businessCity: biz.businessCity,
              businessState: biz.businessState,
              businessZip: biz.businessZip,
              organizationId: user.organizationId,
              managedById: user.staffId,
              createdById: user.staffId,
              profile: {
                create: {
                  intakeAnswers: {},
                },
              },
            },
            include: { profile: true },
          })

          // Create engagement + tax case for each business
          const { engagementId: bizEngId } = await findOrCreateEngagement(
            tx,
            businessClient.id,
            biz.profile.taxYear,
            null
          )
          const bizTaxTypes = (biz.profile.taxTypes || ['FORM_1120S']) as TaxType[]
          const bizCase = await tx.taxCase.create({
            data: {
              clientId: businessClient.id,
              taxYear: biz.profile.taxYear,
              engagementId: bizEngId,
              taxTypes: bizTaxTypes,
              status: 'INTAKE',
            },
          })
          // Skip conversation for business clients — only individual gets a conversation
          businessClients.push({
            id: businessClient.id,
            name: businessClient.name,
            clientType: businessClient.clientType as ClientType,
          })
          bizCaseInfos.push({
            caseId: bizCase.id,
            taxTypes: bizTaxTypes,
            profileId: businessClient.profile!.id,
          })
        }

        // Create client group linking all
        const bizNames = businesses.map((b) => b.firstName).join(' + ')
        const name = groupName || `${individual.firstName} + ${bizNames}`
        const group = await tx.clientGroup.create({
          data: {
            name,
            organizationId: user.organizationId,
          },
        })

        // Link all clients to the group
        const allClientIds = [individualClient.id, ...businessClients.map((b) => b.id)]
        await tx.client.updateMany({
          where: { id: { in: allClientIds } },
          data: { clientGroupId: group.id },
        })

        return { individualClient, businessClients, bizCaseInfos, group, indivCase }
      })

      // Generate checklists for individual and all business tax cases
      await generateChecklist(
        result.indivCase.id,
        (individual.profile.taxTypes || ['FORM_1040']) as TaxType[],
        result.individualClient.profile!
      )
      for (const bizInfo of result.bizCaseInfos) {
        const bizProfile = await prisma.clientProfile.findUnique({ where: { id: bizInfo.profileId } })
        if (bizProfile) {
          await generateChecklist(bizInfo.caseId, bizInfo.taxTypes, bizProfile)
        }
      }

      // Create magic link and send welcome SMS for individual client
      const magicLink = await createMagicLink(result.indivCase.id)

      let smsStatus: { sent: boolean; error?: string } = { sent: false }
      if (isSmsEnabled()) {
        try {
          const smsResult = await sendWelcomeMessage(
            result.indivCase.id,
            result.individualClient.name,
            result.individualClient.phone,
            magicLink,
            result.indivCase.taxYear,
            result.individualClient.language as 'VI' | 'EN',
            customMessage,
            user.staffId
          )
          smsStatus = { sent: smsResult.smsSent, error: smsResult.error }
        } catch (error) {
          console.error('[Create With Business] Failed to send welcome SMS:', error)
          smsStatus = { sent: false, error: 'SMS_SEND_FAILED' }
        }
      }

      return c.json(
        {
          success: true,
          data: {
            individual: {
              id: result.individualClient.id,
              name: result.individualClient.name,
              clientType: result.individualClient.clientType,
            },
            businesses: result.businessClients,
            group: {
              id: result.group.id,
              name: result.group.name,
            },
            magicLink,
            smsStatus,
          },
        },
        201
      )
    }
  )

// ============================================
// POST /clients/:id/link-business — Link new business to existing individual
// ============================================
clientsRoute.post(
  '/:id/link-business',
  zValidator('param', clientIdParamSchema),
  zValidator('json', linkBusinessSchema),
  async (c) => {
    const { id: clientId } = c.req.valid('param')
    const body = c.req.valid('json')
    const user = c.get('user')

    if (!user.organizationId || !user.staffId) {
      throw new HTTPException(403, { message: 'Organization and staff record required' })
    }

    const scopeFilter = buildClientScopeFilter(user)

    // Verify client exists and belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, ...scopeFilter },
      include: { clientGroup: true },
    })

    if (!client) {
      throw new HTTPException(404, { message: 'Client not found' })
    }

    if (client.clientType !== 'INDIVIDUAL') {
      throw new HTTPException(400, { message: 'Only individual clients can have linked businesses' })
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create business client
      const businessClient = await tx.client.create({
          data: {
            firstName: body.firstName,
            lastName: null,
            name: body.firstName,
            phone: body.phone,
            email: body.email || null,
            language: (body.language || 'VI') as Language,
            clientType: 'BUSINESS' as ClientType,
            businessType: body.businessType as BusinessType,
            einEncrypted: body.ein ? encryptSSN(body.ein) : undefined,
            businessAddress: body.businessAddress,
            businessCity: body.businessCity,
            businessState: body.businessState,
            businessZip: body.businessZip,
            organizationId: user.organizationId,
            managedById: user.staffId,
            createdById: user.staffId,
            profile: {
              create: {
                intakeAnswers: {},
              },
            },
          },
          include: { profile: true },
        })

        // Create engagement + tax case
        const bizTaxTypes = (body.taxTypes || ['FORM_1120S']) as TaxType[]
        const { engagementId } = await findOrCreateEngagement(
          tx,
          businessClient.id,
          body.taxYear,
          null
        )
        const bizCase = await tx.taxCase.create({
          data: {
            clientId: businessClient.id,
            taxYear: body.taxYear,
            engagementId,
            taxTypes: bizTaxTypes,
            status: 'INTAKE',
          },
        })
        // Skip conversation for linked business — individual already has one

        // Get or create client group
        let group = client.clientGroup
        if (!group) {
          group = await tx.clientGroup.create({
            data: {
              name: `${client.name} Group`,
              organizationId: user.organizationId,
            },
          })
          // Link individual to the new group
          await tx.client.update({
            where: { id: clientId },
            data: { clientGroupId: group.id },
          })
        }

        // Link business to group
        await tx.client.update({
          where: { id: businessClient.id },
          data: { clientGroupId: group.id },
        })

        return { businessClient, bizCase, bizTaxTypes, group }
      })

      // Generate checklist for business tax case
      if (result.businessClient.profile) {
        await generateChecklist(
          result.bizCase.id,
          result.bizTaxTypes,
          result.businessClient.profile
        )
      }

      return c.json(
        {
          success: true,
          data: {
            business: {
              id: result.businessClient.id,
              name: result.businessClient.name,
              clientType: result.businessClient.clientType,
            },
            group: {
              id: result.group.id,
              name: result.group.name,
            },
          },
        },
        201
      )
    }
  )

export { clientsRoute }
