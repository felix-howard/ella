/**
 * Raw Images API routes
 * Classification update and image management operations
 */
import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../../lib/db'
import { inngest } from '../../lib/inngest'
import { DOC_TYPE_LABELS_VI } from '../../lib/constants'
import { sanitizeReuploadReason } from '../../lib/validation'
import { sendBlurryResendRequest, isSmsEnabled } from '../../services/sms'
import { deleteFile } from '../../services/storage'
import { updateLastActivity } from '../../services/activity-tracker'
import { ActivityRiskLevel } from '@ella/db'
import type { DocType, ChecklistItemStatus, RawImageStatus, Language, DocCategory } from '@ella/db'
import {
  getAuditRequestContext,
  logStaffActivities,
  logStaffActivity,
} from '../../services/activity-log'
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, ACTIVITY_TARGET_TYPES } from '../../services/activity-actions'
import { refreshIdentityRetentionForImage } from '../../services/identity-doc-retention'
import { buildClientScopeFilter } from '../../lib/org-scope'
import type { AuthVariables } from '../../middleware/auth'

const imagesRoute = new Hono<{ Variables: AuthVariables }>()

type ImageActivityContext = {
  id: string
  caseId: string
  mimeType?: string | null
  status?: string | null
  classifiedType?: string | null
  category?: string | null
  taxCase: {
    client: {
      id: string
      organizationId: string | null
    }
  }
}

async function logImageMutation(
  c: Context<{ Variables: AuthVariables }>,
  user: AuthVariables['user'],
  image: ImageActivityContext,
  input: {
    summary: string
    action: string
    riskLevel?: ActivityRiskLevel
    metadata?: Record<string, unknown>
  }
) {
  if (!user.staffId) return

  await logStaffActivity({
    organizationId: image.taxCase.client.organizationId,
    clientId: image.taxCase.client.id,
    caseId: image.caseId,
    rawImageId: image.id,
    actorStaffId: user.staffId,
    category: ACTIVITY_CATEGORIES.DOCUMENT,
    targetType: ACTIVITY_TARGET_TYPES.RAW_IMAGE,
    targetId: image.id,
    summary: input.summary,
    action: input.action,
    riskLevel: input.riskLevel ?? ActivityRiskLevel.LOW,
    metadata: {
      rawImageId: image.id,
      docType: image.classifiedType,
      category: image.category,
      mimeType: image.mimeType,
      status: image.status,
      ...input.metadata,
    },
    request: getAuditRequestContext(c),
  })
}

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
  category: z.enum([
    'IDENTITY',
    'INCOME',
    'TAX_RETURNS',
    'EXPENSE',
    'ASSET',
    'EDUCATION',
    'HEALTHCARE',
    'OTHER',
  ]),
})

// Schema for batch category change
const batchCategorySchema = z.object({
  imageIds: z
    .array(z.string())
    .min(1, 'At least one image ID required')
    .max(20, 'Maximum 20 images per batch'),
  category: z.enum([
    'IDENTITY',
    'INCOME',
    'TAX_RETURNS',
    'EXPENSE',
    'ASSET',
    'EDUCATION',
    'HEALTHCARE',
    'OTHER',
  ]),
})

// Schema for reassigning entity
const reassignEntitySchema = z.object({
  targetClientId: z.string().cuid('Invalid target client ID'),
})

// Schema for moving doc to a specific TaxCase (multi-entity portal)
const moveToCaseSchema = z.object({
  targetCaseId: z.string().cuid('Invalid target case ID'),
})

