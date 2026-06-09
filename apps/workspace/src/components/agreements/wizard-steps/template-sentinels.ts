/**
 * Client-only sentinels used by the agreement send wizard to flag template
 * picker outcomes that are NOT real org templates. Never sent to the server.
 *
 * - BLANK_TEMPLATE: user picked "Start blank" — empty editor.
 * - BUILTIN_NDA_TEMPLATE: user picked the synthetic "Default NDA" card —
 *   editor seeds from the built-in NDA template via the /default-html endpoint.
 * - BUILTIN_ENGAGEMENT_LETTER_TEMPLATE: user picked the synthetic default
 *   engagement letter card.
 *
 * The orchestrator strips both before submit; the server resolves NDA
 * without templateId/contentHtml to the built-in default, and the editor
 * always supplies contentHtml so the snapshot remains exact.
 */
export const BLANK_TEMPLATE = '__blank__'
export const BUILTIN_NDA_TEMPLATE = '__builtin_nda__'
export const BUILTIN_ENGAGEMENT_LETTER_TEMPLATE = '__builtin_engagement_letter__'
/**
 * - UPLOAD_PDF_TEMPLATE: user chose "Upload PDF" — Step 3 swaps to the upload
 *   editor and the agreement is created from the uploaded PDF (uploadedPdfKey),
 *   not from contentHtml/templateId.
 */
export const UPLOAD_PDF_TEMPLATE = '__upload_pdf__'
