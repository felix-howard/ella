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
} from './schemas'
import { generateChecklist } from '../../services/checklist-generator'
import { createMagicLink } from '../../services/magic-link'
import { sendWelcomeMessage, isSmsEnabled } from '../../services/sms'
import type { TaxType, Language } from '@ella/db'

const clientsRoute = new Hono()

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

    // Create conversation for the case
    await tx.conversation.create({
      data: { caseId: taxCase.id },
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
})

// GET /clients/:id - Get client details
clientsRoute.get('/:id', async (c) => {
  const id = c.req.param('id')

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      profile: true,
      taxCases: {
        orderBy: { taxYear: 'desc' },
        include: {
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

  return c.json({
    ...client,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    taxCases: client.taxCases.map((tc) => ({
      ...tc,
      createdAt: tc.createdAt.toISOString(),
      updatedAt: tc.updatedAt.toISOString(),
    })),
  })
})

// PATCH /clients/:id - Update client
clientsRoute.patch('/:id', zValidator('json', updateClientSchema), async (c) => {
  const id = c.req.param('id')
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
})

// DELETE /clients/:id - Delete client
clientsRoute.delete('/:id', async (c) => {
  const id = c.req.param('id')

  await prisma.client.delete({ where: { id } })

  return c.json({ success: true, message: 'Client deleted successfully' })
})

export { clientsRoute }
