export const MAX_MESSAGE_IMAGE_COUNT = 4
export const MAX_MMS_TOTAL_BYTES = 5 * 1024 * 1024

export const ALLOWED_MESSAGE_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/heic',
  'image/heif',
] as const

export type MessageAttachmentValidationError =
  | 'too_many'
  | 'unsupported_type'
  | 'too_large'
  | 'empty_file'

export interface MessageAttachmentValidationResult {
  ok: boolean
  error?: MessageAttachmentValidationError
}

export function validateMessageAttachments(files: Pick<File, 'size' | 'type'>[]): MessageAttachmentValidationResult {
  if (files.length > MAX_MESSAGE_IMAGE_COUNT) {
    return { ok: false, error: 'too_many' }
  }

  let totalBytes = 0
  for (const file of files) {
    if (file.size <= 0) {
      return { ok: false, error: 'empty_file' }
    }
    if (!ALLOWED_MESSAGE_IMAGE_TYPES.includes(file.type as typeof ALLOWED_MESSAGE_IMAGE_TYPES[number])) {
      return { ok: false, error: 'unsupported_type' }
    }
    totalBytes += file.size
  }

  if (totalBytes > MAX_MMS_TOTAL_BYTES) {
    return { ok: false, error: 'too_large' }
  }

  return { ok: true }
}
