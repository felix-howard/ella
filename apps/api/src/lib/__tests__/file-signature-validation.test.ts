import { describe, expect, it } from 'vitest'
import {
  detectFileType,
  validateUploadedFiles,
  validateUploadedFileContent,
  type DetectedFileType,
} from '../validation'

function fileWithType(type: string, buffer: Buffer): { file: File; buffer: Buffer } {
  return {
    file: new File([new Uint8Array(buffer)], 'upload.bin', { type }),
    buffer,
  }
}

function heifBuffer(majorBrand: string, compatibleBrand = majorBrand): Buffer {
  return Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from('ftyp', 'ascii'),
    Buffer.from(majorBrand, 'ascii'),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
    Buffer.from(compatibleBrand, 'ascii'),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
  ])
}

describe('file signature validation', () => {
  it('rejects empty files before storage upload', () => {
    const emptyPdf = new File([], 'empty.pdf', { type: 'application/pdf' })

    expect(validateUploadedFiles([emptyPdf])).toEqual({
      valid: false,
      error: 'File "empty.pdf" is empty',
      errorCode: 'EMPTY_FILE',
    })
  })

  it.each([
    ['PDF', Buffer.from('\ufeff \n%PDF-1.7\n', 'utf8'), 'application/pdf'],
    ['JPEG', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]), 'image/jpeg'],
    ['PNG', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'],
    [
      'WebP',
      Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.alloc(4), Buffer.from('WEBP', 'ascii')]),
      'image/webp',
    ],
    ['HEIC', heifBuffer('heic'), 'image/heic'],
    ['HEIF', heifBuffer('mif1'), 'image/heif'],
  ] satisfies Array<[string, Buffer, DetectedFileType]>)(
    'detects valid %s content',
    (_label, buffer, expectedMimeType) => {
      expect(detectFileType(buffer)).toBe(expectedMimeType)
      expect(validateUploadedFileContent([fileWithType(expectedMimeType, buffer)])).toEqual({
        valid: true,
      })
    }
  )

  it('allows safe HEIC and HEIF declared MIME variants within the same family', () => {
    expect(validateUploadedFileContent([fileWithType('image/heif', heifBuffer('heic'))])).toEqual({
      valid: true,
    })
  })

  it.each([
    ['HTML renamed as PDF', Buffer.from('<html><body>not a pdf</body></html>'), 'application/pdf'],
    ['ZIP renamed as PDF', Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'application/pdf'],
    ['Executable renamed as PNG', Buffer.from('MZ executable'), 'image/png'],
    ['JPEG declared as PDF', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]), 'application/pdf'],
    ['PDF with excessive leading whitespace', Buffer.from(`${' '.repeat(32)}%PDF-1.7`), 'application/pdf'],
  ])('rejects %s', (_label, buffer, declaredMimeType) => {
    expect(validateUploadedFileContent([fileWithType(declaredMimeType, buffer)])).toEqual({
      valid: false,
      error: 'File content does not match an allowed document or image type',
      errorCode: 'INVALID_FILE_CONTENT',
    })
  })
})
