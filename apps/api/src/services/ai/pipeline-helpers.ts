/**
 * AI Pipeline Database Helpers
 * Handles database operations for the document processing pipeline
 */
import { prisma } from '../../lib/db'
import type { DocType, RawImageStatus, Prisma } from '@ella/db'
import type { CreateActionParams } from './pipeline-types'

/**
 * Update raw image status with classification info
 */
export async function updateRawImageStatus(
  id: string,
  status: RawImageStatus,
  confidence: number,
  docType?: DocType
) {
  await prisma.rawImage.update({
    where: { id },
    data: {
      status,
      aiConfidence: confidence,
      ...(docType && { classifiedType: docType }),
    },
  })
}

/**
 * Get raw image case ID
 */
export async function getRawImageCaseId(rawImageId: string): Promise<string | null> {
  const rawImage = await prisma.rawImage.findUnique({
    where: { id: rawImageId },
    select: { caseId: true },
  })
  return rawImage?.caseId ?? null
}

/**
 * Mark raw image as processing
 */
export async function markImageProcessing(rawImageId: string) {
  await prisma.rawImage.update({
    where: { id: rawImageId },
    data: { status: 'PROCESSING' as RawImageStatus },
  })
}

/**
 * Link raw image to matching checklist item
 * Priority: 1) Item already linked to this image, 2) Item with existing images, 3) First by sortOrder
 * This prevents duplicate checklist items when multiple taxTypes have same docType (e.g., W2)
 */
export async function linkToChecklistItem(
  rawImageId: string,
  caseId: string,
  docType: DocType
): Promise<string | null> {
  // Check if image is already linked to a checklist item with this docType
  const existingImage = await prisma.rawImage.findUnique({
    where: { id: rawImageId },
    select: { checklistItemId: true },
  })

  if (existingImage?.checklistItemId) {
    const existingItem = await prisma.checklistItem.findUnique({
      where: { id: existingImage.checklistItemId },
      include: { template: true },
    })
    // If already linked to correct docType, just update status
    if (existingItem?.template?.docType === docType) {
      await prisma.checklistItem.update({
        where: { id: existingItem.id },
        data: { status: 'HAS_RAW' },
      })
      return existingItem.id
    }
  }

  // Find all matching checklist items, prefer ones with existing images
  const checklistItems = await prisma.checklistItem.findMany({
    where: {
      caseId,
      template: { docType },
    },
    include: {
      template: true,
      _count: { select: { rawImages: true } },
    },
    orderBy: { template: { sortOrder: 'asc' } },
  })

  if (checklistItems.length === 0) {
    return null
  }

  // Prefer checklist item that already has images (to group documents together)
  // Otherwise use first by sortOrder (typically personal income over business)
  const checklistItem = checklistItems.find(item => item._count.rawImages > 0) || checklistItems[0]

  await prisma.rawImage.update({
    where: { id: rawImageId },
    data: {
      checklistItemId: checklistItem.id,
      status: 'LINKED',
    },
  })

  await prisma.checklistItem.update({
    where: { id: checklistItem.id },
    data: {
      status: 'HAS_RAW',
      receivedCount: { increment: 1 },
    },
  })

  return checklistItem.id
}

/**
 * Create or update digital document with OCR data
 */
export async function upsertDigitalDoc(
  rawImageId: string,
  caseId: string,
  docType: DocType,
  extractedData: Record<string, unknown>,
  status: 'EXTRACTED' | 'PARTIAL' | 'FAILED',
  confidence: number,
  checklistItemId?: string | null
): Promise<string> {
  const extractedJson = extractedData as Prisma.InputJsonValue

  const digitalDoc = await prisma.digitalDoc.upsert({
    where: { rawImageId },
    update: {
      docType,
      status,
      extractedData: extractedJson,
      aiConfidence: confidence,
    },
    create: {
      caseId,
      rawImageId,
      docType,
      status,
      extractedData: extractedJson,
      aiConfidence: confidence,
      checklistItemId,
    },
  })

  return digitalDoc.id
}

/**
 * Create an action record with typed metadata
 */
export async function createAction(params: CreateActionParams): Promise<string> {
  const action = await prisma.action.create({
    data: {
      caseId: params.caseId,
      type: params.type,
      priority: params.priority,
      title: params.title,
      description: params.description,
      metadata: params.metadata as unknown as Prisma.InputJsonValue,
    },
  })
  return action.id
}

/**
 * Mark raw image status to linked after OCR
 */
export async function markImageLinked(rawImageId: string) {
  await prisma.rawImage.update({
    where: { id: rawImageId },
    data: { status: 'LINKED' as RawImageStatus },
  })
}

/**
 * Mark raw image as unclassified (failed)
 */
export async function markImageUnclassified(rawImageId: string) {
  await prisma.rawImage.update({
    where: { id: rawImageId },
    data: { status: 'UNCLASSIFIED' as RawImageStatus },
  })
}

/**
 * Mark image as duplicate and store hash
 * Called when pre-classification duplicate check finds a match
 */
export async function markImageDuplicate(
  rawImageId: string,
  imageHash: string,
  groupId: string | null,
  _matchedImageId: string | null // Kept for future use (e.g., logging, linking)
): Promise<void> {
  await prisma.rawImage.update({
    where: { id: rawImageId },
    data: {
      status: 'DUPLICATE' as RawImageStatus,
      imageHash,
      imageGroupId: groupId,
    },
  })
}

/**
 * Update checklist item status to HAS_DIGITAL after successful OCR extraction
 * This is the status transition: HAS_RAW → HAS_DIGITAL
 */
export async function updateChecklistItemToHasDigital(checklistItemId: string) {
  await prisma.checklistItem.update({
    where: { id: checklistItemId },
    data: { status: 'HAS_DIGITAL' },
  })
}

/**
 * Atomic OCR post-processing: upsert digital doc, update checklist, mark image linked
 * All operations within a transaction to ensure consistency
 */
export interface OcrPostProcessParams {
  rawImageId: string
  caseId: string
  docType: DocType
  extractedData: Record<string, unknown>
  status: 'EXTRACTED' | 'PARTIAL' | 'FAILED'
  confidence: number
  checklistItemId: string | null
}

export async function processOcrResultAtomic(params: OcrPostProcessParams): Promise<string> {
  const { rawImageId, caseId, docType, extractedData, status, confidence, checklistItemId } = params
  const extractedJson = extractedData as Prisma.InputJsonValue

  return await prisma.$transaction(async (tx) => {
    // 1. Upsert digital doc
    const digitalDoc = await tx.digitalDoc.upsert({
      where: { rawImageId },
      update: {
        docType,
        status,
        extractedData: extractedJson,
        aiConfidence: confidence,
      },
      create: {
        caseId,
        rawImageId,
        docType,
        status,
        extractedData: extractedJson,
        aiConfidence: confidence,
        checklistItemId,
      },
    })

    // 2. Update checklist item status to HAS_DIGITAL on successful extraction
    if (checklistItemId && (status === 'EXTRACTED' || status === 'PARTIAL')) {
      await tx.checklistItem.update({
        where: { id: checklistItemId },
        data: { status: 'HAS_DIGITAL' },
      })
    }

    // 3. Mark raw image as linked
    await tx.rawImage.update({
      where: { id: rawImageId },
      data: { status: 'LINKED' as RawImageStatus },
    })

    return digitalDoc.id
  })
}
