import { randomUUID } from 'node:crypto'

export const MAX_MESSAGE_IMAGE_COUNT = 4
export const MAX_MMS_TOTAL_BYTES = 5 * 1024 * 1024
export const MAX_MMS_REQUEST_BYTES = MAX_MMS_TOTAL_BYTES + 512 * 1024

const MESSAGE_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export const ALLOWED_MESSAGE_IMAGE_TYPES = new Set(Object.keys(MESSAGE_IMAGE_EXTENSIONS))

export interface ValidMessageImage {
  buffer: Buffer
  contentType: string
  extension: string
}

export function isUploadedFile(value: unknown): value is File {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as File).arrayBuffer === 'function' &&
    typeof (value as File).type === 'string' &&
    typeof (value as File).size === 'number'
  )
}

export async function validateMessageImageFiles(values: unknown[]): Promise<
  | { ok: true; images: ValidMessageImage[] }
  | { ok: false; status: 400 | 413; error: string; message: string }
> {
  const files = values.filter(isUploadedFile)

  if (files.length > MAX_MESSAGE_IMAGE_COUNT) {
    return {
      ok: false,
      status: 400,
      error: 'TOO_MANY_ATTACHMENTS',
      message: `Messages can include up to ${MAX_MESSAGE_IMAGE_COUNT} images`,
    }
  }

  let totalBytes = 0
  const images: ValidMessageImage[] = []

  for (const file of files) {
    if (file.size === 0) {
      return {
        ok: false,
        status: 400,
        error: 'EMPTY_ATTACHMENT',
        message: 'Image attachments cannot be empty',
      }
    }

    if (!ALLOWED_MESSAGE_IMAGE_TYPES.has(file.type)) {
      return {
        ok: false,
        status: 400,
        error: 'UNSUPPORTED_ATTACHMENT_TYPE',
        message: 'Only JPEG, PNG, GIF, HEIC, and HEIF images are supported',
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!hasExpectedImageSignature(buffer, file.type)) {
      return {
        ok: false,
        status: 400,
        error: 'INVALID_ATTACHMENT_CONTENT',
        message: 'Image attachment content does not match the declared file type',
      }
    }

    totalBytes += buffer.length
    if (totalBytes > MAX_MMS_TOTAL_BYTES) {
      return {
        ok: false,
        status: 413,
        error: 'ATTACHMENTS_TOO_LARGE',
        message: 'Image attachments must be 5 MB total or less',
      }
    }

    images.push({
      buffer,
      contentType: file.type,
      extension: MESSAGE_IMAGE_EXTENSIONS[file.type] ?? 'jpg',
    })
  }

  return { ok: true, images }
}

export function getMessageAttachmentValues(formData: FormData): unknown[] {
  return [
    ...formData.getAll('images'),
    ...formData.getAll('images[]'),
    ...formData.getAll('attachments'),
    ...formData.getAll('attachments[]'),
  ]
}

export function generateMessageAttachmentKey(input: {
  organizationId: string
  caseId: string
  uploadId: string
  extension: string
  index: number
}): string {
  return [
    'message-attachments',
    input.organizationId,
    input.caseId,
    input.uploadId,
    `${input.index + 1}.${input.extension}`,
  ].join('/')
}

export function generateMessageAttachmentUploadId(): string {
  return randomUUID()
}

function hasExpectedImageSignature(buffer: Buffer, contentType: string): boolean {
  if (contentType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }

  if (contentType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }

  if (contentType === 'image/gif') {
    const signature = buffer.subarray(0, 6).toString('ascii')
    return signature === 'GIF87a' || signature === 'GIF89a'
  }

  if (contentType === 'image/heic' || contentType === 'image/heif') {
    if (buffer.length < 12 || buffer.subarray(4, 8).toString('ascii') !== 'ftyp') return false
    const brandBytes = buffer.subarray(8, Math.min(buffer.length, 32)).toString('ascii')
    return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].some((brand) => brandBytes.includes(brand))
  }

  return false
}
