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
 */
export function generateFileKey(
  caseId: string,
  filename: string,
  prefix = 'raw'
): string {
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  const ext = sanitizedFilename.split('.').pop() || 'jpg'
  return `cases/${caseId}/${prefix}/${timestamp}.${ext}`
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
 */
export async function fetchImageBuffer(r2Key: string): Promise<{
  buffer: Buffer
  mimeType: string
} | null> {
  const signedUrl = await getSignedDownloadUrl(r2Key)
  if (!signedUrl) return null

  try {
    const response = await fetch(signedUrl)
    if (!response.ok) return null

    const buffer = Buffer.from(await response.arrayBuffer())
    const mimeType = response.headers.get('content-type') || 'image/jpeg'

    return { buffer, mimeType }
  } catch (error) {
    console.error('[Storage] Failed to fetch image:', r2Key, error)
    return null
  }
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
 * Rename a file in R2 storage using copy+delete pattern
 * R2/S3 has no native rename, so we:
 * 1. Copy to new key
 * 2. Return new key (caller updates DB)
 * 3. Delete old key (safe to fail - orphaned file is acceptable)
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
  const newKey = `cases/${caseId}/docs/${displayName}.${ext}`

  // Skip if same key (no rename needed)
  if (oldKey === newKey) {
    console.log(`[Storage] Key unchanged, skipping rename: ${oldKey}`)
    return { success: true, newKey, oldKey }
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

    // Step 2: Delete old file (can fail safely - DB is source of truth)
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: oldKey,
        })
      )
      console.log(`[Storage] Deleted old key: ${oldKey}`)
    } catch (deleteError) {
      // Log but don't fail - orphaned old file is acceptable
      console.warn(`[Storage] Failed to delete old key (orphaned): ${oldKey}`, deleteError)
    }

    console.log(`[Storage] Rename complete: ${newKey}`)
    return { success: true, newKey, oldKey }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Storage] Rename failed: ${oldKey}`, error)
    return { success: false, newKey: oldKey, oldKey, error: errorMessage }
  }
}