// Schema for updating rotation
const updateRotationSchema = z.object({
  rotation: z
    .number()
    .int()
    .refine((val) => [0, 90, 180, 270].includes(val), {
      message: 'Rotation must be 0, 90, 180, or 270',
    }),
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
      include: { taxCase: { include: { client: { select: { id: true, organizationId: true } } } } },
    })

    if (!rawImage) {
      return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
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
        const checklistItem =
          checklistItems.find((item) => item._count.rawImages > 0) || checklistItems[0] || null

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
      await refreshIdentityRetentionForImage(id)
      await logImageMutation(c, user, rawImage, {
        summary: 'Approved document classification',
        action: ACTIVITY_ACTIONS.DOCUMENT.CLASSIFICATION_APPROVED,
        riskLevel: ActivityRiskLevel.MEDIUM,
        metadata: {
          changedFields: ['classifiedType', 'status', 'aiConfidence', 'checklistItemId'],
          newDocType: docType,
        },
      })

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

      await logImageMutation(c, user, rawImage, {
        summary: 'Rejected document classification',
        action: ACTIVITY_ACTIONS.DOCUMENT.CLASSIFICATION_REJECTED,
        riskLevel: ActivityRiskLevel.MEDIUM,
        metadata: {
          changedFields: ['classifiedType', 'status', 'aiConfidence'],
          rejectedDocType: docType,
        },
      })

      return c.json({
        success: true,
        status: 'BLURRY',
        message: 'Classification rejected - resend requested',
      })
    }

    return c.json({ error: 'INVALID_ACTION', message: 'Invalid action' }, 400)
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
      taxCase: {
        select: {
          client: { select: { id: true, organizationId: true } },
        },
      },
    },
  })

  if (!rawImage) {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }

  // Allow reclassification for:
  // 1. UPLOADED or UNCLASSIFIED images (standard flow)
  // 2. CLASSIFIED images that are in "Other" category (AI re-try)
  const allowedStatuses = ['UPLOADED', 'UNCLASSIFIED']
  const isOtherCategory = rawImage.classifiedType === 'OTHER' || rawImage.category === 'OTHER'
  const canReclassify =
    allowedStatuses.includes(rawImage.status) ||
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

  await logImageMutation(c, user, rawImage, {
    summary: 'Triggered document reclassification',
    action: ACTIVITY_ACTIONS.DOCUMENT.RECLASSIFY_TRIGGERED,
    riskLevel: ActivityRiskLevel.MEDIUM,
    metadata: {
      changedFields: ['status', 'classifiedType', 'category', 'aiConfidence', 'checklistItemId'],
      previousStatus: rawImage.status,
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
imagesRoute.patch('/:id/move', zValidator('json', moveImageSchema), async (c) => {
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
      status: true,
      category: true,
      mimeType: true,
      taxCase: {
        select: {
          client: { select: { id: true, organizationId: true } },
        },
      },
    },
  })

  if (!rawImage) {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }

  // Find target checklist item and verify it belongs to same case
  const targetItem = await prisma.checklistItem.findUnique({
    where: { id: targetChecklistItemId },
    include: { template: true },
  })

  if (!targetItem) {
    return c.json({ error: 'NOT_FOUND', message: 'Target checklist item not found' }, 404)
  }

  if (targetItem.caseId !== rawImage.caseId) {
    return c.json({ error: 'INVALID_CASE', message: 'Cannot move image to a different case' }, 400)
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

  await logImageMutation(c, user, rawImage, {
    summary: 'Moved document to checklist item',
    action: ACTIVITY_ACTIONS.DOCUMENT.MOVED,
    riskLevel: ActivityRiskLevel.LOW,
    metadata: {
      changedFields: ['checklistItemId', 'classifiedType', 'status'],
      previousChecklistItemId: rawImage.checklistItemId,
      newChecklistItemId: targetChecklistItemId,
      newDocType: targetItem.template?.docType,
    },
  })

  return c.json({
    success: true,
    message: 'Image moved successfully',
    newChecklistItemId: targetChecklistItemId,
    newDocType: targetItem.template?.docType,
  })
})

/**
 * POST /images/:id/request-reupload - Request document re-upload
 * Used when document is unreadable/blurry and needs client to resend
 * Optionally sends SMS notification to client
 */
imagesRoute.post('/:id/request-reupload', zValidator('json', requestReuploadSchema), async (c) => {
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
              // Only PORTAL — blurry resend SMS must reuse the upload portal.
              where: { isActive: true, type: 'PORTAL' },
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
        (client.language as Language) || 'VI',
        user.staffId
      )

      smsSent = smsResult.smsSent
      if (!smsResult.success) {
        smsError = smsResult.error
      }
    }
  }

  await logImageMutation(c, user, result.image, {
    summary: 'Requested document reupload',
    action: ACTIVITY_ACTIONS.DOCUMENT.REUPLOAD_REQUESTED,
    riskLevel: ActivityRiskLevel.MEDIUM,
    metadata: {
      changedFields: ['reuploadRequested', 'reuploadRequestedAt', 'reuploadFields', 'status'],
      reuploadFieldCount: fields.length,
      smsSent,
    },
  })

  return c.json({
    success: true,
    message: 'Reupload requested',
    smsSent,
    smsError,
  })
})

