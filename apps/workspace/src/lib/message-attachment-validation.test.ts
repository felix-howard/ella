import { describe, expect, it } from 'vitest'
import {
  MAX_MESSAGE_IMAGE_COUNT,
  MAX_MMS_TOTAL_BYTES,
  validateMessageAttachments,
} from './message-attachment-validation'

function file(size: number, type = 'image/png'): Pick<File, 'size' | 'type'> {
  return { size, type }
}

describe('validateMessageAttachments', () => {
  it('accepts up to four supported images under the total size cap', () => {
    const files = Array.from({ length: MAX_MESSAGE_IMAGE_COUNT }, () => file(128))

    expect(validateMessageAttachments(files)).toEqual({ ok: true })
  })

  it('rejects too many images', () => {
    const files = Array.from({ length: MAX_MESSAGE_IMAGE_COUNT + 1 }, () => file(128))

    expect(validateMessageAttachments(files)).toEqual({ ok: false, error: 'too_many' })
  })

  it('rejects unsupported image types and empty files', () => {
    expect(validateMessageAttachments([file(128, 'image/webp')])).toEqual({
      ok: false,
      error: 'unsupported_type',
    })
    expect(validateMessageAttachments([file(0)])).toEqual({ ok: false, error: 'empty_file' })
  })

  it('rejects total payloads over 5 MB', () => {
    expect(validateMessageAttachments([file(MAX_MMS_TOTAL_BYTES + 1)])).toEqual({
      ok: false,
      error: 'too_large',
    })
  })
})
