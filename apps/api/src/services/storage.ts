/**
 * Storage Service
 * Cloudflare R2 upload/download operations
 *
 * Note: R2 integration will be fully implemented when R2 bucket is configured.
 * For now, this provides the interface and placeholder implementations.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { generateDocumentName, type DocumentNamingComponents } from '@ella/shared'
import { prisma } from '../lib/db'

// R2 client configuration
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'ella-documents'

// Check if R2 is configured
const isR2Configured =
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY

/**
 * Upload a file to R2 storage
 * Returns the R2 key and a signed download URL
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<{ key: string; url: string | null }> {
  if (!isR2Configured) {
    console.warn('[Storage] R2 not configured, skipping upload for key:', key)
    return { key, url: null }
  }

  try {
    console.log(`[Storage] Uploading to R2: ${key} (${body.length} bytes, ${contentType})`)

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    )

    console.log(`[Storage] Upload successful: ${key}`)

    // Generate signed URL for immediate access
    const url = await getSignedDownloadUrl(key)
    if (!url) {
      console.error(`[Storage] Failed to generate signed URL for: ${key}`)
      return { key, url: null }
    }

    console.log(`[Storage] Generated signed URL for: ${key}`)
    return { key, url }
  } catch (error) {
    console.error(`[Storage] Upload failed for key: ${key}`, error)
    // Re-throw to let caller handle the error
    throw error
  }
}

/**
 * Generate presigned PUT URL for direct browser uploads
 * Used for avatar uploads - bypasses server for bandwidth efficiency
 */
export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  contentLength: number,
  expiresIn = 900 // 15 minutes
): Promise<string | null> {
  if (!isR2Configured) {
    console.warn('[Storage] R2 not configured, cannot generate upload URL')
    return null
  }

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    })

    return await getSignedUrl(s3Client, command, { expiresIn })
  } catch (error) {
    console.error('[Storage] Failed to generate upload URL:', key, error)
    return null
  }
}

/**
 * Generate unique avatar key with timestamp and random suffix (Staff)
 */
export function generateAvatarKey(staffId: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8) // 6-char random suffix
  return `avatars/${staffId}/${timestamp}-${random}.jpg`
}

/**
 * Generate unique avatar key for client with timestamp and random suffix
 * @param contentType - Optional MIME type to determine extension (default: image/jpeg)
 */
export function generateClientAvatarKey(clientId: string, contentType?: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8) // 6-char random suffix
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  const ext = contentType ? extMap[contentType] || 'jpg' : 'jpg'
  return `client-avatars/${clientId}/${timestamp}-${random}.${ext}`
}

/**
 * Get a signed download URL for a file
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string | null> {
  if (!isR2Configured) {
    console.warn('R2 not configured, cannot generate signed URL for:', key)
    return null
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    return await getSignedUrl(s3Client, command, { expiresIn })
  } catch (error) {
    console.error('[Storage] Failed to generate signed URL:', key, error)
    return null
  }
}

/**
 * Generate a unique key for a file upload
 * Uses timestamp + random suffix to prevent key collision on concurrent uploads
 */
export function generateFileKey(
  caseId: string,
  filename: string,
  prefix = 'raw'
): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 6) // 4-char random suffix
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  const ext = sanitizedFilename.split('.').pop() || 'jpg'
  return `cases/${caseId}/${prefix}/${timestamp}-${random}.${ext}`
}

/**
 * Generate a thumbnail key from an original key
 */
export function getThumbnailKey(originalKey: string): string {
  const parts = originalKey.split('/')
  const filename = parts.pop() || ''
  return [...parts, 'thumbnails', filename].join('/')
}

/**
 * Delete a file from R2 storage
 */
export async function deleteFile(key: string): Promise<boolean> {
  if (!isR2Configured) {
    console.warn('R2 not configured, cannot delete:', key)
    return false
  }

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    )
    return true
  } catch (error) {
    console.error('Failed to delete file:', key, error)
    return false
  }
}

/**
 * Check R2 configuration status
 */
export function getStorageStatus(): {
  configured: boolean
  bucket: string
  endpoint: string | null
} {
  return {
    configured: Boolean(isR2Configured),
    bucket: BUCKET_NAME,
    endpoint: process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : null,
  }
}

/**
 * Fetch image buffer from R2 storage
 * Used by background jobs to get image data for AI processing
 * Retries with exponential backoff to handle R2 replication lag on concurrent uploads
 */