/**
 * PATCH /images/:id/rename - Rename an image file
 * Updates the filename in database (display name only, R2 key unchanged)
 */
imagesRoute.patch('/:id/rename', zValidator('json', renameSchema), async (c) => {
  const id = c.req.param('id')
  const { filename } = c.req.valid('json')
  const user = c.get('user')

  // Sanitize filename - remove path separators and dangerous chars
  const sanitizedFilename = filename.replace(/[/\\:*?"<>|]/g, '_').trim()

  if (!sanitizedFilename) {
    return c.json({ error: 'INVALID_FILENAME', message: 'Invalid filename' }, 400)
  }

  // Find and update the raw image (org-scoped)
  const rawImage = await prisma.rawImage.findFirst({
    where: { id, taxCase: { client: buildClientScopeFilter(user) } },
    select: {
      id: true,
      caseId: true,
      filename: true,
      mimeType: true,
      status: true,
      classifiedType: true,
      category: true,
      taxCase: { select: { client: { select: { id: true, organizationId: true } } } },
    },
  })

  if (!rawImage) {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }

  // Update displayName (user-visible name shown in UI)
  // Note: `filename` is the original upload name, `displayName` is what's shown in UI
  const updated = await prisma.rawImage.update({
    where: { id },
    data: { displayName: sanitizedFilename },
    select: { id: true, filename: true, displayName: true },
  })

  await logImageMutation(c, user, rawImage, {
    summary: 'Renamed document',
    action: ACTIVITY_ACTIONS.DOCUMENT.UPDATED,
    riskLevel: ActivityRiskLevel.LOW,
    metadata: { changedFields: ['displayName'] },
  })

  return c.json({
    success: true,
    id: updated.id,
    filename: updated.displayName || updated.filename,
    displayName: updated.displayName,
  })
})

/**
 * PATCH /images/:id/category - Change document category
 * Used for drag-and-drop between categories in Files tab
 */
imagesRoute.patch('/:id/category', zValidator('json', changeCategorySchema), async (c) => {
  const id = c.req.param('id')
  const { category } = c.req.valid('json')
  const user = c.get('user')

  // Find and update the raw image (org-scoped)
  const rawImage = await prisma.rawImage.findFirst({
    where: { id, taxCase: { client: buildClientScopeFilter(user) } },
    select: {
      id: true,
      category: true,
      caseId: true,
      mimeType: true,
      status: true,
      classifiedType: true,
      taxCase: { select: { client: { select: { id: true, organizationId: true } } } },
    },
  })

  if (!rawImage) {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }

  // Update category
  const updated = await prisma.rawImage.update({
    where: { id },
    data: { category: category as DocCategory },
    select: { id: true, category: true },
  })
  await refreshIdentityRetentionForImage(id)

  await logImageMutation(c, user, rawImage, {
    summary: 'Updated document category',
    action: ACTIVITY_ACTIONS.DOCUMENT.UPDATED,
    riskLevel: ActivityRiskLevel.LOW,
    metadata: {
      changedFields: ['category'],
      previousCategory: rawImage.category,
      newCategory: updated.category,
    },
  })

  return c.json({
    success: true,
    id: updated.id,
    category: updated.category,
  })
})

/**
 * PATCH /images/batch-category - Change category for multiple images
 * Used for group drag-and-drop in Files tab (multi-page documents)
 */
imagesRoute.patch('/batch-category', zValidator('json', batchCategorySchema), async (c) => {
  const { imageIds, category } = c.req.valid('json')
  const user = c.get('user')

  // Verify all images exist and user has access (org-scoped)
  const images = await prisma.rawImage.findMany({
    where: {
      id: { in: imageIds },
      taxCase: { client: buildClientScopeFilter(user) },
    },
    select: {
      id: true,
      caseId: true,
      mimeType: true,
      status: true,
      classifiedType: true,
      category: true,
      taxCase: { select: { client: { select: { id: true, organizationId: true } } } },
    },
  })

  if (images.length !== imageIds.length) {
    return c.json({ error: 'FORBIDDEN', message: 'Some images not found or not accessible' }, 403)
  }

  // Batch update category for all images
  const result = await prisma.rawImage.updateMany({
    where: { id: { in: imageIds } },
    data: { category: category as DocCategory },
  })
  await Promise.all(imageIds.map((imageId) => refreshIdentityRetentionForImage(imageId)))

  void logStaffActivities(
    images.map((image) => ({
      organizationId: image.taxCase.client.organizationId,
      clientId: image.taxCase.client.id,
      caseId: image.caseId,
      rawImageId: image.id,
      actorStaffId: user.staffId ?? '',
      category: ACTIVITY_CATEGORIES.DOCUMENT,
      targetType: ACTIVITY_TARGET_TYPES.RAW_IMAGE,
      targetId: image.id,
      summary: 'Updated document category',
      action: ACTIVITY_ACTIONS.DOCUMENT.UPDATED,
      riskLevel: ActivityRiskLevel.LOW,
      metadata: {
        rawImageId: image.id,
        docType: image.classifiedType,
        previousCategory: image.category,
        newCategory: category,
        batch: true,
      },
      request: getAuditRequestContext(c),
    })).filter((input) => input.actorStaffId)
  )

  return c.json({
    success: true,
    updated: result.count,
  })
})

/**
 * DELETE /images/:id - Delete a raw image (for duplicates)
 * Removes from R2 storage and database
 */
imagesRoute.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')
  const staffId = user.staffId

  if (!staffId) {
    return c.json({ error: 'STAFF_REQUIRED', message: 'Staff ID required' }, 400)
  }

  const image = await prisma.rawImage.findFirst({
    where: { id, taxCase: { client: buildClientScopeFilter(user) } },
    select: {
      id: true,
      status: true,
      r2Key: true,
      caseId: true,
      mimeType: true,
      classifiedType: true,
      category: true,
      taxCase: {
        select: {
          client: { select: { id: true, organizationId: true } },
        },
      },
    },
  })

  if (!image) {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }

  // Delete from R2 storage
  await deleteFile(image.r2Key)

  // Delete from database
  await prisma.rawImage.delete({ where: { id } })

  void logStaffActivity({
    organizationId: image.taxCase.client.organizationId,
    clientId: image.taxCase.client.id,
    caseId: image.caseId,
    rawImageId: image.id,
    actorStaffId: staffId,
    category: ACTIVITY_CATEGORIES.DOCUMENT,
    targetType: ACTIVITY_TARGET_TYPES.RAW_IMAGE,
    targetId: image.id,
    summary: 'Deleted document file',
    action: ACTIVITY_ACTIONS.DOCUMENT.DELETED,
    riskLevel: ActivityRiskLevel.HIGH,
    metadata: {
      rawImageId: image.id,
      docType: image.classifiedType,
      category: image.category,
      mimeType: image.mimeType,
      status: image.status,
    },
    request: getAuditRequestContext(c),
  })

  return c.json({ success: true, message: 'Image deleted' })
})

