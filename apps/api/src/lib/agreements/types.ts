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
  /** v2: State whose law governs the agreement (e.g. "Texas"). */
  governingState?: string
  /** v2: "{County}, {State}" locality string for court jurisdiction. */
  governingCounty?: string
  /** v2: Confidentiality duration text (e.g. "five (5)"). */
  confidentialityYears?: string
}

export interface TemplateSection {
  heading: string
  paragraphs: string[]
  /** Optional unordered (bullet) list rendered after paragraphs. */
  bullets?: string[]
  /** Optional ordered list rendered after bullets or paragraphs. */
  ordered?: string[]
  /** Optional paragraphs rendered after bullets/ordered (list-continuation text). */
  trailingParagraphs?: string[]
  /** When true, signals that only a signature-block placeholder should be emitted. */
  signaturePlaceholder?: boolean
}

export interface NdaTemplate {
  version: string
  title: string
  /** Optional subtitle rendered below the title. v1 omits this. */
  subtitle?: string
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
