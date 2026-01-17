/**
 * Duplicate Detector Service
 * Uses perceptual hashing (pHash) to detect duplicate images of the same document
 *
 * Algorithm:
 * 1. Resize image to 8x8 grayscale
 * 2. Calculate mean pixel value
 * 3. Generate 64-bit hash based on mean comparison
 * 4. Compare hashes using Hamming distance
 *
 * Threshold: <10 bits difference = duplicate
 */

import sharp from 'sharp'
import { prisma } from '../../lib/db'
import type { DocType } from '@ella/db'

// Constants
const HASH_SIZE = 8 // 8x8 = 64 bits
const HASH_BIT_LENGTH = HASH_SIZE * HASH_SIZE // 64 bits
const DUPLICATE_THRESHOLD = 10 // Hamming distance: lower = stricter, higher = more lenient
const MAX_IMAGE_SIZE = 50 * 1024 * 1024 // 50MB max input size for DoS protection
const VALID_HASH_REGEX = /^[01]{64}$/ // 64-character binary string

/**
 * Generate perceptual hash (64-bit) for an image
 * Uses a simple but effective average hash algorithm
 * @throws Error if buffer is invalid or too large
 */
export async function generateImageHash(buffer: Buffer): Promise<string> {
  // Input validation
  if (!buffer || buffer.length === 0) {
    throw new Error('Invalid image buffer: empty or null')
  }

  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error(`Image too large: ${buffer.length} bytes exceeds ${MAX_IMAGE_SIZE} byte limit`)
  }

  try {
    // Resize to 8x8 grayscale for hash generation
    const { data } = await sharp(buffer)
      .resize(HASH_SIZE, HASH_SIZE, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Calculate mean pixel value
    const mean = data.reduce((sum: number, val: number) => sum + val, 0) / HASH_BIT_LENGTH

    // Generate hash: 1 if pixel >= mean, 0 otherwise
    let hash = ''
    for (let i = 0; i < HASH_BIT_LENGTH; i++) {
      hash += data[i] >= mean ? '1' : '0'
    }

    return hash
  } catch (error) {
    if (error instanceof Error && error.message.includes('byte limit')) {
      throw error // Re-throw our size validation error
    }
    throw new Error(`Failed to generate image hash: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

/**
 * Validate hash format (64-character binary string)
 */
export function isValidHash(hash: string): boolean {
  return VALID_HASH_REGEX.test(hash)
}

/**
 * Calculate Hamming distance between two hashes
 * Returns number of differing bits (0 = identical)
 * @throws Error if hashes are invalid format
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (!isValidHash(hash1) || !isValidHash(hash2)) {
    throw new Error('Invalid hash format: must be 64-character binary string')
  }

  let distance = 0
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++
  }
  return distance
}

/**
 * Check if two images are duplicates based on their hashes
 */
export function areDuplicates(hash1: string, hash2: string): boolean {
  // Skip validation here since hammingDistance validates
  return hammingDistance(hash1, hash2) < DUPLICATE_THRESHOLD
}

/**
 * Find existing duplicate group for a new image
 * Returns groupId if duplicate found, null otherwise
 */
export async function findDuplicateGroup(
  caseId: string,
  docType: DocType,
  newImageHash: string,
  excludeImageId?: string
): Promise<{ groupId: string | null; matchedImageId: string | null }> {
  // Get existing images of same type in case with hashes
  const existingImages = await prisma.rawImage.findMany({
    where: {
      caseId,
      classifiedType: docType,
      imageHash: { not: null },
      ...(excludeImageId && { id: { not: excludeImageId } }),
    },
    select: {
      id: true,
      imageHash: true,
      imageGroupId: true,
    },
  })

  // Check each existing image for duplicate match
  for (const existing of existingImages) {
    if (existing.imageHash && areDuplicates(newImageHash, existing.imageHash)) {
      return {
        groupId: existing.imageGroupId,
        matchedImageId: existing.id,
      }
    }
  }

  return { groupId: null, matchedImageId: null }
}

/**
 * Create or join an ImageGroup for duplicate images
 * Returns the groupId and whether a new group was created
 */
export async function assignToImageGroup(
  rawImageId: string,
  caseId: string,
  docType: DocType,
  imageHash: string
): Promise<{ groupId: string; isNew: boolean; imageCount: number }> {
  // First, save the hash to the image
  await prisma.rawImage.update({
    where: { id: rawImageId },
    data: { imageHash },
  })

  // Find existing duplicate group
  const { groupId: existingGroupId, matchedImageId } = await findDuplicateGroup(
    caseId,
    docType,
    imageHash,
    rawImageId
  )

  if (existingGroupId) {
    // Add to existing group
    await prisma.rawImage.update({
      where: { id: rawImageId },
      data: { imageGroupId: existingGroupId },
    })

    const imageCount = await prisma.rawImage.count({
      where: { imageGroupId: existingGroupId },
    })

    return { groupId: existingGroupId, isNew: false, imageCount }
  }

  // Check if matched image has no group yet - create one for both
  if (matchedImageId) {
    const group = await prisma.imageGroup.create({
      data: {
        caseId,
        docType,
      },
    })

    // Add both images to the new group
    await prisma.rawImage.updateMany({
      where: {
        id: { in: [rawImageId, matchedImageId] },
      },
      data: { imageGroupId: group.id },
    })

    return { groupId: group.id, isNew: true, imageCount: 2 }
  }

  // No duplicate found - return without grouping
  // Single images don't need a group until a duplicate appears
  return { groupId: '', isNew: false, imageCount: 1 }
}

/**
 * Select the best image from a group
 * Updates the group's bestImageId and optionally dismisses others
 */
export async function selectBestImage(
  groupId: string,
  bestImageId: string
): Promise<void> {
  // Verify the image belongs to this group
  const image = await prisma.rawImage.findUnique({
    where: { id: bestImageId },
    select: { imageGroupId: true },
  })

  if (!image || image.imageGroupId !== groupId) {
    throw new Error('Image does not belong to this group')
  }

  await prisma.imageGroup.update({
    where: { id: groupId },
    data: { bestImageId },
  })
}

/**
 * Get all images in a group with their details
 */
export async function getGroupImages(groupId: string) {
  const group = await prisma.imageGroup.findUnique({
    where: { id: groupId },
    include: {
      images: {
        select: {
          id: true,
          r2Key: true,
          filename: true,
          aiConfidence: true,
          blurScore: true,
          createdAt: true,
        },
      },
    },
  })

  return group
}

export type DuplicateDetectionResult = {
  hash: string
  groupId: string | null
  isNew: boolean
  imageCount: number
}