/**
 * POST /images/:id/classify-anyway - Force re-classification
 * Resets status to UPLOADED and triggers classification pipeline
 */
imagesRoute.post('/:id/classify-anyway', async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')

  const image = await prisma.rawImage.findFirst({
    where: { id, taxCase: { client: buildClientScopeFilter(user) } },
    select: {
      id: true,
      status: true,
      caseId: true,
      r2Key: true,
      mimeType: true,
      classifiedType: true,
      category: true,
      taxCase: { select: { client: { select: { id: true, organizationId: true } } } },
    },
  })

  if (!image) {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }

  // Reset to UPLOADED so pipeline will process it
  await prisma.rawImage.update({
    where: { id },
    data: {
      status: 'UPLOADED' as RawImageStatus,
      imageGroupId: null,
    },
  })

  // Trigger classification via Inngest
  await inngest.send({
    name: 'document/uploaded',
    data: {
      rawImageId: id,
      caseId: image.caseId,
      r2Key: image.r2Key,
      mimeType: image.mimeType || 'application/octet-stream',
    },
  })

  await logImageMutation(c, user, image, {
    summary: 'Forced document classification',
    action: ACTIVITY_ACTIONS.DOCUMENT.RECLASSIFY_TRIGGERED,
    riskLevel: ActivityRiskLevel.MEDIUM,
    metadata: {
      changedFields: ['status', 'imageGroupId'],
      previousStatus: image.status,
    },
  })

  return c.json({ success: true, message: 'Classification started' })
})

/**
 * POST /images/batch-mark-viewed - Mark multiple documents as viewed by current staff
 * Creates DocumentView records for per-CPA notification tracking
 * Used by "Mark all as read" feature in Files tab
 */
