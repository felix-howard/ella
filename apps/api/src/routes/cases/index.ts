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
  addChecklistItemSchema,
  skipChecklistItemSchema,
  updateChecklistItemNotesSchema,
  caseIdParamSchema,
  groupDocumentsSchema,
} from './schemas'
import { inngest } from '../../lib/inngest'
import { generateChecklist } from '../../services/checklist-generator'
import { getSignedDownloadUrl } from '../../services/storage'
import { findOrCreateEngagement } from '../../services/engagement-helpers'
import type { TaxType, TaxCaseStatus, RawImageStatus, DocType } from '@ella/db'
import type { AuthVariables } from '../../middleware/auth'
import { isValidStatusTransition, getValidNextStatuses } from '@ella/shared'
import { buildNestedClientScope, buildClientScopeFilter } from '../../lib/org-scope'

const casesRoute = new Hono<{ Variables: AuthVariables }>()

// GET /cases - List all cases with filters
casesRoute.get('/', zValidator('query', listCasesQuerySchema), async (c) => {
  const { page, limit, status, taxYear, clientId } = c.req.valid('query')
  const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)
  const user = c.get('user')

  const where: Record<string, unknown> = { ...buildNestedClientScope(user) }
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
  const { clientId, taxYear, taxTypes, engagementId: providedEngagementId } = c.req.valid('json')
  const user = c.get('user')

  // Get client profile for checklist generation (org-scoped)
  const client = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    include: { profile: true },
  })

  if (!client) {
    return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
  }

  // If engagementId provided, validate it belongs to this client
  if (providedEngagementId) {
    const engagement = await prisma.taxEngagement.findUnique({
      where: { id: providedEngagementId },
    })
    if (!engagement || engagement.clientId !== clientId) {
      return c.json({ error: 'INVALID_ENGAGEMENT', message: 'Engagement not found or does not belong to this client' }, 400)
    }
  }

  // Create case and conversation in transaction
  const taxCase = await prisma.$transaction(async (tx) => {
    // Use provided engagementId or find/create one
    let engagementId = providedEngagementId
    if (!engagementId) {
      const result = await findOrCreateEngagement(tx, clientId, taxYear, client.profile)
      engagementId = result.engagementId
    }

    const newCase = await tx.taxCase.create({
      data: {
        clientId,
        taxYear,
        engagementId,
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
      engagementId: taxCase.engagementId,  // Include engagementId in response
      taxYear: taxCase.taxYear,
      taxTypes: taxCase.taxTypes,
      status: taxCase.status,
      createdAt: taxCase.createdAt.toISOString(),
    },
    201
  )
})

// GET /cases/:id - Get case details with all relations
casesRoute.get('/:id', zValidator('param', caseIdParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  const user = c.get('user')

  const taxCase = await prisma.taxCase.findFirst({
    where: { id, ...buildNestedClientScope(user) },
    include: {
      client: true,
      engagement: true,  // Include engagement data for multi-year support
      checklistItems: {
        include: { template: true },
        orderBy: { template: { sortOrder: 'asc' } },
      },
      rawImages: { orderBy: { createdAt: 'desc' } },
      digitalDocs: {
        orderBy: { createdAt: 'desc' },
        include: { rawImage: { select: { id: true, filename: true, r2Key: true, displayName: true, rotation: true } } },
      },
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
    // Ensure both clientId and engagementId are in response for dual-field support
    clientId: taxCase.clientId,
    engagementId: taxCase.engagementId,
    stats,
    createdAt: taxCase.createdAt.toISOString(),
    updatedAt: taxCase.updatedAt.toISOString(),
  })
})

// PATCH /cases/:id - Update case status with transition validation
casesRoute.patch('/:id', zValidator('json', updateCaseSchema), async (c) => {
  const id = c.req.param('id')
  const { status } = c.req.valid('json')
  const user = c.get('user')

  // Fetch current case to validate transition (org-scoped)
  const currentCase = await prisma.taxCase.findFirst({
    where: { id, ...buildNestedClientScope(user) },
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
  const user = c.get('user')

  const taxCase = await prisma.taxCase.findFirst({
    where: { id, ...buildNestedClientScope(user) },
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
  const user = c.get('user')

  // Verify case belongs to user's org
  const caseCheck = await prisma.taxCase.findFirst({
    where: { id, ...buildNestedClientScope(user) },
    select: { id: true },
  })
  if (!caseCheck) {
    return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
  }

  const items = await prisma.checklistItem.findMany({
    where: { caseId: id },
    include: {
      template: true,
      rawImages: {
        orderBy: { createdAt: 'desc' },  // Most recent images first
      },
      digitalDocs: {
        orderBy: { createdAt: 'desc' },  // Most recent docs first
      },
      addedBy: { select: { id: true, name: true } },
      skippedBy: { select: { id: true, name: true } },
    },
    orderBy: { template: { sortOrder: 'asc' } },
  })

  const summary = {
    missing: items.filter((i) => i.status === 'MISSING').length,
    hasRaw: items.filter((i) => i.status === 'HAS_RAW').length,
    hasDigital: items.filter((i) => i.status === 'HAS_DIGITAL').length,
    verified: items.filter((i) => i.status === 'VERIFIED').length,
    notRequired: items.filter((i) => i.status === 'NOT_REQUIRED').length,
    total: items.length,
  }

  return c.json({ items, summary })
})

// GET /cases/:id/images - Get raw images for case (with pagination)
casesRoute.get('/:id/images', zValidator('query', listImagesQuerySchema), async (c) => {
  const id = c.req.param('id')
  const { page, limit, status } = c.req.valid('query')
  const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)
  const user = c.get('user')

  // Verify case belongs to user's org
  const caseCheck = await prisma.taxCase.findFirst({
    where: { id, ...buildNestedClientScope(user) },
    select: { id: true },
  })
  if (!caseCheck) {
    return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
  }

  const where: Record<string, unknown> = { caseId: id }
  if (status) where.status = status as RawImageStatus

  // Include documentViews to determine isNew status per staff member
  const [images, total] = await Promise.all([
    prisma.rawImage.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        checklistItem: { include: { template: true } },
        // Include documentViews for current staff to check isNew
        documentViews: user.staffId ? {
          where: { staffId: user.staffId },
          select: { id: true },
        } : false,
      },
    }),
    prisma.rawImage.count({ where }),
  ])

  return c.json({
    images: images.map((img) => {
      // Check if current staff has viewed this document
      const documentViews = 'documentViews' in img ? img.documentViews : []
      const isNew = Array.isArray(documentViews) && documentViews.length === 0

      return {
        ...img,
        isNew,
        documentViews: undefined, // Don't expose in response
        createdAt: img.createdAt.toISOString(),
        updatedAt: img.updatedAt.toISOString(),
      }
    }),
    pagination: buildPaginationResponse(safePage, safeLimit, total),
  })
})

// GET /cases/:id/docs - Get digital docs for case (with pagination)
casesRoute.get('/:id/docs', zValidator('query', listDocsQuerySchema), async (c) => {
  const id = c.req.param('id')
  const { page, limit } = c.req.valid('query')
  const { skip, page: safePage, limit: safeLimit } = getPaginationParams(page, limit)
  const user = c.get('user')

  // Verify case belongs to user's org
  const caseCheck = await prisma.taxCase.findFirst({
    where: { id, ...buildNestedClientScope(user) },
    select: { id: true },
  })
  if (!caseCheck) {
    return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
  }

  const where = { caseId: id }

  const [docs, total] = await Promise.all([
    prisma.digitalDoc.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        rawImage: { select: { id: true, filename: true, r2Key: true, rotation: true } },
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
  const user = c.get('user')

  const image = await prisma.rawImage.findFirst({
    where: { id: imageId, taxCase: { client: buildClientScopeFilter(user) } },
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

// GET /images/:imageId/file - Proxy endpoint to serve files directly (bypasses CORS)
// Used by PDF.js and other browser-based file viewers
casesRoute.get('/images/:imageId/file', async (c) => {
  const imageId = c.req.param('imageId')
  const user = c.get('user')

  const image = await prisma.rawImage.findFirst({
    where: { id: imageId, taxCase: { client: buildClientScopeFilter(user) } },
    select: { id: true, r2Key: true, filename: true, mimeType: true },
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
      { error: 'STORAGE_ERROR', message: 'Could not fetch file from storage.' },
      500
    )
  }

  try {
    // Fetch the file from R2
    const response = await fetch(signedUrl)
    if (!response.ok) {
      return c.json({ error: 'FETCH_ERROR', message: 'Failed to fetch file from storage' }, 500)
    }

    const arrayBuffer = await response.arrayBuffer()

    // Determine content type
    const contentType = image.mimeType || response.headers.get('content-type') || 'application/octet-stream'

    // Return the file with proper headers
    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(image.filename)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[File Proxy] Failed to fetch file:', imageId, error)
    return c.json({ error: 'PROXY_ERROR', message: 'Failed to proxy file' }, 500)
  }
})

// ============================================
// CHECKLIST ITEM STAFF OVERRIDE ENDPOINTS
// ============================================

// POST /cases/:id/checklist/items - Add manual checklist item
casesRoute.post('/:id/checklist/items', zValidator('json', addChecklistItemSchema), async (c) => {
  const caseId = c.req.param('id')
  const { docType, reason, expectedCount } = c.req.valid('json')
  const user = c.get('user')
  const staffId = user.staffId || null

  // Verify case exists and belongs to user's org
  const taxCase = await prisma.taxCase.findFirst({
    where: { id: caseId, ...buildNestedClientScope(user) },
    select: { id: true },
  })

  if (!taxCase) {
    return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
  }

  // Find template for this docType (use first matching template)
  const template = await prisma.checklistTemplate.findFirst({
    where: { docType: docType as DocType },
  })

  if (!template) {
    return c.json({ error: 'INVALID_DOC_TYPE', message: 'No template found for this document type' }, 400)
  }

  // Check if item already exists for this case+template
  const existingItem = await prisma.checklistItem.findUnique({
    where: {
      caseId_templateId: {
        caseId,
        templateId: template.id,
      },
    },
  })

  if (existingItem) {
    return c.json({ error: 'DUPLICATE', message: 'Checklist item already exists for this document type' }, 409)
  }

  // Create the checklist item
  const item = await prisma.checklistItem.create({
    data: {
      caseId,
      templateId: template.id,
      status: 'MISSING',
      expectedCount: expectedCount ?? 1,
      isManuallyAdded: true,
      addedById: staffId,
      addedReason: reason,
    },
    include: {
      template: true,
      addedBy: { select: { id: true, name: true } },
    },
  })

  return c.json({ data: item }, 201)
})

// PATCH /cases/:id/checklist/items/:itemId/skip - Skip checklist item
casesRoute.patch('/:id/checklist/items/:itemId/skip', zValidator('json', skipChecklistItemSchema), async (c) => {
  const { id: caseId, itemId } = c.req.param()
  const { reason } = c.req.valid('json')
  const user = c.get('user')
  const staffId = user.staffId || null

  // Verify case belongs to user's org
  const caseCheck = await prisma.taxCase.findFirst({
    where: { id: caseId, ...buildNestedClientScope(user) },
    select: { id: true },
  })
  if (!caseCheck) {
    return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
  }

  // Verify item exists and belongs to case
  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, caseId },
  })

  if (!item) {
    return c.json({ error: 'NOT_FOUND', message: 'Checklist item not found' }, 404)
  }

  // Update item to NOT_REQUIRED
  const updatedItem = await prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      status: 'NOT_REQUIRED',
      skippedAt: new Date(),
      skippedById: staffId,
      skippedReason: reason,
    },
    include: {
      template: true,
      skippedBy: { select: { id: true, name: true } },
    },
  })

  return c.json({ data: updatedItem })
})

// PATCH /cases/:id/checklist/items/:itemId/unskip - Restore skipped item
casesRoute.patch('/:id/checklist/items/:itemId/unskip', async (c) => {
  const { id: caseId, itemId } = c.req.param()
  const user = c.get('user')

  // Verify case belongs to user's org
  const caseCheck = await prisma.taxCase.findFirst({
    where: { id: caseId, ...buildNestedClientScope(user) },
    select: { id: true },
  })
  if (!caseCheck) {
    return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
  }

  // Verify item exists and belongs to case
  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, caseId },
  })

  if (!item) {
    return c.json({ error: 'NOT_FOUND', message: 'Checklist item not found' }, 404)
  }

  if (item.status !== 'NOT_REQUIRED') {
    return c.json({ error: 'INVALID_STATE', message: 'Item is not skipped' }, 400)
  }

  // Determine new status based on existing files
  const fileCount = await prisma.rawImage.count({
    where: { checklistItemId: itemId },
  })
  const newStatus = fileCount > 0 ? 'HAS_RAW' : 'MISSING'

  // Restore item
  const updatedItem = await prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      status: newStatus,
      skippedAt: null,
      skippedById: null,
      skippedReason: null,
    },
    include: { template: true },
  })

  return c.json({ data: updatedItem })
})

