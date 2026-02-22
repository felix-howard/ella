/**
 * Raw Images API routes
 * Classification update and image management operations
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../../lib/db'
import { inngest } from '../../lib/inngest'
import { DOC_TYPE_LABELS_VI } from '../../lib/constants'
import { sanitizeReuploadReason } from '../../lib/validation'
import { sendBlurryResendRequest, isSmsEnabled } from '../../services/sms'
import { deleteFile } from '../../services/storage'
import { updateLastActivity } from '../../services/activity-tracker'
import type { DocType, ChecklistItemStatus, RawImageStatus, Language, DocCategory } from '@ella/db'
import { buildClientScopeFilter } from '../../lib/org-scope'
import type { AuthVariables } from '../../middleware/auth'

const imagesRoute = new Hono<{ Variables: AuthVariables }>()

// Schema for classification update
const updateClassificationSchema = z.object({
  docType: z.string().min(1, 'Doc type is required'),
  action: z.enum(['approve', 'reject']),
})

// Schema for moving image to different checklist item
const moveImageSchema = z.object({
  targetChecklistItemId: z.string().min(1, 'Target checklist item ID is required'),
})

// Schema for request re-upload (Phase 02)
const requestReuploadSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  fields: z.array(z.string()).min(1, 'At least one field is required'),
  sendSms: z.boolean().default(true),
})

// Schema for renaming file
const renameSchema = z.object({
  filename: z.string().min(1, 'Filename is required').max(255, 'Filename too long'),
})

// Schema for changing category
const changeCategorySchema = z.object({
  category: z.enum(['IDENTITY', 'INCOME', 'EXPENSE', 'ASSET', 'EDUCATION', 'HEALTHCARE', 'OTHER']),
})

/**
 * PATCH /images/:id/classification - Update image classification
 * Used by CPA to approve/reject AI classification with optional type change
 */
imagesRoute.patch(
  '/:id/classification',
  zValidator('json', updateClassificationSchema),
  async (c) => {
    const id = c.req.param('id')
    const { docType, action } = c.req.valid('json')
    const user = c.get('user')

    // Find the raw image with case info (org-scoped)
    const rawImage = await prisma.rawImage.findFirst({
      where: { id, taxCase: { client: buildClientScopeFilter(user) } },
      include: { taxCase: true },
    })

    if (!rawImage) {
      return c.json(
        { error: 'NOT_FOUND', message: 'Image not found' },
        404
      )
    }

    if (action === 'approve') {
      // Approve classification - update type and link to checklist
      const result = await prisma.$transaction(async (tx) => {
        // Find matching checklist items, prefer ones with existing images to group docs together
        const checklistItems = await tx.checklistItem.findMany({
          where: {
            caseId: rawImage.caseId,
            template: { docType: docType as DocType },
          },
          include: {
            _count: { select: { rawImages: true } },
          },
          orderBy: { template: { sortOrder: 'asc' } },
        })

        // Prefer item with existing images, otherwise first by sortOrder
        const checklistItem = checklistItems.find(item => item._count.rawImages > 0) || checklistItems[0] || null

        // Update raw image with approved classification
        const updatedImage = await tx.rawImage.update({
          where: { id },
          data: {
            classifiedType: docType as DocType,
            status: 'LINKED' as RawImageStatus,
            aiConfidence: 1.0, // Manual verification = 100% confidence
            checklistItemId: checklistItem?.id || null,
          },
        })

        // Update checklist item status if found
        if (checklistItem) {
          await tx.checklistItem.update({
            where: { id: checklistItem.id },
            data: {
              status: 'HAS_RAW' as ChecklistItemStatus,
              receivedCount: { increment: 1 },
            },
          })
        }

        // Create or update digital doc for OCR processing
        await tx.digitalDoc.upsert({
          where: { rawImageId: id },
          update: {
            docType: docType as DocType,
            status: 'PENDING',
          },
          create: {
            caseId: rawImage.caseId,
            rawImageId: id,
            docType: docType as DocType,
            status: 'PENDING',
            extractedData: {},
            checklistItemId: checklistItem?.id,
          },
        })

        return updatedImage
      })

      // Update case activity timestamp on classification approval
      await updateLastActivity(rawImage.caseId)

      return c.json({
        success: true,
        status: result.status,
        message: 'Classification approved',
      })
    }

    if (action === 'reject') {
      // Reject - mark as needing re-upload and create action
      await prisma.$transaction(async (tx) => {
        // Update raw image status
        await tx.rawImage.update({
          where: { id },
          data: {
            status: 'BLURRY' as RawImageStatus,
            classifiedType: null,
            aiConfidence: null,
          },
        })

        // Create action for follow-up
        await tx.action.create({
          data: {
            caseId: rawImage.caseId,
            type: 'BLURRY_DETECTED',
            priority: 'HIGH',
            title: 'Yêu cầu gửi lại tài liệu',
            description: `Phân loại bị từ chối: ${docType}`,
            metadata: {
              rawImageId: id,
              rejectedDocType: docType,
            },
          },
        })
      })

      return c.json({
        success: true,
        status: 'BLURRY',
        message: 'Classification rejected - resend requested',
      })
    }

    return c.json(
      { error: 'INVALID_ACTION', message: 'Invalid action' },
      400
    )
  }
)