imagesRoute.post('/batch-mark-viewed', async (c) => {
  const user = c.get('user')
  const staffId = user.staffId

  if (!staffId) {
    return c.json({ error: 'STAFF_REQUIRED', message: 'Staff ID required' }, 400)
  }

  const body = await c.req.json<{ imageIds: string[] }>()
  const { imageIds } = body

  if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
    return c.json({ error: 'INVALID_INPUT', message: 'imageIds array required' }, 400)
  }

  // Limit batch size to prevent abuse
  if (imageIds.length > 500) {
    return c.json({ error: 'BATCH_TOO_LARGE', message: 'Maximum 500 images per batch' }, 400)
  }

  // Verify all images exist and user has access (org-scoped)
  const validImages = await prisma.rawImage.findMany({
    where: {
      id: { in: imageIds },
      taxCase: {
        client: buildClientScopeFilter(user),
      },
    },
    select: {
      id: true,
      caseId: true,
      mimeType: true,
      status: true,
      classifiedType: true,
      category: true,
      taxCase: {
        select: {
          client: { select: { id: true, organizationId: true } },
        },
      },
    },
  })

  const validImageIds = validImages.map((img) => img.id)

  if (validImageIds.length === 0) {
    return c.json({ success: true, marked: 0 })
  }

  // Batch upsert DocumentView records
  // Using createMany with skipDuplicates for efficiency
  await prisma.documentView.createMany({
    data: validImageIds.map((rawImageId) => ({
      staffId,
      rawImageId,
    })),
    skipDuplicates: true,
  })

  void logStaffActivities(
    validImages.map((image) => ({
      organizationId: image.taxCase.client.organizationId,
      clientId: image.taxCase.client.id,
      caseId: image.caseId,
      rawImageId: image.id,
      actorStaffId: staffId,
      category: ACTIVITY_CATEGORIES.DOCUMENT,
      targetType: ACTIVITY_TARGET_TYPES.RAW_IMAGE,
      targetId: image.id,
      summary: 'Marked document viewed',
      action: ACTIVITY_ACTIONS.DOCUMENT.MARKED_VIEWED,
      riskLevel: ActivityRiskLevel.LOW,
      metadata: {
        rawImageId: image.id,
        docType: image.classifiedType,
        category: image.category,
        mimeType: image.mimeType,
        status: image.status,
        batch: true,
      },
      request: getAuditRequestContext(c),
    }))
  )

  return c.json({ success: true, marked: validImageIds.length })
})

/**
 * POST /images/:id/mark-viewed - Mark document as viewed by current staff
 * Creates DocumentView record for per-CPA notification tracking
 * Idempotent - uses upsert to handle concurrent calls
 */
imagesRoute.post('/:id/mark-viewed', async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')
  const staffId = user.staffId

  if (!staffId) {
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
    select: {
      id: true,
      caseId: true,
      mimeType: true,
      status: true,
      classifiedType: true,
      category: true,
      taxCase: {
        select: {
          client: { select: { id: true, organizationId: true } },
        },
      },
    },
  })

  if (!image) {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }

  // Upsert DocumentView (handles concurrent calls atomically)
  await prisma.documentView.upsert({
    where: {
      staffId_rawImageId: {
        staffId,
        rawImageId: id,
      },
    },
    create: {
      staffId,
      rawImageId: id,
    },
    update: {
      viewedAt: new Date(),
    },
  })

  void logStaffActivity({
    organizationId: image.taxCase.client.organizationId,
    clientId: image.taxCase.client.id,
    caseId: image.caseId,
    rawImageId: image.id,
    actorStaffId: staffId,
    category: ACTIVITY_CATEGORIES.DOCUMENT,
    targetType: ACTIVITY_TARGET_TYPES.RAW_IMAGE,
    targetId: image.id,
    summary: 'Marked document viewed',
    action: ACTIVITY_ACTIONS.DOCUMENT.MARKED_VIEWED,
    riskLevel: ActivityRiskLevel.LOW,
    metadata: {
      rawImageId: image.id,
      docType: image.classifiedType,
      category: image.category,
      mimeType: image.mimeType,
      status: image.status,
    },
    request: getAuditRequestContext(c),
  })

  return c.json({ success: true })
})

/**
 * PATCH /images/:id/reassign-entity - Reassign document to another entity
 * Moves document from one entity's TaxCase to another within the same ClientGroup
 */
