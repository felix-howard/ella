import type { StaffFileContentType, StaffFileKind } from '../../lib/api-client'

const MAX_STAFF_FILE_BYTES = 10 * 1024 * 1024
const MIN_STAFF_FILE_BYTES = 100
const MAX_STAFF_FILE_TITLE_LENGTH = 120
const MAX_STAFF_FILE_CATEGORY_LENGTH = 80

const CONTENT_TYPES_BY_EXTENSION: Record<string, StaffFileContentType> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export interface StaffFileUploadDraft {
  file: File
  kind: StaffFileKind
  title?: string
  category?: string
  invoiceYear?: number
  invoiceMonth?: number
}

export type StaffFileUploadValidationResult =
  | { ok: true; contentType: StaffFileContentType; title: string; category?: string }
  | { ok: false; messageKey: string }

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

function resolveContentType(file: File): StaffFileContentType | null {
  const extensionType = CONTENT_TYPES_BY_EXTENSION[getFileExtension(file.name)]
  if (!extensionType) return null
  return file.type === extensionType ? extensionType : null
}

export function validateStaffFileUploadDraft(
  input: StaffFileUploadDraft
): StaffFileUploadValidationResult {
  const contentType = resolveContentType(input.file)
  if (!contentType) return { ok: false, messageKey: 'profile.staffFiles.invalidFileType' }

  if (input.file.size > MAX_STAFF_FILE_BYTES) {
    return { ok: false, messageKey: 'profile.staffFiles.fileTooLarge' }
  }

  if (input.file.size < MIN_STAFF_FILE_BYTES) {
    return { ok: false, messageKey: 'profile.staffFiles.fileTooSmall' }
  }

  const title = input.title?.trim() || input.file.name
  const category = input.category?.trim() || undefined

  if (title.length > MAX_STAFF_FILE_TITLE_LENGTH) {
    return { ok: false, messageKey: 'profile.staffFiles.titleTooLong' }
  }

  if (category && category.length > MAX_STAFF_FILE_CATEGORY_LENGTH) {
    return { ok: false, messageKey: 'profile.staffFiles.categoryTooLong' }
  }

  if (input.kind === 'INVOICE' && (!input.invoiceYear || !input.invoiceMonth)) {
    return { ok: false, messageKey: 'profile.staffFiles.invoiceMonthRequired' }
  }

  if (
    input.invoiceYear !== undefined &&
    (input.invoiceYear < 2000 || input.invoiceYear > 2100 ||
      !input.invoiceMonth || input.invoiceMonth < 1 || input.invoiceMonth > 12)
  ) {
    return { ok: false, messageKey: 'profile.staffFiles.invoiceDateInvalid' }
  }

  return { ok: true, contentType, title, category }
}

export function putFileWithProgress(
  uploadUrl: string,
  file: File,
  contentType: StaffFileContentType,
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve()
        return
      }
      reject(new Error(`Upload failed with status ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.onabort = () => reject(new Error('Upload canceled'))
    xhr.send(file)
  })
}