// PATCH /cases/:id/checklist/items/:itemId/notes - Update item notes
casesRoute.patch('/:id/checklist/items/:itemId/notes', zValidator('json', updateChecklistItemNotesSchema), async (c) => {
  const { id: caseId, itemId } = c.req.param()
  const user = c.get('user')

  // Verify case belongs to user's org
  const caseCheck = await prisma.taxCase.findFirst({
    where: { id: caseId, ...buildNestedClientScope(user) },
    select: { id: true },
  })
  if (!caseCheck) {
    return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
  }
  const { notes } = c.req.valid('json')

  // Verify item exists and belongs to case
  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, caseId },
  })

  if (!item) {
    return c.json({ error: 'NOT_FOUND', message: 'Checklist item not found' }, 404)
  }

  const updatedItem = await prisma.checklistItem.update({
    where: { id: itemId },
    data: { notes },
    include: { template: true },
  })

  return c.json({ data: updatedItem })
})

// ============================================
// STATUS ACTION ENDPOINTS (Computed Status System)
// ============================================

// POST /cases/:id/send-to-review - Move case to REVIEW state
casesRoute.post(
  '/:id/send-to-review',
  zValidator('param', caseIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const user = c.get('user')

    // Verify case exists and check current state (org-scoped)
    const taxCase = await prisma.taxCase.findFirst({
      where: { id, ...buildNestedClientScope(user) },
      select: { isInReview: true, isFiled: true }
    })

    if (!taxCase) {
      return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
    }

    if (taxCase.isFiled) {
      return c.json({ error: 'ALREADY_FILED', message: 'Case is already filed' }, 400)
    }

    if (taxCase.isInReview) {
      return c.json({ error: 'ALREADY_IN_REVIEW', message: 'Case is already in review' }, 400)
    }

    await prisma.taxCase.update({
      where: { id },
      data: {
        isInReview: true,
        lastActivityAt: new Date()
      }
    })

    return c.json({ success: true })
  }
)