imagesRoute.patch('/:id/reassign-entity', zValidator('json', reassignEntitySchema), async (c) => {
  const id = c.req.param('id')
  const { targetClientId } = c.req.valid('json')
  const user = c.get('user')

  // 1. Fetch image with only needed fields
  const rawImage = await prisma.rawImage.findFirst({
    where: { id, taxCase: { client: buildClientScopeFilter(user) } },
    select: {
      id: true,
      caseId: true,
      checklistItemId: true,
      mimeType: true,
      status: true,
      classifiedType: true,
      category: true,
      taxCase: {
        select: {
          taxYear: true,
          client: { select: { id: true, organizationId: true, clientGroupId: true } },
        },
      },
    },
  })

  if (!rawImage) {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }

  // 2. Validate client is in a group
  const currentGroupId = rawImage.taxCase.client.clientGroupId
  if (!currentGroupId) {
    return c.json({ error: 'NO_GROUP', message: 'Client is not in a group' }, 400)
  }

  // 3. Early exit if reassigning to same client
  if (rawImage.taxCase.client.id === targetClientId) {
    return c.json({ success: true, message: 'Already in target entity' })
  }

  // 4. Validate target is in same group and has a TaxCase for the same year
  const targetClient = await prisma.client.findFirst({
    where: {
      id: targetClientId,
      clientGroupId: currentGroupId,
      ...buildClientScopeFilter(user),
    },
    include: {
      taxCases: {
        where: { taxYear: rawImage.taxCase.taxYear },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!targetClient || targetClient.taxCases.length === 0) {
    return c.json(
      {
        error: 'INVALID_TARGET',
        message: 'Target client not found in same group or has no case for this tax year',
      },
      400
    )
  }

  const targetCaseId = targetClient.taxCases[0].id

  // 5. Update in transaction: move image + clean up old checklist item
  const updated = await prisma.$transaction(async (tx) => {
    // Decrement old checklist item count if linked
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
            ...(oldItem.receivedCount <= 1 && { status: 'MISSING' as ChecklistItemStatus }),
          },
        })
      }
    }

    return tx.rawImage.update({
      where: { id },
      data: {
        caseId: targetCaseId,
        routedFromCaseId: rawImage.caseId,
        entityConfidence: null, // Manual override
        checklistItemId: null, // Detach from old case's checklist
      },
      select: { id: true, caseId: true, routedFromCaseId: true },
    })
  })

  await refreshIdentityRetentionForImage(id)

  await logImageMutation(c, user, rawImage, {
    summary: 'Reassigned document entity',
    action: ACTIVITY_ACTIONS.DOCUMENT.MOVED,
    riskLevel: ActivityRiskLevel.MEDIUM,
    metadata: {
      changedFields: ['caseId', 'routedFromCaseId', 'entityConfidence', 'checklistItemId'],
      fromCaseId: rawImage.caseId,
      toCaseId: targetCaseId,
      targetClientId,
    },
  })

  return c.json({
    success: true,
    id: updated.id,
    caseId: updated.caseId,
    routedFromCaseId: updated.routedFromCaseId,
  })
})

/**
 * PATCH /images/:id/rotation - Update image rotation
 * Persists rotation (0, 90, 180, 270) so documents display correctly on re-open
 */
imagesRoute.patch('/:id/rotation', zValidator('json', updateRotationSchema), async (c) => {
  const id = c.req.param('id')
  const { rotation } = c.req.valid('json')
  const user = c.get('user')

  // Find and update the raw image (org-scoped)
  const rawImage = await prisma.rawImage.findFirst({
    where: { id, taxCase: { client: buildClientScopeFilter(user) } },
    select: {
      id: true,
      caseId: true,
      mimeType: true,
      status: true,
      classifiedType: true,
      category: true,
      taxCase: { select: { client: { select: { id: true, organizationId: true } } } },
    },
  })

  if (!rawImage) {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }

  // Update rotation
  const updated = await prisma.rawImage.update({
    where: { id },
    data: { rotation },
    select: { id: true, rotation: true },
  })

  await logImageMutation(c, user, rawImage, {
    summary: 'Rotated document',
    action: ACTIVITY_ACTIONS.DOCUMENT.UPDATED,
    riskLevel: ActivityRiskLevel.LOW,
    metadata: {
      changedFields: ['rotation'],
      rotation: updated.rotation,
    },
  })

  return c.json({
    success: true,
    id: updated.id,
    rotation: updated.rotation,
  })
})

