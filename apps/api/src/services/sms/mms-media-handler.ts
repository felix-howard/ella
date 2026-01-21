/**
 * MMS Media Handler
 * Downloads media from Twilio MMS, uploads to R2, creates RawImage records
 *
 * IMPORTANT: Twilio media URLs expire in ~4 hours. This handler:
 * 1. Downloads media from Twilio immediately (with Basic Auth)
 * 2. Uploads to Cloudflare R2 for permanent storage
 * 3. Stores both signed R2 URLs and R2 keys for URL refresh
 */
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'
import { inngest } from '../../lib/inngest'
import { uploadFile, generateFileKey, getSignedDownloadUrl, getStorageStatus } from '../storage'
import { isGeminiConfigured } from '../ai'
import type { TwilioIncomingMessage } from './webhook-handler'

const MEDIA_DOWNLOAD_TIMEOUT = 15000 // 15s timeout for Twilio URL fetch (increased from 10s)
const MAX_MEDIA_COUNT = 10 // Twilio supports up to 10 media items

export interface MmsMediaResult {
  attachmentUrls: string[]
  attachmentR2Keys: string[]  // Permanent keys for refreshing expired URLs
  rawImageIds: string[]
  errors: string[]
}

/**
 * Process MMS media from incoming Twilio message
 * Downloads media from Twilio URLs (they expire in hours), uploads to R2,
 * creates RawImage records, and triggers AI classification
 */
