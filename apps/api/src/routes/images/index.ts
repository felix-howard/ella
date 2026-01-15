/**
 * Raw Images API routes
 * Classification update and image management operations
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../../lib/db'
import { inngest } from '../../lib/inngest'
import type { DocType, ChecklistItemStatus, RawImageStatus } from '@ella/db'

const imagesRoute = new Hono()

// Schema for classification update
const updateClassificationSchema = z.object({
  docType: z.string().min(1, 'Doc type is required'),
  action: z.enum(['approve', 'reject']),
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

    // Find the raw image with case info
    const rawImage = await prisma.rawImage.findUnique({
      where: { id },
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
        // Find matching checklist item
        const checklistItem = await tx.checklistItem.findFirst({
          where: {
            caseId: rawImage.caseId,
            template: { docType: docType as DocType },
          },
        })

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

  // Find the raw image
  const rawImage = await prisma.rawImage.findUnique({
    where: { id },
    select: {
      id: true,
      caseId: true,
      r2Key: true,
      mimeType: true,
      status: true,
    },
  })

  if (!rawImage) {
    return c.json(
      { error: 'NOT_FOUND', message: 'Image not found' },
      404
    )
  }

  // Only allow reclassification for UPLOADED or UNCLASSIFIED images
  const allowedStatuses = ['UPLOADED', 'UNCLASSIFIED']
  if (!allowedStatuses.includes(rawImage.status)) {
    return c.json(
      {
        error: 'INVALID_STATUS',
        message: `Cannot reclassify image with status: ${rawImage.status}`,
      },
      400
    )
  }

  // Reset status to UPLOADED to allow reprocessing
  await prisma.rawImage.update({
    where: { id },
    data: { status: 'UPLOADED' as RawImageStatus },
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

export { imagesRoute }