/**
 * POST /images/:id/reclassify - Re-trigger AI classification
 * Used when user wants to retry AI classification for a failed image
 */
imagesRoute.post('/:id/reclassify', async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')

  // Find the raw image (org-scoped)
  const rawImage = await prisma.rawImage.findFirst({
    where: { id, taxCase: { client: buildClientScopeFilter(user) } },
    select: {
      id: true,
      caseId: true,
      r2Key: true,
      mimeType: true,
      status: true,
      classifiedType: true,
      category: true,
    },
  })

  if (!rawImage) {
    return c.json(
      { error: 'NOT_FOUND', message: 'Image not found' },
      404
    )
  }

  // Allow reclassification for:
  // 1. UPLOADED or UNCLASSIFIED images (standard flow)
  // 2. CLASSIFIED images that are in "Other" category (AI re-try)
  const allowedStatuses = ['UPLOADED', 'UNCLASSIFIED']
  const isOtherCategory = rawImage.classifiedType === 'OTHER' || rawImage.category === 'OTHER'
  const canReclassify = allowedStatuses.includes(rawImage.status) ||
    (rawImage.status === 'CLASSIFIED' && isOtherCategory)

  if (!canReclassify) {
    return c.json(
      {
        error: 'INVALID_STATUS',
        message: `Cannot reclassify image with status: ${rawImage.status}`,
      },
      400
    )
  }

  // Reset image for reprocessing
  // For "Other" category docs, also clean up old classification data
  await prisma.$transaction(async (tx) => {
    // Delete any existing DigitalDoc linked to this image
    await tx.digitalDoc.deleteMany({
      where: { rawImageId: id },
    })

    // Reset rawImage to initial state for reprocessing
    await tx.rawImage.update({
      where: { id },
      data: {
        status: 'UPLOADED' as RawImageStatus,
        classifiedType: null,
        category: null,
        aiConfidence: null,
        checklistItemId: null,
      },
    })
  })

  // Re-trigger the classification job via Inngest
  await inngest.send({
    name: 'document/uploaded',
    data: {
      rawImageId: rawImage.id,
      caseId: rawImage.caseId,
      r2Key: rawImage.r2Key,
      mimeType: rawImage.mimeType || 'application/octet-stream',
    },
  })

  return c.json({
    success: true,
    message: 'Reclassification triggered',
    status: 'PROCESSING',
  })
})

/**
 * PATCH /images/:id/move - Move image to a different checklist item
 * Used by CPA to manually group/re-group multi-page documents
 */
imagesRoute.patch(
  '/:id/move',
  zValidator('json', moveImageSchema),
  async (c) => {
    const id = c.req.param('id')
    const { targetChecklistItemId } = c.req.valid('json')
    const user = c.get('user')

    // Find the raw image (org-scoped)
    const rawImage = await prisma.rawImage.findFirst({
      where: { id, taxCase: { client: buildClientScopeFilter(user) } },
      select: {
        id: true,
        caseId: true,
        checklistItemId: true,
        classifiedType: true,
      },
    })

    if (!rawImage) {
      return c.json(
        { error: 'NOT_FOUND', message: 'Image not found' },
        404
      )
    }

    // Find target checklist item and verify it belongs to same case
    const targetItem = await prisma.checklistItem.findUnique({
      where: { id: targetChecklistItemId },
      include: { template: true },
    })

    if (!targetItem) {
      return c.json(
        { error: 'NOT_FOUND', message: 'Target checklist item not found' },
        404
      )
    }

    if (targetItem.caseId !== rawImage.caseId) {
      return c.json(
        { error: 'INVALID_CASE', message: 'Cannot move image to a different case' },
        400
      )
    }

    // Skip if already in target
    if (rawImage.checklistItemId === targetChecklistItemId) {
      return c.json({
        success: true,
        message: 'Image already in target checklist item',
      })
    }

    // Transaction: update image and both checklist items
    await prisma.$transaction(async (tx) => {
      // Decrement count on old checklist item if exists
      if (rawImage.checklistItemId) {
        const oldItem = await tx.checklistItem.findUnique({
          where: { id: rawImage.checklistItemId },
          select: { receivedCount: true },
        })

        if (oldItem) {
          await tx.checklistItem.update({
            where: { id: rawImage.checklistItemId },
            data: {
              receivedCount: Math.max(0, oldItem.receivedCount - 1),
              // Reset status to MISSING if no more images
              ...(oldItem.receivedCount <= 1 && { status: 'MISSING' as ChecklistItemStatus }),
            },
          })
        }
      }

      // Update raw image with new checklist item and doc type
      await tx.rawImage.update({
        where: { id },
        data: {
          checklistItemId: targetChecklistItemId,
          classifiedType: targetItem.template?.docType as DocType,
          status: 'LINKED' as RawImageStatus,
        },
      })

      // Increment count on new checklist item
      await tx.checklistItem.update({
        where: { id: targetChecklistItemId },
        data: {
          receivedCount: { increment: 1 },
          status: 'HAS_RAW' as ChecklistItemStatus,
        },
      })
    })

    return c.json({
      success: true,
      message: 'Image moved successfully',
      newChecklistItemId: targetChecklistItemId,
      newDocType: targetItem.template?.docType,
    })
  }
)

