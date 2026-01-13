/**
 * Digital Documents API routes
 * Classification, OCR, and verification operations
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import { classifyDocSchema, verifyDocSchema } from './schemas'
import type { DocType, DigitalDocStatus, ChecklistItemStatus } from '@ella/db'

const docsRoute = new Hono()

// GET /docs/:id - Get digital doc details with extracted data
docsRoute.get('/:id', async (c) => {
  const id = c.req.param('id')

  const doc = await prisma.digitalDoc.findUnique({
    where: { id },
    include: {
      rawImage: true,
      checklistItem: { include: { template: true } },
    },
  })

  if (!doc) {
    return c.json({ error: 'NOT_FOUND', message: 'Document not found' }, 404)
  }

  return c.json({
    ...doc,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  })
})

// POST /docs/:id/classify - Manually classify a raw image
docsRoute.post('/:id/classify', zValidator('json', classifyDocSchema), async (c) => {
  const id = c.req.param('id')
  const { docType } = c.req.valid('json')

  // Find the raw image
  const rawImage = await prisma.rawImage.findUnique({
    where: { id },
    include: { taxCase: true },
  })

  if (!rawImage) {
    return c.json(
      { error: 'NOT_FOUND', message: 'Raw image not found' },
      404
    )
  }

  // Update raw image with classification
  const updatedRawImage = await prisma.rawImage.update({
    where: { id },
    data: {
      classifiedType: docType as DocType,
      status: 'CLASSIFIED',
      aiConfidence: 1.0, // Manual classification = 100% confidence
    },
  })

  // Find matching checklist item and link
  const checklistItem = await prisma.checklistItem.findFirst({
    where: {
      caseId: rawImage.caseId,
      template: { docType: docType as DocType },
    },
  })

  if (checklistItem) {
    await prisma.rawImage.update({
      where: { id },
      data: {
        checklistItemId: checklistItem.id,
        status: 'LINKED',
      },
    })

    // Update checklist item status
    await prisma.checklistItem.update({
      where: { id: checklistItem.id },
      data: {
        status: 'HAS_RAW' as ChecklistItemStatus,
        receivedCount: { increment: 1 },
      },
    })
  }

  // Create placeholder digital doc (OCR will populate extractedData later)
  const digitalDoc = await prisma.digitalDoc.upsert({
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

  return c.json({
    rawImage: {
      ...updatedRawImage,
      createdAt: updatedRawImage.createdAt.toISOString(),
      updatedAt: updatedRawImage.updatedAt.toISOString(),
    },
    digitalDoc: {
      ...digitalDoc,
      createdAt: digitalDoc.createdAt.toISOString(),
      updatedAt: digitalDoc.updatedAt.toISOString(),
    },
    message: 'Document classified. OCR extraction pending.',
  })
})

// POST /docs/:id/ocr - Trigger OCR extraction (placeholder for AI integration)
docsRoute.post('/:id/ocr', async (c) => {
  const id = c.req.param('id')

  // Find digital doc
  const doc = await prisma.digitalDoc.findUnique({
    where: { id },
    include: { rawImage: true },
  })

  if (!doc) {
    return c.json({ error: 'NOT_FOUND', message: 'Document not found' }, 404)
  }

  // OCR placeholder - in Phase 2, this will call Gemini API
  // For now, mark as extracted with placeholder data
  const extractedData = generatePlaceholderExtractedData(doc.docType)

  const updatedDoc = await prisma.digitalDoc.update({
    where: { id },
    data: {
      status: 'EXTRACTED' as DigitalDocStatus,
      extractedData: extractedData as unknown as Parameters<typeof prisma.digitalDoc.update>[0]['data']['extractedData'],
      aiConfidence: 0.85, // Placeholder confidence
    },
  })

  // Create action for verification
  await prisma.action.create({
    data: {
      caseId: doc.caseId,
      type: 'VERIFY_DOCS',
      priority: 'NORMAL',
      title: 'Xác minh tài liệu mới',
      description: `Tài liệu ${doc.docType} cần xác minh OCR`,
      metadata: { docId: doc.id, rawImageId: doc.rawImageId },
    },
  })

  return c.json({
    digitalDoc: {
      ...updatedDoc,
      createdAt: updatedDoc.createdAt.toISOString(),
      updatedAt: updatedDoc.updatedAt.toISOString(),
    },
    message: 'OCR extraction completed. Awaiting verification.',
  })
})

// PATCH /docs/:id/verify - Verify/edit extracted data
docsRoute.patch('/:id/verify', zValidator('json', verifyDocSchema), async (c) => {
  const id = c.req.param('id')
  const { extractedData, status } = c.req.valid('json')

  const doc = await prisma.digitalDoc.update({
    where: { id },
    data: {
      extractedData,
      status: status as DigitalDocStatus,
      verifiedAt: new Date(),
    },
    include: { checklistItem: true },
  })

  // Update checklist item status if linked
  if (doc.checklistItemId && status === 'VERIFIED') {
    await prisma.checklistItem.update({
      where: { id: doc.checklistItemId },
      data: { status: 'VERIFIED' as ChecklistItemStatus },
    })
  }

  return c.json({
    ...doc,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  })
})

/**
 * Generate placeholder extracted data based on doc type
 * This will be replaced by actual Gemini OCR in Phase 2
 */
function generatePlaceholderExtractedData(docType: DocType): Record<string, unknown> {
  switch (docType) {
    case 'W2':
      return {
        employerName: '[Pending OCR]',
        employerEIN: '[Pending OCR]',
        wages: 0,
        federalWithholding: 0,
        socialSecurityWages: 0,
        medicareWages: 0,
      }
    case 'FORM_1099_INT':
      return {
        payerName: '[Pending OCR]',
        interestIncome: 0,
      }
    case 'FORM_1099_NEC':
      return {
        payerName: '[Pending OCR]',
        nonemployeeCompensation: 0,
      }
    case 'SSN_CARD':
      return {
        name: '[Pending OCR]',
        ssn: '[Pending OCR]',
      }
    case 'DRIVER_LICENSE':
      return {
        name: '[Pending OCR]',
        address: '[Pending OCR]',
        licenseNumber: '[Pending OCR]',
        expirationDate: '[Pending OCR]',
      }
    default:
      return {
        rawText: '[Pending OCR]',
        notes: 'Document type not yet supported for structured extraction',
      }
  }
}

export { docsRoute }
