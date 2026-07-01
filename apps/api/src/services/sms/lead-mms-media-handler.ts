import {
  getSafeStorageError,
  getSafeStorageReference,
  getStorageStatus,
  uploadFile,
} from '../storage'
import {
  downloadFromTwilioUrl,
  getExtensionFromMimeType,
} from './mms-media-handler'
import type { TwilioIncomingMessage } from './webhook-handler'

const MEDIA_DOWNLOAD_TIMEOUT_MS = 15000
const MAX_MEDIA_COUNT = 10

export interface LeadMmsMediaResult {
  attachmentUrls: string[]
  attachmentR2Keys: string[]
  errors: string[]
}

function getIncomingMediaItems(incomingMsg: TwilioIncomingMessage) {
  return [
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
}

function buildLeadMessageAttachmentKey(input: {
  organizationId: string
  leadId: string
  twilioSid: string
  index: number
  extension: string
}) {
  return [
    'lead-message-attachments',
    input.organizationId,
    input.leadId,
    input.twilioSid.replace(/[^a-zA-Z0-9_-]/g, '_'),
    `${input.index}.${input.extension}`,
  ].join('/')
}

export async function processLeadMmsMedia(
  incomingMsg: TwilioIncomingMessage,
  lead: { id: string; organizationId: string }
): Promise<LeadMmsMediaResult> {
  const result: LeadMmsMediaResult = {
    attachmentUrls: [],
    attachmentR2Keys: [],
    errors: [],
  }

  const numMedia = Number.parseInt(incomingMsg.NumMedia || '0', 10)
  if (numMedia <= 0) return result

  const storageStatus = getStorageStatus()
  if (!storageStatus.configured) {
    console.error('[LeadMMS] R2 storage is not configured; lead MMS will not be persisted')
    result.errors.push('R2 storage not configured - media cannot be persisted')
    return result
  }

  const mediaItems = getIncomingMediaItems(incomingMsg)
  const mediaCount = Math.min(numMedia, MAX_MEDIA_COUNT)

  for (let index = 0; index < mediaCount; index += 1) {
    const mediaUrl = mediaItems[index]?.url
    const mediaContentType = mediaItems[index]?.type || 'image/jpeg'

    if (!mediaUrl) {
      result.errors.push(`MediaUrl${index} not found`)
      continue
    }

    let r2Key: string | null = null
    try {
      const mediaBuffer = await downloadFromTwilioUrl(mediaUrl, MEDIA_DOWNLOAD_TIMEOUT_MS)
      if (!mediaBuffer) {
        result.errors.push(`Failed to download MediaUrl${index}`)
        continue
      }

      r2Key = buildLeadMessageAttachmentKey({
        organizationId: lead.organizationId,
        leadId: lead.id,
        twilioSid: incomingMsg.MessageSid,
        index,
        extension: getExtensionFromMimeType(mediaContentType),
      })

      const upload = await uploadFile(r2Key, mediaBuffer, mediaContentType)
      if (!upload.url) {
        result.errors.push(`R2 upload failed for MediaUrl${index}`)
        continue
      }

      result.attachmentUrls.push(upload.url)
      result.attachmentR2Keys.push(upload.key)
      console.log('[LeadMMS] Stored lead message attachment', {
        leadId: lead.id,
        index,
        object: getSafeStorageReference(upload.key),
      })
    } catch (error) {
      const safeError = getSafeStorageError(error)
      result.errors.push(`Error processing MediaUrl${index}: ${safeError.message}`)
      console.error('[LeadMMS] Failed to process lead media', {
        leadId: lead.id,
        index,
        object: r2Key ? getSafeStorageReference(r2Key) : undefined,
        error: safeError,
      })
    }
  }

  return result
}
