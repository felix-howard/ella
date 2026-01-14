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
  listDocsQuerySchema,
} from './schemas'
import { generateChecklist } from '../../services/checklist-generator'
import { getSignedDownloadUrl } from '../../services/storage'
import type { TaxType, TaxCaseStatus, RawImageStatus } from '@ella/db'
import { isValidStatusTransition, getValidNextStatuses } from '@ella/shared'

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

// PATCH /cases/:id - Update case status with transition validation
casesRoute.patch('/:id', zValidator('json', updateCaseSchema), async (c) => {
  const id = c.req.param('id')
  const { status } = c.req.valid('json')

  // Fetch current case to validate transition
  const currentCase = await prisma.taxCase.findUnique({
    where: { id },
    select: { status: true },
  })

  if (!currentCase) {
    return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
  }

  // Validate status transition if status is being changed
  if (status && status !== currentCase.status) {
    if (!isValidStatusTransition(currentCase.status as TaxCaseStatus, status as TaxCaseStatus)) {
      const validNext = getValidNextStatuses(currentCase.status as TaxCaseStatus).slice(1)
      return c.json(
        {
          error: 'INVALID_TRANSITION',
          message: `Cannot transition from ${currentCase.status} to ${status}`,
          currentStatus: currentCase.status,
          validTransitions: validNext,
        },
        400
      )
    }
  }

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

// GET /cases/:id/valid-transitions - Get valid status transitions for a case
casesRoute.get('/:id/valid-transitions', async (c) => {
  const id = c.req.param('id')

  const taxCase = await prisma.taxCase.findUnique({
    where: { id },
    select: { status: true },
  })

  if (!taxCase) {
    return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
  }

  const currentStatus = taxCase.status as TaxCaseStatus
  const validTransitions = getValidNextStatuses(currentStatus)

  return c.json({
    currentStatus,
    validTransitions,
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

// GET /cases/:id/images - Get raw images for case (with pagination)
casesRoute.get('/:id/images', zValidator('query', listImagesQuerySchema), async (c) => {
  const id = c.req.param('id')
  const { page, limit, status } = c.req.valid('query')
  const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)

  const where: Record<string, unknown> = { caseId: id }
  if (status) where.status = status as RawImageStatus

  const [images, total] = await Promise.all([
    prisma.rawImage.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        checklistItem: { include: { template: true } },
      },
    }),
    prisma.rawImage.count({ where }),
  ])

  return c.json({
    images: images.map((img) => ({
      ...img,
      createdAt: img.createdAt.toISOString(),
      updatedAt: img.updatedAt.toISOString(),
    })),
    pagination: buildPaginationResponse(safePage, safeLimit, total),
  })
})

// GET /cases/:id/docs - Get digital docs for case (with pagination)
casesRoute.get('/:id/docs', zValidator('query', listDocsQuerySchema), async (c) => {
  const id = c.req.param('id')
  const { page, limit } = c.req.valid('query')
  const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)

  const where = { caseId: id }

  const [docs, total] = await Promise.all([
    prisma.digitalDoc.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        rawImage: { select: { id: true, filename: true, r2Key: true } },
      },
    }),
    prisma.digitalDoc.count({ where }),
  ])

  return c.json({
    docs: docs.map((doc) => ({
      ...doc,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    })),
    pagination: buildPaginationResponse(safePage, safeLimit, total),
  })
})

// GET /images/:imageId/signed-url - Get signed URL for a single image
casesRoute.get('/images/:imageId/signed-url', async (c) => {
  const imageId = c.req.param('imageId')

  const image = await prisma.rawImage.findUnique({
    where: { id: imageId },
    select: { id: true, r2Key: true, filename: true },
  })

  if (!image) {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }

  if (!image.r2Key) {
    return c.json({ error: 'NO_FILE', message: 'Image file not available' }, 404)
  }

  const signedUrl = await getSignedDownloadUrl(image.r2Key)

  if (!signedUrl) {
    return c.json(
      { error: 'STORAGE_ERROR', message: 'Could not generate signed URL. R2 may not be configured.' },
      500
    )
  }

  return c.json({
    id: image.id,
    filename: image.filename,
    url: signedUrl,
    expiresIn: 3600, // 1 hour
  })
})

export { casesRoute }
