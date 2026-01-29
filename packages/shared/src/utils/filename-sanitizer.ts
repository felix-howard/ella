/**
 * Filename sanitization utilities for document naming convention
 * Format: {TaxYear}_{DocType}_{Source}_{ClientName}
 *
 * Rules:
 * - No spaces (use underscore)
 * - No Vietnamese diacritics (Nguyen -> Nguyen)
 * - No special chars (/\:*?"<>|)
 * - Max 60 chars total, PascalCase for source/name
 */

/**
 * Remove diacritics from text using Unicode normalization
 * Handles Vietnamese characters: ă, â, đ, ê, ô, ơ, ư and their tones
 */
export function removeDiacritics(text: string): string {
  return (
    text
      .normalize('NFD')
      // Remove combining diacritical marks (accents, tones)
      .replace(/[\u0300-\u036f]/g, '')
      // Handle Vietnamese đ/Đ separately (not affected by NFD)
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
  )
}

/**
 * Convert to PascalCase
 * "google llc" -> "GoogleLlc"
 * "GOOGLE LLC" -> "GoogleLlc"
 */
export function toPascalCase(text: string): string {
  return text
    .split(/[\s_-]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

/**
 * Sanitize a filename component
 * - Remove diacritics
 * - Remove special characters (keep alphanumeric only)
 * - Convert to PascalCase
 * - Enforce max length
 */
export function sanitizeComponent(input: string | null | undefined, maxLength = 30): string {
  if (!input) return ''

  const sanitized = removeDiacritics(input)
    // Remove special characters, keep spaces for PascalCase conversion
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()

  return toPascalCase(sanitized).slice(0, maxLength)
}

/**
 * Naming components for document rename
 */
export interface DocumentNamingComponents {
  taxYear: number | null
  docType: string
  source: string | null
  recipientName: string | null // Person's name extracted from document (employee, recipient, etc.)
}

/**
 * Generate document display name from components
 * Format: {TaxYear}_{DocType}_{Source}_{RecipientName}
 * Example: 2025_W2_GoogleLLC_AndyNguyen
 */
export function generateDocumentName(components: DocumentNamingComponents): string {
  const parts: string[] = []

  // Tax year (use current year if null)
  const year = components.taxYear ?? new Date().getFullYear()
  parts.push(String(year))

  // DocType (already uppercase from AI classification)
  parts.push(components.docType)

  // Source (sanitized, optional)
  const source = sanitizeComponent(components.source, 20)
  if (source) parts.push(source)

  // Recipient name from document (sanitized, optional)
  const recipientName = sanitizeComponent(components.recipientName, 20)
  if (recipientName) parts.push(recipientName)

  const name = parts.join('_')

  // Enforce max 60 chars total
  return name.slice(0, 60)
}

/**
 * Extract display name from R2 key
 * cases/abc123/docs/2025_W2_Google_Andy.pdf -> 2025_W2_Google_Andy
 */
export function getDisplayNameFromKey(r2Key: string): string {
  const filename = r2Key.split('/').pop() || ''
  // Remove file extension
  return filename.replace(/\.[^.]+$/, '')
}
