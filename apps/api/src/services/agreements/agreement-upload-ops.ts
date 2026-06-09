/**
 * Staff upload of a source PDF for the "upload your own PDF" agreement flow.
 *
 * Validates the upload (PDF magic bytes, size cap, parseable by pdf-lib) then
 * stores it to R2 under a per-entity key. The returned key is later passed to
 * `createAgreementForEntity` which snapshots it onto the Agreement row. At
 * signing time the stored PDF is fetched and a signature page is appended.
 *
 * Server-side (not presigned) upload is intentional: it lets us validate the
 * bytes are a real, parseable PDF before they can ever reach the signing flow.
 */
import { customAlphabet } from 'nanoid'
import { HTTPException } from 'hono/http-exception'
import { uploadFile, getSignedDownloadUrl } from '../storage'
import { countPdfPages } from './pdf-merge'
import type { EntityType } from './entity-loader'

/** 15 MB — engagement letters are small; this also bounds signing-time memory. */
export const MAX_UPLOADED_PDF_BYTES = 15 * 1024 * 1024
const PREVIEW_TTL_SECONDS = 900
const generateUploadNonce = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16)

/** All uploaded-PDF R2 keys live under this prefix (validated again at create). */
export const UPLOADED_PDF_KEY_PREFIX = 'agreements/uploads/'

/** `%PDF` — first four bytes of every valid PDF file. */
function hasPdfMagicBytes(bytes: Buffer): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  )
}

export function buildUploadedPdfKey(entityId: string): string {
  return `${UPLOADED_PDF_KEY_PREFIX}${entityId}/${generateUploadNonce()}.pdf`
}

/**
 * Assert an uploadedPdfKey supplied at agreement-create time is well-formed and
 * scoped to the right entity. Defense against a caller referencing an arbitrary
 * R2 object. Throws 422 on mismatch.
 */
export function assertValidUploadedPdfKey(key: string, entityId: string): void {
  if (!key.startsWith(`${UPLOADED_PDF_KEY_PREFIX}${entityId}/`) || !key.endsWith('.pdf')) {
    throw new HTTPException(422, { message: 'Invalid uploaded PDF reference' })
  }
}

export interface StoreUploadedPdfInput {
  entityType: EntityType
  entityId: string
  orgId: string
  bytes: Buffer
  contentType: string | null
}

export interface StoreUploadedPdfResult {
  key: string
  pageCount: number
  /** Presigned URL so the wizard can preview the just-uploaded PDF. */
  previewUrl: string | null
}

export async function storeUploadedPdf(
  input: StoreUploadedPdfInput,
): Promise<StoreUploadedPdfResult> {
  if (input.bytes.length === 0) {
    throw new HTTPException(422, { message: 'Uploaded file is empty' })
  }
  if (input.bytes.length > MAX_UPLOADED_PDF_BYTES) {
    throw new HTTPException(413, { message: 'PDF exceeds the 15 MB size limit' })
  }
  if (!hasPdfMagicBytes(input.bytes)) {
    throw new HTTPException(422, { message: 'File is not a valid PDF' })
  }

  // Confirm pdf-lib can actually parse it (rejects corrupt / password-encrypted
  // PDFs now, rather than failing silently when the signature page is appended).
  let pageCount: number
  try {
    pageCount = await countPdfPages(input.bytes)
  } catch {
    throw new HTTPException(422, {
      message: 'PDF could not be read. Re-export it without password protection and try again.',
    })
  }
  if (pageCount < 1) {
    throw new HTTPException(422, { message: 'PDF has no pages' })
  }

  const key = buildUploadedPdfKey(input.entityId)
  await uploadFile(key, input.bytes, 'application/pdf')
  const previewUrl = await getSignedDownloadUrl(key, PREVIEW_TTL_SECONDS)

  return { key, pageCount, previewUrl }
}
