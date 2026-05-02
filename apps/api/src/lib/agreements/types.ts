/**
 * Shared types for built-in agreement template + PDF rendering.
 *
 * Built-in templates are versioned TS modules (see template-v1.ts). Each
 * module exports a `NdaTemplate` (legacy interface name, retained — it now
 * also covers non-NDA built-ins) with a pure `render(vars)` function. Bumping
 * the version = copying the file and editing. Org-level templates live in DB.
 */

export interface TemplateVars {
  /**
   * Recipient display name. Preferred for all new templates.
   * Resolved from Lead OR Client depending on the agreement entity.
   * Optional during the entity-agnostic transition; v1 templates fall back to
   * `leadFullName` when this is absent.
   */
  recipientFullName?: string
  /**
   * @deprecated Alias for `recipientFullName`. v1 templates still consume it
   * for backward compatibility; new templates should use `recipientFullName`.
   */
  leadFullName: string
  orgName: string
  depositAmount: string
  date: string
  templateVersion: string
}

export interface TemplateSection {
  heading: string
  paragraphs: string[]
}

export interface NdaTemplate {
  version: string
  title: string
  render(vars: TemplateVars): TemplateSection[]
}

export interface PdfSignatureInput {
  /** PNG bytes for the hand-drawn signature canvas. */
  pngBuffer: Buffer
  typedName: string
  ipAddress: string
  userAgent: string
  signedAt: Date
}