/**
 * POST /images/:id/request-reupload - Request document re-upload
 * Used when document is unreadable/blurry and needs client to resend
 * Optionally sends SMS notification to client
 */
imagesRoute.post(
  '/:id/request-reupload',
  zValidator('json', requestReuploadSchema),
  async (c) => {
    const id = c.req.param('id')
    const { reason, fields, sendSms } = c.req.valid('json')
    const user = c.get('user')

    // Sanitize reason to prevent XSS
    const sanitizedReason = sanitizeReuploadReason(reason)

    // Verify access (org-scoped)
    const accessCheck = await prisma.rawImage.findFirst({
      where: { id, taxCase: { client: buildClientScopeFilter(user) } },
      select: { id: true },
    })
    if (!accessCheck) {
      return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
    }

    // Use transaction for atomic database operations
    const result = await prisma.$transaction(async (tx) => {
      // Find image with case and client info for SMS
      const image = await tx.rawImage.findUnique({
        where: { id },
        include: {
          taxCase: {
            include: {
              client: true,
              magicLinks: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      })

      if (!image) {
        return { error: 'NOT_FOUND' as const }
      }

      // Update image with reupload request tracking
      await tx.rawImage.update({
        where: { id },
        data: {
          reuploadRequested: true,
          reuploadRequestedAt: new Date(),
          reuploadReason: sanitizedReason,
          reuploadFields: fields,
          status: 'BLURRY' as RawImageStatus,
        },
      })

      // Create action for follow-up
      const docTypeLabel = image.classifiedType
        ? DOC_TYPE_LABELS_VI[image.classifiedType] || image.classifiedType
        : 'tài liệu'

      await tx.action.create({
        data: {
          caseId: image.caseId,
          type: 'BLURRY_DETECTED',
          priority: 'HIGH',
          title: 'Yêu cầu gửi lại tài liệu',
          description: `${docTypeLabel}: ${sanitizedReason}. Các trường cần gửi lại: ${fields.join(', ')}`,
          metadata: {
            rawImageId: id,
            docType: image.classifiedType,
            reason: sanitizedReason,
            fields,
          },
        },
      })

      return { success: true, image }
    })

    if ('error' in result) {
      return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
    }

    // Send SMS if requested and configured (outside transaction)
    let smsSent = false
    let smsError: string | undefined

    if (sendSms && isSmsEnabled() && result.image.taxCase?.client) {
      const client = result.image.taxCase.client
      const magicLink = result.image.taxCase.magicLinks[0]

      if (client.phone && magicLink) {
        const portalUrl = process.env.PORTAL_URL || 'http://localhost:5174'
        const fullMagicLink = `${portalUrl}/u/${magicLink.token}/upload`

        // Convert field names to Vietnamese doc type labels for SMS
        const docTypesForSms = result.image.classifiedType
          ? [DOC_TYPE_LABELS_VI[result.image.classifiedType] || result.image.classifiedType]
          : fields

        const smsResult = await sendBlurryResendRequest(
          result.image.caseId,
          client.name,
          client.phone,
          fullMagicLink,
          docTypesForSms,
          (client.language as Language) || 'VI'
        )

        smsSent = smsResult.smsSent
        if (!smsResult.success) {
          smsError = smsResult.error
        }
      }
    }

    return c.json({
      success: true,
      message: 'Reupload requested',
      smsSent,
      smsError,
    })
  }
)

/**
 * PATCH /images/:id/rename - Rename an image file
 * Updates the filename in database (display name only, R2 key unchanged)
 */
imagesRoute.patch(
  '/:id/rename',
  zValidator('json', renameSchema),
  async (c) => {
    const id = c.req.param('id')
    const { filename } = c.req.valid('json')
    const user = c.get('user')

    // Sanitize filename - remove path separators and dangerous chars
    const sanitizedFilename = filename
      .replace(/[/\\:*?"<>|]/g, '_')
      .trim()

    if (!sanitizedFilename) {
      return c.json(
        { error: 'INVALID_FILENAME', message: 'Invalid filename' },
        400
      )
    }

    // Find and update the raw image (org-scoped)
    const rawImage = await prisma.rawImage.findFirst({
      where: { id, taxCase: { client: buildClientScopeFilter(user) } },
      select: { id: true, filename: true },
    })

    if (!rawImage) {
      return c.json(
        { error: 'NOT_FOUND', message: 'Image not found' },
        404
      )
    }

    // Update filename
    const updated = await prisma.rawImage.update({
      where: { id },
      data: { filename: sanitizedFilename },
      select: { id: true, filename: true },
    })

    return c.json({
      success: true,
      id: updated.id,
      filename: updated.filename,
    })
  }
)

/**
 * PATCH /images/:id/category - Change document category
 * Used for drag-and-drop between categories in Files tab
 */
imagesRoute.patch(
  '/:id/category',
  zValidator('json', changeCategorySchema),
  async (c) => {
    const id = c.req.param('id')
    const { category } = c.req.valid('json')
    const user = c.get('user')

    // Find and update the raw image (org-scoped)
    const rawImage = await prisma.rawImage.findFirst({
      where: { id, taxCase: { client: buildClientScopeFilter(user) } },
      select: { id: true, category: true, caseId: true },
    })

    if (!rawImage) {
      return c.json(
        { error: 'NOT_FOUND', message: 'Image not found' },
        404
      )
    }

    // Update category
    const updated = await prisma.rawImage.update({
      where: { id },
      data: { category: category as DocCategory },
      select: { id: true, category: true },
    })

    return c.json({
      success: true,
      id: updated.id,
      category: updated.category,
    })
  }
)

/**
 * DELETE /images/:id - Delete a raw image (for duplicates)
 * Removes from R2 storage and database
 */
imagesRoute.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')

  const image = await prisma.rawImage.findFirst({
    where: { id, taxCase: { client: buildClientScopeFilter(user) } },
    select: { id: true, status: true, r2Key: true, caseId: true },
  })

  if (!image) {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }

  // Delete from R2 storage
  await deleteFile(image.r2Key)

  // Delete from database
  await prisma.rawImage.delete({ where: { id } })

  return c.json({ success: true, message: 'Image deleted' })
})

/**
 * POST /images/:id/classify-anyway - Force classification on duplicate
 * Resets status to UPLOADED and triggers classification pipeline
 * with skipDuplicateCheck flag to avoid re-detecting as duplicate
 */
imagesRoute.post('/:id/classify-anyway', async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')

  const image = await prisma.rawImage.findFirst({
    where: { id, taxCase: { client: buildClientScopeFilter(user) } },
    select: { id: true, status: true, caseId: true, r2Key: true, mimeType: true },
  })

  if (!image) {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }

  if (image.status !== 'DUPLICATE') {
    return c.json(
      { error: 'INVALID_STATUS', message: 'Image is not a duplicate' },
      400
    )
  }

  // Reset to UPLOADED so pipeline will process it
  await prisma.rawImage.update({
    where: { id },
    data: {
      status: 'UPLOADED' as RawImageStatus,
      imageGroupId: null, // Remove from duplicate group
    },
  })

  // Trigger classification via Inngest with skipDuplicateCheck flag
  await inngest.send({
    name: 'document/uploaded',
    data: {
      rawImageId: id,
      caseId: image.caseId,
      r2Key: image.r2Key,
      mimeType: image.mimeType || 'application/octet-stream',
      skipDuplicateCheck: true, // Skip duplicate check on re-classification
    },
  })

  return c.json({ success: true, message: 'Classification started' })
})

/**
 * POST /images/:id/mark-viewed - Mark document as viewed by current staff
 * Creates DocumentView record for per-CPA notification tracking
 * Idempotent - uses upsert to handle concurrent calls
 */
imagesRoute.post('/:id/mark-viewed', async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')

  if (!user.staffId) {
    return c.json({ error: 'STAFF_REQUIRED', message: 'Staff ID required' }, 400)
  }

  // Verify image exists and user has access (org-scoped)
  const image = await prisma.rawImage.findFirst({
    where: {
      id,
      taxCase: {
        client: buildClientScopeFilter(user),
      },
    },
    select: { id: true },
  })

  if (!image) {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }

  // Upsert DocumentView (handles concurrent calls atomically)
  await prisma.documentView.upsert({
    where: {
      staffId_rawImageId: {
        staffId: user.staffId,
        rawImageId: id,
      },
    },
    create: {
      staffId: user.staffId,
      rawImageId: id,
    },
    update: {
      viewedAt: new Date(),
    },
  })

  return c.json({ success: true })
})

export { imagesRoute }
