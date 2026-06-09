/**
 * PDF merge helper for the "upload your own PDF" agreement flow.
 *
 * Uploaded source PDFs are kept byte-for-byte intact; at signing time we append
 * a separately-rendered Acceptance & Signature page (react-pdf) onto the end.
 * pdf-lib copies the appended page(s) into the base document so the original
 * pages keep their exact layout/fonts.
 */
import { PDFDocument } from 'pdf-lib'

/**
 * Append every page of `appendBytes` to the end of `baseBytes` and return the
 * merged PDF buffer.
 *
 * `ignoreEncryption: true` lets us load source PDFs that carry permission flags
 * (common in exported engagement letters) without throwing. Password-encrypted
 * PDFs still fail to copy — the caller surfaces that as a validation error at
 * upload time, not at signing time.
 */
export async function appendPagesToPdf(
  baseBytes: Buffer | Uint8Array,
  appendBytes: Buffer | Uint8Array,
): Promise<Buffer> {
  const base = await PDFDocument.load(baseBytes, { ignoreEncryption: true })
  const append = await PDFDocument.load(appendBytes, { ignoreEncryption: true })

  const copied = await base.copyPages(append, append.getPageIndices())
  copied.forEach((page) => base.addPage(page))

  const merged = await base.save()
  return Buffer.from(merged)
}

/**
 * Count pages of a PDF buffer. Throws if the buffer isn't a parseable PDF — used
 * at upload time to reject corrupt/encrypted files before they reach signing.
 */
export async function countPdfPages(bytes: Buffer | Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  return doc.getPageCount()
}
