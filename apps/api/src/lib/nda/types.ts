/**
 * Shared types for NDA template + PDF rendering.
 *
 * Templates are versioned TS modules (see template-v1.ts). Each module
 * exports a `NdaTemplate` with a pure `render(vars)` function — no DB row,
 * no editor UI. Bumping the version = copying the file and editing.
 */

export interface TemplateVars {
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
