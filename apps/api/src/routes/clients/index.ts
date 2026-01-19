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
import { sanitizeSearchInput, pickFields } from '../../lib/validation'
import {
  createClientSchema,
  updateClientSchema,
  listClientsQuerySchema,
  clientIdParamSchema,
} from './schemas'
import { generateChecklist } from '../../services/checklist-generator'
import { createMagicLink } from '../../services/magic-link'
import { sendWelcomeMessage, isSmsEnabled } from '../../services/sms'
import type { TaxType, Language } from '@ella/db'

const clientsRoute = new Hono()

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

// GET /clients - List all clients with pagination
clientsRoute.get('/', zValidator('query', listClientsQuerySchema), async (c) => {
  const { page, limit, search, status } = c.req.valid('query')
  const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)

  // Build where clause
  const where: Record<string, unknown> = {}

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

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        taxCases: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { status: true, taxYear: true },
        },
      },
    }),
    prisma.client.count({ where }),
  ])

  return c.json({
    data: clients.map((client) => ({
      ...client,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    })),
    pagination: buildPaginationResponse(safePage, safeLimit, total),
  })
})

// POST /clients - Create new client with profile and tax case
clientsRoute.post('/', zValidator('json', createClientSchema), async (c) => {
  const body = c.req.valid('json')
  const { profile, ...clientData } = body

  try {
  // Create client with profile and tax case in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create client
    const client = await tx.client.create({
      data: {
        ...clientData,
        language: clientData.language as Language,
        profile: {
          create: {
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
          },
        },
      },
      include: { profile: true },
    })

    // Create tax case
    const taxCase = await tx.taxCase.create({
      data: {
        clientId: client.id,
        taxYear: profile.taxYear,
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

  const client = await prisma.client.findUnique({
    where: { id },
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

  // Build portal URL from active magic link (require PORTAL_URL in production)
  const latestCase = client.taxCases[0]
  const activeMagicLink = latestCase?.magicLinks?.[0]
  const portalBaseUrl = process.env.PORTAL_URL
  const portalUrl = activeMagicLink && portalBaseUrl
    ? `${portalBaseUrl}/u/${activeMagicLink.token}`
    : null

  // Check SMS configuration status
  const smsEnabled = isSmsEnabled()

  return c.json({
    ...client,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    taxCases: client.taxCases.map((tc) => ({
      ...tc,
      // Exclude magicLinks from response (token is sensitive)
      magicLinks: undefined,
      createdAt: tc.createdAt.toISOString(),
      updatedAt: tc.updatedAt.toISOString(),
    })),
    portalUrl,
    smsEnabled,
  })
})

// POST /clients/:id/resend-sms - Resend welcome SMS with magic link
clientsRoute.post('/:id/resend-sms', zValidator('param', clientIdParamSchema), async (c) => {
  const { id } = c.req.valid('param')

  // Fetch client with latest case and active magic link
  const client = await prisma.client.findUnique({
    where: { id },
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

// DELETE /clients/:id - Delete client
clientsRoute.delete('/:id', zValidator('param', clientIdParamSchema), async (c) => {
  const { id } = c.req.valid('param')

  await prisma.client.delete({ where: { id } })

  return c.json({ success: true, message: 'Client deleted successfully' })
})

export { clientsRoute }
