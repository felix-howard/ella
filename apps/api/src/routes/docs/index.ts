/**
 * Digital Documents API routes
 * Classification, OCR, and verification operations
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import { classifyDocSchema, verifyDocSchema } from './schemas'
import {
  extractDocumentData,
  needsManualVerification,
  isGeminiConfigured,
  supportsOcrExtraction,
} from '../../services/ai'
import { getSignedDownloadUrl } from '../../services/storage'
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

// POST /docs/:id/ocr - Trigger OCR extraction using Gemini AI
docsRoute.post('/:id/ocr', async (c) => {
  const id = c.req.param('id')

  // Find digital doc with raw image
  const doc = await prisma.digitalDoc.findUnique({
    where: { id },
    include: { rawImage: true },
  })

  if (!doc) {
    return c.json({ error: 'NOT_FOUND', message: 'Document not found' }, 404)
  }

  // Check if AI is configured
  if (!isGeminiConfigured) {
    // Fall back to placeholder data
    const placeholderData = generatePlaceholderExtractedData(doc.docType)
    const updatedDoc = await prisma.digitalDoc.update({
      where: { id },
      data: {
        status: 'PENDING' as DigitalDocStatus,
        extractedData: placeholderData as Parameters<typeof prisma.digitalDoc.update>[0]['data']['extractedData'],
        aiConfidence: 0,
      },
    })

    return c.json({
      digitalDoc: {
        ...updatedDoc,
        createdAt: updatedDoc.createdAt.toISOString(),
        updatedAt: updatedDoc.updatedAt.toISOString(),
      },
      aiConfigured: false,
      message: 'AI not configured. Manual data entry required.',
    })
  }

  // Check if doc type supports OCR
  if (!supportsOcrExtraction(doc.docType)) {
    return c.json({
      error: 'UNSUPPORTED_DOC_TYPE',
      message: `Document type ${doc.docType} does not support OCR extraction`,
    }, 400)
  }

  // Fetch image from R2 for processing
  let imageBuffer: Buffer
  let mimeType: string

  try {
    if (!doc.rawImage) {
      return c.json({ error: 'NO_IMAGE', message: 'No raw image linked to document' }, 400)
    }

    // Get signed URL and fetch image
    const signedUrl = await getSignedDownloadUrl(doc.rawImage.r2Key)
    if (!signedUrl) {
      return c.json({ error: 'STORAGE_ERROR', message: 'Cannot access image file' }, 500)
    }

    const response = await fetch(signedUrl)
    if (!response.ok) {
      return c.json({ error: 'FETCH_ERROR', message: 'Cannot fetch image from storage' }, 500)
    }

    const arrayBuffer = await response.arrayBuffer()
    imageBuffer = Buffer.from(arrayBuffer)
    mimeType = doc.rawImage.mimeType || 'image/jpeg'
  } catch (error) {
    console.error('Failed to fetch image for OCR:', error)
    return c.json({ error: 'IMAGE_ERROR', message: 'Failed to load image for processing' }, 500)
  }

  // Run OCR extraction
  const ocrResult = await extractDocumentData(imageBuffer, mimeType, doc.docType)

  // Determine status based on result
  let status: DigitalDocStatus = 'PENDING'
  if (ocrResult.success) {
    status = ocrResult.isValid ? 'EXTRACTED' : 'PARTIAL'
  } else {
    status = 'FAILED'
  }

  // Atomic transaction: Update digital doc, checklist item, and create action
  const updatedDoc = await prisma.$transaction(async (tx) => {
    // Update digital doc with extracted data
    const digitalDoc = await tx.digitalDoc.update({
      where: { id },
      data: {
        status,
        extractedData: (ocrResult.extractedData || {}) as Parameters<typeof tx.digitalDoc.update>[0]['data']['extractedData'],
        aiConfidence: ocrResult.confidence,
      },
    })

    // Update checklist item status to HAS_DIGITAL on successful extraction
    if (doc.checklistItemId && (status === 'EXTRACTED' || status === 'PARTIAL')) {
      await tx.checklistItem.update({
        where: { id: doc.checklistItemId },
        data: { status: 'HAS_DIGITAL' as ChecklistItemStatus },
      })
    }

    // Create action for verification if needed
    if (needsManualVerification(ocrResult)) {
      await tx.action.create({
        data: {
          caseId: doc.caseId,
          type: 'VERIFY_DOCS',
          priority: 'NORMAL',
          title: 'Xác minh dữ liệu OCR',
          description: `${doc.docType}: Dữ liệu cần xác minh (độ tin cậy: ${Math.round(ocrResult.confidence * 100)}%)`,
          metadata: {
            docId: doc.id,
            rawImageId: doc.rawImageId,
            confidence: ocrResult.confidence,
          },
        },
      })
    }

    return digitalDoc
  })

  return c.json({
    digitalDoc: {
      ...updatedDoc,
      createdAt: updatedDoc.createdAt.toISOString(),
      updatedAt: updatedDoc.updatedAt.toISOString(),
    },
    ocrResult: {
      success: ocrResult.success,
      confidence: ocrResult.confidence,
      isValid: ocrResult.isValid,
      fieldLabels: ocrResult.fieldLabels,
      processingTimeMs: ocrResult.processingTimeMs,
    },
    message: ocrResult.success
      ? 'OCR extraction completed. Awaiting verification.'
      : `OCR extraction failed: ${ocrResult.error}`,
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