export async function fetchImageBuffer(r2Key: string): Promise<{
  buffer: Buffer
  mimeType: string
} | null> {
  const MAX_RETRIES = 4
  const BASE_DELAY_MS = 500

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const signedUrl = await getSignedDownloadUrl(r2Key)
    if (!signedUrl) return null

    try {
      const response = await fetch(signedUrl)
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer())
        const mimeType = response.headers.get('content-type') || 'image/jpeg'
        return { buffer, mimeType }
      }

      // 404 = file may not be replicated yet, retry with backoff
      if (response.status === 404 && attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt) // 500ms, 1s, 2s, 4s
        console.warn(`[Storage] R2 returned 404 for ${r2Key}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      // Non-404 error or final attempt
      console.error(`[Storage] Failed to fetch from R2: ${r2Key} (status ${response.status})`)
      return null
    } catch (error) {
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt)
        console.warn(`[Storage] Network error fetching ${r2Key}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`, error)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      console.error('[Storage] Failed to fetch image:', r2Key, error)
      return null
    }
  }

  return null
}

/**
 * Result of a rename operation
 */
export interface RenameResult {
  success: boolean
  newKey: string
  oldKey: string
  error?: string
}

/**
 * Rename a file in R2 storage using a raw filename (no naming convention applied)
 * Used by multi-page grouping to append _PartXofY suffix to existing names
 *
 * @param oldKey - Current R2 key
 * @param caseId - Case ID for path construction
 * @param newFilename - New filename (without extension)
 */
export async function renameFileRaw(
  oldKey: string,
  caseId: string,
  newFilename: string
): Promise<RenameResult> {
  if (!isR2Configured) {
    console.warn('[Storage] R2 not configured, skipping rename')
    return { success: false, newKey: oldKey, oldKey, error: 'R2_NOT_CONFIGURED' }
  }

  // Extract extension from old key
  const parts = oldKey.split('.')
  const ext = parts.length > 1 ? parts.pop()! : 'pdf'

  let newKey = `cases/${caseId}/docs/${newFilename}.${ext}`

  // Skip if same key (no rename needed)
  if (oldKey === newKey) {
    console.log(`[Storage] Key unchanged, skipping rename: ${oldKey}`)
    return { success: true, newKey, oldKey }
  }

  // Check for r2Key collision in DB and append sequence number if needed
  const MAX_COLLISION_ATTEMPTS = 10
  for (let seq = 2; seq <= MAX_COLLISION_ATTEMPTS + 1; seq++) {
    const existing = await prisma.rawImage.findUnique({
      where: { r2Key: newKey },
      select: { id: true },
    })
    if (!existing) break

    newKey = `cases/${caseId}/docs/${newFilename} (${seq}).${ext}`
    console.log(`[Storage] Key collision detected, trying: ${newKey}`)
  }

  try {
    console.log(`[Storage] Copying: ${oldKey} -> ${newKey}`)
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: BUCKET_NAME,
        CopySource: `${BUCKET_NAME}/${oldKey}`,
        Key: newKey,
      })
    )

    // NOTE: Old file deletion is now done by caller AFTER DB update succeeds
    console.log(`[Storage] Copy complete (caller should delete old after DB update): ${newKey}`)
    return { success: true, newKey, oldKey }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Storage] Rename failed: ${oldKey}`, error)
    return { success: false, newKey: oldKey, oldKey, error: errorMessage }
  }
}

/**
 * Rename a file in R2 storage using copy+delete pattern
 * R2/S3 has no native rename, so we:
 * 1. Copy to new key
 * 2. Return new key (caller updates DB)
 * 3. Delete old key (safe to fail - orphaned file is acceptable)
 *
 * Race Condition Safety:
 * - Copy operation is idempotent (safe to retry)
 * - Caller updates DB AFTER successful copy, BEFORE delete
 * - Delete failure leaves orphan but doesn't break consistency
 * - On retry: If copy succeeds but delete failed previously, retry is safe
 *   because copy to same key is idempotent and delete will be retried
 *
 * Transaction Order (in classify-document job):
 * 1. Copy file to new key (this function)
 * 2. Update RawImage.r2Key in DB (caller)
 * 3. Delete old key (this function) - allowed to fail
 *
 * @param oldKey - Current R2 key
 * @param caseId - Case ID for path construction
 * @param components - Naming components from AI classification
 */
export async function renameFile(
  oldKey: string,
  caseId: string,
  components: DocumentNamingComponents
): Promise<RenameResult> {
  if (!isR2Configured) {
    console.warn('[Storage] R2 not configured, skipping rename')
    return { success: false, newKey: oldKey, oldKey, error: 'R2_NOT_CONFIGURED' }
  }

  // Extract extension from old key (must contain a dot)
  const parts = oldKey.split('.')
  const ext = parts.length > 1 ? parts.pop()! : 'pdf'

  // Generate new filename using naming convention
  const displayName = generateDocumentName(components)
  let newKey = `cases/${caseId}/docs/${displayName}.${ext}`

  // Skip if same key (no rename needed)
  if (oldKey === newKey) {
    console.log(`[Storage] Key unchanged, skipping rename: ${oldKey}`)
    return { success: true, newKey, oldKey }
  }

  // Check for r2Key collision in DB and append sequence number if needed
  // e.g. 2024_FORM_1099_NEC_Google_FionaPham.pdf -> 2024_FORM_1099_NEC_Google_FionaPham (2).pdf
  const MAX_COLLISION_ATTEMPTS = 10
  for (let seq = 2; seq <= MAX_COLLISION_ATTEMPTS + 1; seq++) {
    const existing = await prisma.rawImage.findUnique({
      where: { r2Key: newKey },
      select: { id: true },
    })
    if (!existing) break // No collision, use this key

    // Append sequence number
    newKey = `cases/${caseId}/docs/${displayName} (${seq}).${ext}`
    console.log(`[Storage] Key collision detected, trying: ${newKey}`)
  }

  try {
    // Step 1: Copy to new location
    console.log(`[Storage] Copying: ${oldKey} -> ${newKey}`)
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: BUCKET_NAME,
        CopySource: `${BUCKET_NAME}/${oldKey}`,
        Key: newKey,
      })
    )

    // NOTE: Old file deletion is now done by caller AFTER DB update succeeds
    // This prevents data loss if job fails between copy and DB update
    // The caller should call deleteFile(oldKey) after updating the DB
    console.log(`[Storage] Copy complete (caller should delete old after DB update): ${newKey}`)
    return { success: true, newKey, oldKey }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Storage] Rename failed: ${oldKey}`, error)
    return { success: false, newKey: oldKey, oldKey, error: errorMessage }
  }
}

