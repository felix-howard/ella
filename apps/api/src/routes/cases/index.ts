/**
 * Tax Cases API routes
 * CRUD operations for tax case management
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import {
  getPaginationParams,
  buildPaginationResponse,
} from '../../lib/constants'
import {
  createCaseSchema,
  updateCaseSchema,
  listCasesQuerySchema,
  listImagesQuerySchema,
} from './schemas'
import { generateChecklist } from '../../services/checklist-generator'
import type { TaxType, TaxCaseStatus, RawImageStatus } from '@ella/db'

const casesRoute = new Hono()

// GET /cases - List all cases with filters
casesRoute.get('/', zValidator('query', listCasesQuerySchema), async (c) => {
  const { page, limit, status, taxYear, clientId } = c.req.valid('query')
  const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (taxYear) where.taxYear = taxYear
  if (clientId) where.clientId = clientId

  const [cases, total] = await Promise.all([
    prisma.taxCase.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        _count: {
          select: {
            rawImages: true,
            digitalDocs: true,
            checklistItems: true,
          },
        },
      },
    }),
    prisma.taxCase.count({ where }),
  ])

  return c.json({
    data: cases.map((tc) => ({
      ...tc,
      createdAt: tc.createdAt.toISOString(),
      updatedAt: tc.updatedAt.toISOString(),
    })),
    pagination: buildPaginationResponse(safePage, safeLimit, total),
  })
})

// POST /cases - Create new tax case for existing client
casesRoute.post('/', zValidator('json', createCaseSchema), async (c) => {
  const { clientId, taxYear, taxTypes } = c.req.valid('json')

  // Get client profile for checklist generation
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { profile: true },
  })

  if (!client) {
    return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
  }

  // Create case and conversation in transaction
  const taxCase = await prisma.$transaction(async (tx) => {
    const newCase = await tx.taxCase.create({
      data: {
        clientId,
        taxYear,
        taxTypes: taxTypes as TaxType[],
        status: 'INTAKE',
      },
    })

    await tx.conversation.create({
      data: { caseId: newCase.id },
    })

    return newCase
  })

  // Generate checklist based on profile
  if (client.profile) {
    await generateChecklist(taxCase.id, taxTypes as TaxType[], client.profile)
  }

  return c.json(
    {
      id: taxCase.id,
      clientId: taxCase.clientId,
      taxYear: taxCase.taxYear,
      taxTypes: taxCase.taxTypes,
      status: taxCase.status,
      createdAt: taxCase.createdAt.toISOString(),
    },
    201
  )
})

// GET /cases/:id - Get case details with all relations
casesRoute.get('/:id', async (c) => {
  const id = c.req.param('id')

  const taxCase = await prisma.taxCase.findUnique({
    where: { id },
    include: {
      client: true,
      checklistItems: {
        include: { template: true },
        orderBy: { template: { sortOrder: 'asc' } },
      },
      rawImages: { orderBy: { createdAt: 'desc' } },
      digitalDocs: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!taxCase) {
    return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
  }

  // Calculate stats
  const stats = {
    totalChecklist: taxCase.checklistItems.length,
    completedChecklist: taxCase.checklistItems.filter(
      (item) => item.status === 'VERIFIED'
    ).length,
    pendingVerification: taxCase.digitalDocs.filter(
      (doc) => doc.status === 'EXTRACTED'
    ).length,
    blurryCount: taxCase.rawImages.filter((img) => img.status === 'BLURRY')
      .length,
  }

  return c.json({
    ...taxCase,
    stats,
    createdAt: taxCase.createdAt.toISOString(),
    updatedAt: taxCase.updatedAt.toISOString(),
  })
})

// PATCH /cases/:id - Update case status
casesRoute.patch('/:id', zValidator('json', updateCaseSchema), async (c) => {
  const id = c.req.param('id')
  const { status } = c.req.valid('json')

  const updateData: Record<string, unknown> = {}
  if (status) {
    updateData.status = status as TaxCaseStatus
    // Track completion timestamps
    if (status === 'ENTRY_COMPLETE') {
      updateData.entryCompletedAt = new Date()
    } else if (status === 'FILED') {
      updateData.filedAt = new Date()
    }
  }

  const taxCase = await prisma.taxCase.update({
    where: { id },
    data: updateData,
  })

  return c.json({
    ...taxCase,
    createdAt: taxCase.createdAt.toISOString(),
    updatedAt: taxCase.updatedAt.toISOString(),
  })
})

// GET /cases/:id/checklist - Get checklist items for case
casesRoute.get('/:id/checklist', async (c) => {
  const id = c.req.param('id')

  const items = await prisma.checklistItem.findMany({
    where: { caseId: id },
    include: {
      template: true,
      rawImages: { take: 5 },
      digitalDocs: { take: 5 },
    },
    orderBy: { template: { sortOrder: 'asc' } },
  })

  const summary = {
    missing: items.filter((i) => i.status === 'MISSING').length,
    hasRaw: items.filter((i) => i.status === 'HAS_RAW').length,
    hasDigital: items.filter((i) => i.status === 'HAS_DIGITAL').length,
    verified: items.filter((i) => i.status === 'VERIFIED').length,
    total: items.length,
  }

  return c.json({ items, summary })
})

// GET /cases/:id/images - Get raw images for case
casesRoute.get('/:id/images', zValidator('query', listImagesQuerySchema), async (c) => {
  const id = c.req.param('id')
  const { status } = c.req.valid('query')

  const where: Record<string, unknown> = { caseId: id }
  if (status) where.status = status as RawImageStatus

  const images = await prisma.rawImage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      checklistItem: { include: { template: true } },
    },
  })

  return c.json({
    images: images.map((img) => ({
      ...img,
      createdAt: img.createdAt.toISOString(),
      updatedAt: img.updatedAt.toISOString(),
    })),
  })
})

// GET /cases/:id/docs - Get digital docs for case
casesRoute.get('/:id/docs', async (c) => {
  const id = c.req.param('id')

  const docs = await prisma.digitalDoc.findMany({
    where: { caseId: id },
    orderBy: { createdAt: 'desc' },
    include: {
      rawImage: { select: { id: true, filename: true, r2Key: true } },
    },
  })

  return c.json({
    docs: docs.map((doc) => ({
      ...doc,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    })),
  })
})

export { casesRoute }
