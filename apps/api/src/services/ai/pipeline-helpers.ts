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
 */
export async function linkToChecklistItem(
  rawImageId: string,
  caseId: string,
  docType: DocType
): Promise<string | null> {
  const checklistItem = await prisma.checklistItem.findFirst({
    where: {
      caseId,
      template: { docType },
    },
  })

  if (checklistItem) {
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

  return null
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
