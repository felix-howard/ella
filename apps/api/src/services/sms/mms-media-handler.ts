/**
 * MMS Media Handler
 * Downloads media from Twilio MMS, uploads to R2, creates RawImage records
 */
import { prisma } from '../../lib/db'
import { inngest } from '../../lib/inngest'
import { uploadFile, generateFileKey, getSignedDownloadUrl } from '../storage'
import { isGeminiConfigured } from '../ai'
import type { TwilioIncomingMessage } from './webhook-handler'

const MEDIA_DOWNLOAD_TIMEOUT = 10000 // 10s timeout for Twilio URL fetch
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

  console.log(`[MMS] Processing ${numMedia} media items for case ${caseId}`)

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

  if (result.errors.length > 0) {
    console.warn(`[MMS] Completed with ${result.errors.length} errors:`, result.errors)
  }

  return result
}

/**
 * Download media from Twilio URL with timeout
 * Twilio URLs expire in a few hours, so we must download immediately
 */
async function downloadFromTwilioUrl(url: string, timeout: number): Promise<Buffer | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Twilio may require auth for media URLs in some cases
        // Basic auth with Account SID and Auth Token if needed
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`[MMS] Twilio URL returned ${response.status}: ${url}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[MMS] Download timeout (${timeout}ms): ${url}`)
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
 */
export async function refreshAttachmentUrls(r2Keys: string[]): Promise<string[]> {
  const urls: string[] = []
  for (const key of r2Keys) {
    const url = await getSignedDownloadUrl(key)
    if (url) urls.push(url)
  }
  return urls
}