// POST /cases/:id/mark-filed - Mark case as filed
casesRoute.post(
  '/:id/mark-filed',
  zValidator('param', caseIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const user = c.get('user')

    const taxCase = await prisma.taxCase.findFirst({
      where: { id, ...buildNestedClientScope(user) },
      select: { isInReview: true, isFiled: true }
    })

    if (!taxCase) {
      return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
    }

    if (taxCase.isFiled) {
      return c.json({ error: 'ALREADY_FILED', message: 'Case is already filed' }, 400)
    }

    await prisma.taxCase.update({
      where: { id },
      data: {
        isFiled: true,
        filedAt: new Date(),
        lastActivityAt: new Date()
      }
    })

    return c.json({ success: true })
  }
)

// POST /cases/:id/reopen - Reopen a filed case (goes back to review)
casesRoute.post(
  '/:id/reopen',
  zValidator('param', caseIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const user = c.get('user')

    const taxCase = await prisma.taxCase.findFirst({
      where: { id, ...buildNestedClientScope(user) },
      select: { isFiled: true }
    })

    if (!taxCase) {
      return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
    }

    if (!taxCase.isFiled) {
      return c.json({ error: 'NOT_FILED', message: 'Case is not filed' }, 400)
    }

    await prisma.taxCase.update({
      where: { id },
      data: {
        isFiled: false,
        isInReview: true, // Go back to review state
        filedAt: null,
        lastActivityAt: new Date()
      }
    })

    return c.json({ success: true })
  }
)