/**
 * POST /images/:id/move-to-case - Move a RawImage to a different TaxCase in same group
 * Owner-explicit alternative to /reassign-entity: caller targets a specific case (not a client)
 * Writes audit Action on destination case so CPA sees the move in the action queue
 */
imagesRoute.post('/:id/move-to-case', zValidator('json', moveToCaseSchema), async (c) => {
  const id = c.req.param('id')
  const { targetCaseId } = c.req.valid('json')
  const user = c.get('user')

  // Load source image (org-scoped via case→client)
  const rawImage = await prisma.rawImage.findFirst({
    where: { id, taxCase: { client: buildClientScopeFilter(user) } },
    select: {
      id: true,
      caseId: true,
      checklistItemId: true,
      mimeType: true,
      status: true,
      classifiedType: true,
      category: true,
      taxCase: {
        select: {
          client: {
            select: {
              id: true,
              organizationId: true,
              clientGroupId: true,
              clientGroup: { select: { organizationId: true } },
            },
          },
        },
      },
    },
  })

  if (!rawImage) {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }

  const sourceGroupId = rawImage.taxCase.client.clientGroupId
  const sourceOrgId = rawImage.taxCase.client.clientGroup?.organizationId

  if (!sourceGroupId || !sourceOrgId) {
    return c.json({ error: 'NO_GROUP', message: 'Source case is not in a client group' }, 400)
  }

  // Early exit if already on target case
  if (rawImage.caseId === targetCaseId) {
    return c.json({ moved: false, reason: 'ALREADY_ON_TARGET' })
  }

  // Validate target case is in same group + org
  const targetCase = await prisma.taxCase.findFirst({
    where: {
      id: targetCaseId,
      client: {
        clientGroupId: sourceGroupId,
        clientGroup: { organizationId: sourceOrgId },
      },
    },
    select: { id: true },
  })

  if (!targetCase) {
    return c.json(
      { error: 'INVALID_TARGET_CASE', message: 'Target case not in same client group' },
      400
    )
  }

  const previousCaseId = rawImage.caseId
  const previousChecklistItemId = rawImage.checklistItemId

  await prisma.$transaction(async (tx) => {
    // Decrement source checklist item count (mirror /reassign-entity behavior)
    // Prevents stale receivedCount on source case until next reconcile
    if (previousChecklistItemId) {
      const oldItem = await tx.checklistItem.findUnique({
        where: { id: previousChecklistItemId },
        select: { receivedCount: true },
      })
      if (oldItem) {
        await tx.checklistItem.update({
          where: { id: previousChecklistItemId },
          data: {
            receivedCount: Math.max(0, oldItem.receivedCount - 1),
            ...(oldItem.receivedCount <= 1 && { status: 'MISSING' as ChecklistItemStatus }),
          },
        })
      }
    }

    await tx.rawImage.update({
      where: { id },
      data: {
        caseId: targetCaseId,
        routedFromCaseId: previousCaseId,
        checklistItemId: null,
        entityConfidence: null,
      },
    })

    await tx.action.create({
      data: {
        caseId: targetCaseId,
        type: 'VERIFY_DOCS',
        priority: 'NORMAL',
        title: 'Tài liệu đã chuyển từ entity khác',
        description: `Chuyển từ case ${previousCaseId} sang case ${targetCaseId}`,
        metadata: {
          rawImageId: id,
          fromCaseId: previousCaseId,
          toCaseId: targetCaseId,
          movedById: user.staffId,
        },
      },
    })
  })

  await refreshIdentityRetentionForImage(id)

  // Refresh activity timestamps on both cases (best-effort)
  await Promise.all([updateLastActivity(previousCaseId), updateLastActivity(targetCaseId)])

  await logImageMutation(c, user, rawImage, {
    summary: 'Moved document to tax case',
    action: ACTIVITY_ACTIONS.DOCUMENT.MOVED,
    riskLevel: ActivityRiskLevel.MEDIUM,
    metadata: {
      changedFields: ['caseId', 'routedFromCaseId', 'checklistItemId', 'entityConfidence'],
      fromCaseId: previousCaseId,
      toCaseId: targetCaseId,
    },
  })

  return c.json({
    moved: true,
    rawImageId: id,
    fromCaseId: previousCaseId,
    toCaseId: targetCaseId,
  })
})

export { imagesRoute }