export async function processMmsMedia(
  incomingMsg: TwilioIncomingMessage,
  caseId: string
): Promise<MmsMediaResult> {
  const result: MmsMediaResult = {
    attachmentUrls: [],
    attachmentR2Keys: [],
    rawImageIds: [],
    errors: [],
  }

  const numMedia = parseInt(incomingMsg.NumMedia || '0', 10)
  if (numMedia <= 0) {
    return result
  }

  // Check R2 configuration upfront
  const storageStatus = getStorageStatus()
  if (!storageStatus.configured) {
    console.error('[MMS] CRITICAL: R2 storage is NOT configured! Media will not be persisted.')
    console.error('[MMS] Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in environment')
    result.errors.push('R2 storage not configured - media cannot be persisted')
    return result
  }

  console.log(`[MMS] Processing ${numMedia} media items for case ${caseId}`)
  console.log(`[MMS] R2 bucket: ${storageStatus.bucket}, endpoint: ${storageStatus.endpoint}`)

  // Collect Inngest events to send in batch
  const inngestEvents: Array<{
    name: 'document/uploaded'
    data: {
      rawImageId: string
      caseId: string
      r2Key: string
      mimeType: string
      uploadedAt: string
    }
  }> = []

  // Process each media item (Twilio sends MediaUrl0, MediaUrl1, etc.)
  // Build array of media items from the typed fields
  const mediaItems = [
    { url: incomingMsg.MediaUrl0, type: incomingMsg.MediaContentType0 },
    { url: incomingMsg.MediaUrl1, type: incomingMsg.MediaContentType1 },
    { url: incomingMsg.MediaUrl2, type: incomingMsg.MediaContentType2 },
    { url: incomingMsg.MediaUrl3, type: incomingMsg.MediaContentType3 },
    { url: incomingMsg.MediaUrl4, type: incomingMsg.MediaContentType4 },
    { url: incomingMsg.MediaUrl5, type: incomingMsg.MediaContentType5 },
    { url: incomingMsg.MediaUrl6, type: incomingMsg.MediaContentType6 },
    { url: incomingMsg.MediaUrl7, type: incomingMsg.MediaContentType7 },
    { url: incomingMsg.MediaUrl8, type: incomingMsg.MediaContentType8 },
    { url: incomingMsg.MediaUrl9, type: incomingMsg.MediaContentType9 },
  ]

  for (let i = 0; i < Math.min(numMedia, MAX_MEDIA_COUNT); i++) {
    const mediaUrl = mediaItems[i]?.url
    const mediaContentType = mediaItems[i]?.type

    if (!mediaUrl) {
      result.errors.push(`MediaUrl${i} not found`)
      continue
    }

    try {
      // Download media from Twilio URL
      const mediaBuffer = await downloadFromTwilioUrl(mediaUrl, MEDIA_DOWNLOAD_TIMEOUT)
      if (!mediaBuffer) {
        result.errors.push(`Failed to download MediaUrl${i}`)
        continue
      }

      const mimeType = mediaContentType || 'image/jpeg'
      const extension = getExtensionFromMimeType(mimeType)
      const filename = `mms_${Date.now()}_${i}.${extension}`

      // Upload to R2
      const r2Key = generateFileKey(caseId, filename, 'raw')
      const uploadResult = await uploadFile(r2Key, mediaBuffer, mimeType)

      if (!uploadResult.url) {
        result.errors.push(`R2 upload failed for MediaUrl${i}`)
        continue
      }

      // Create RawImage record
      const rawImage = await prisma.rawImage.create({
        data: {
          caseId,
          r2Key,
          filename,
          mimeType,
          fileSize: mediaBuffer.length,
          status: 'UPLOADED',
          uploadedVia: 'SMS',
        },
      })

      result.rawImageIds.push(rawImage.id)
      result.attachmentUrls.push(uploadResult.url)
      result.attachmentR2Keys.push(r2Key)

      // Queue AI classification
      if (isGeminiConfigured) {
        inngestEvents.push({
          name: 'document/uploaded',
          data: {
            rawImageId: rawImage.id,
            caseId,
            r2Key,
            mimeType,
            uploadedAt: new Date().toISOString(),
          },
        })
      }

      console.log(`[MMS] Processed media ${i + 1}/${numMedia}: ${r2Key}`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Error processing MediaUrl${i}: ${errorMsg}`)
      console.error(`[MMS] Error processing media ${i}:`, error)
    }
  }

  // Send Inngest events in batch
  if (inngestEvents.length > 0) {
    try {
      await inngest.send(inngestEvents)
      console.log(`[MMS] Queued ${inngestEvents.length} classification jobs`)
    } catch (error) {
      console.error('[MMS] Failed to queue classification jobs:', error)
    }
  }

  // Create manual review action if AI not configured and we have images
  if (result.rawImageIds.length > 0 && !isGeminiConfigured) {
    try {
      await prisma.action.create({
        data: {
          caseId,
          type: 'VERIFY_DOCS',
          priority: 'HIGH',
          title: 'Tài liệu mới từ SMS',
          description: `Khách hàng đã gửi ${result.rawImageIds.length} file qua MMS - cần phân loại thủ công`,
          metadata: { rawImageIds: result.rawImageIds },
        },
      })
    } catch (error) {
      console.error('[MMS] Failed to create review action:', error)
    }
  }

  // Log summary
  console.log(`[MMS] Processing complete for case ${caseId}:`)
  console.log(`[MMS]   - Success: ${result.rawImageIds.length}/${numMedia}`)
  console.log(`[MMS]   - R2 Keys stored: ${result.attachmentR2Keys.length}`)
  console.log(`[MMS]   - URLs generated: ${result.attachmentUrls.length}`)

  if (result.errors.length > 0) {
    console.warn(`[MMS] Completed with ${result.errors.length} errors:`, result.errors)
  }

  return result
}

/**
 * Download media from Twilio URL with timeout and authentication
 * Twilio URLs expire in ~4 hours, so we must download immediately
 *
 * Uses Basic Auth with Twilio Account SID and Auth Token for secure access
 */
async function downloadFromTwilioUrl(url: string, timeout: number): Promise<Buffer | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  // Build Basic Auth header using Twilio credentials
  const headers: Record<string, string> = {}
  if (config.twilio.accountSid && config.twilio.authToken) {
    const authString = `${config.twilio.accountSid}:${config.twilio.authToken}`
    const base64Auth = Buffer.from(authString).toString('base64')
    headers['Authorization'] = `Basic ${base64Auth}`
    console.log('[MMS] Using Twilio Basic Auth for media download')
  } else {
    console.warn('[MMS] Twilio credentials not configured - attempting download without auth')
  }

  try {
    console.log(`[MMS] Downloading from Twilio: ${url.substring(0, 80)}...`)
    const response = await fetch(url, {
      signal: controller.signal,
      headers,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`[MMS] Twilio URL returned ${response.status} ${response.statusText}: ${url}`)
      // Log response body for debugging
      try {
        const errorText = await response.text()
        console.error(`[MMS] Error response: ${errorText.substring(0, 200)}`)
      } catch {
        // Ignore error reading response
      }
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log(`[MMS] Downloaded ${buffer.length} bytes from Twilio`)
    return buffer
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[MMS] Download timeout after ${timeout}ms: ${url}`)
    } else {
      console.error(`[MMS] Download failed: ${url}`, error)
    }
    return null
  }
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'application/pdf': 'pdf',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
  }
  return mimeMap[mimeType.toLowerCase()] || 'jpg'
}

/**
 * Refresh signed URLs for attachments (used when displaying messages)
 * Generates fresh pre-signed URLs from permanent R2 keys
 */
export async function refreshAttachmentUrls(r2Keys: string[]): Promise<string[]> {
  if (!r2Keys || r2Keys.length === 0) {
    return []
  }

  const urls: string[] = []
  const errors: string[] = []

  for (const key of r2Keys) {
    try {
      const url = await getSignedDownloadUrl(key)
      if (url) {
        urls.push(url)
      } else {
        errors.push(`Failed to refresh URL for key: ${key}`)
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Error refreshing ${key}: ${errMsg}`)
    }
  }

  if (errors.length > 0) {
    console.warn(`[MMS] URL refresh errors (${errors.length}/${r2Keys.length}):`, errors)
  }

  return urls
}