// In-memory rate limiter for group-documents endpoint (per caseId)
// Auto-cleanup after cooldown to prevent memory leak
const groupingInProgress = new Map<string, number>()
const GROUPING_COOLDOWN_MS = 30000 // 30 seconds between triggers for same case

// Cleanup old entries every minute to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [caseId, timestamp] of groupingInProgress.entries()) {
    if (now - timestamp > GROUPING_COOLDOWN_MS) {
      groupingInProgress.delete(caseId)
    }
  }
}, 60000)

// POST /cases/:id/group-documents - Trigger batch document grouping (staff-only)
casesRoute.post(
  '/:id/group-documents',
  zValidator('param', caseIdParamSchema),
  zValidator('json', groupDocumentsSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const { forceRegroup } = c.req.valid('json')
    const user = c.get('user')

    // M1: Staff-only restriction
    if (!user.staffId) {
      return c.json({ error: 'FORBIDDEN', message: 'Only staff can trigger grouping' }, 403)
    }

    // H2: Rate limiting - prevent concurrent triggers for same case
    const lastTrigger = groupingInProgress.get(id)
    if (lastTrigger && Date.now() - lastTrigger < GROUPING_COOLDOWN_MS) {
      const remainingSec = Math.ceil((GROUPING_COOLDOWN_MS - (Date.now() - lastTrigger)) / 1000)
      return c.json({
        error: 'RATE_LIMITED',
        message: `Grouping already in progress. Try again in ${remainingSec}s`
      }, 429)
    }

    // Verify case exists and belongs to user's org
    const taxCase = await prisma.taxCase.findFirst({
      where: { id, ...buildNestedClientScope(user) },
      select: {
        id: true,
        _count: {
          select: {
            rawImages: { where: { status: { in: ['CLASSIFIED', 'LINKED'] } } }
          }
        }
      },
    })

    if (!taxCase) {
      return c.json({ error: 'NOT_FOUND', message: 'Case not found' }, 404)
    }

    // Check if there are documents to group
    const classifiedCount = taxCase._count.rawImages
    if (classifiedCount === 0) {
      return c.json({
        error: 'NO_DOCUMENTS',
        message: 'No classified documents to group'
      }, 400)
    }

    // Set rate limit before triggering
    groupingInProgress.set(id, Date.now())

    // M2: Audit logging
    console.log(`[Manual Grouping] caseId=${id} staffId=${user.staffId} forceRegroup=${forceRegroup} docCount=${classifiedCount}`)

    // Trigger Inngest batch grouping job
    const { ids } = await inngest.send({
      name: 'document/group-batch',
      data: {
        caseId: id,
        forceRegroup,
        triggeredBy: user.staffId,
      },
    })

    return c.json({
      success: true,
      jobId: ids[0],
      documentCount: classifiedCount,
      message: `Grouping started for ${classifiedCount} documents`,
    })
  }
)

export { casesRoute }
