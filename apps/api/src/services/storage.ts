/**
 * Storage Service
 * Cloudflare R2 upload/download operations
 *
 * Note: R2 integration will be fully implemented when R2 bucket is configured.
 * For now, this provides the interface and placeholder implementations.
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<{ key: string; url: string | null }> {
  if (!isR2Configured) {
    console.warn('R2 not configured, skipping upload for key:', key)
    return { key, url: null }
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )

  return { key, url: await getSignedDownloadUrl(key) }
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

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  return getSignedUrl(s3Client, command, { expiresIn })
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

  // Import DeleteObjectCommand when needed
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')

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
