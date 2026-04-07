/**
 * Generic OCR Extraction Prompt
 * Universal fallback extractor for any document type not covered by specific prompts.
 * Handles 53+ variable-format document types dynamically.
 */

/**
 * Generic extracted data structure
 * Flexible format for any document type
 */
export interface GenericExtractedData {
  documentType: string
  extractedFields: Array<{
    fieldName: string
    fieldValue: string | number | boolean | null
    fieldType: 'text' | 'date' | 'amount' | 'identifier' | 'boolean'
  }>
  rawText: string | null
  taxRelevanceNotes: string | null
  extractedAt: string
}

/**
 * Sanitize docType to prevent prompt injection
 */
function sanitizeDocType(docType: string): string {
  return docType.replace(/[^a-zA-Z0-9_\-\s]/g, '').slice(0, 100)
}

/**
 * Generate generic OCR extraction prompt
 * Takes classified docType as context hint for the AI
 */
export function getGenericExtractionPrompt(docType: string): string {
  const safeDocType = sanitizeDocType(docType)

  return `You are an expert OCR system for extracting data from tax documents.
The document has been classified as: ${safeDocType}

TASK: Extract ALL visible labeled fields as key-value pairs.

PRIORITIES (extract if present):
1. Names (person names, company names, organization names)
2. Monetary amounts (all dollar values, totals, subtotals)
3. Dates (all dates in MM/DD/YYYY format)
4. Identifiers (SSN, EIN, account numbers, reference numbers)
5. Addresses (full addresses)
6. Descriptions (any descriptive text explaining transactions)

RESPONSE FORMAT (JSON):
{
  "documentType": "${safeDocType}",
  "extractedFields": [
    {"fieldName": "Total Amount", "fieldValue": 1234.56, "fieldType": "amount"},
    {"fieldName": "Issue Date", "fieldValue": "01/15/2025", "fieldType": "date"},
    {"fieldName": "Recipient Name", "fieldValue": "John Doe", "fieldType": "text"},
    {"fieldName": "Account Number", "fieldValue": "XXX-12345", "fieldType": "identifier"}
  ],
  "rawText": "Any important unstructured text from the document",
  "taxRelevanceNotes": "Why this document matters for taxes (brief)"
}

RULES:
1. Use null for fields that cannot be read clearly
2. Amounts: numbers only (no $ or commas)
3. Dates: MM/DD/YYYY format
4. SSN/EIN: include dashes (XXX-XX-XXXX or XX-XXXXXXX)
5. Extract field names EXACTLY as shown on document labels
6. Include ALL visible fields, even if their purpose is unclear
7. NEVER fabricate data - only extract what you can see`
}

const VALID_FIELD_TYPES = ['text', 'date', 'amount', 'identifier', 'boolean']
const VALID_FIELD_VALUE_TYPES = ['string', 'number', 'boolean']

/**
 * Validate generic extracted data
 */
export function validateGenericData(data: unknown): data is GenericExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  if (typeof d.documentType !== 'string') return false

  if (!Array.isArray(d.extractedFields)) return false
  if (d.extractedFields.length === 0) return false

  for (const field of d.extractedFields) {
    if (typeof field !== 'object' || field === null) return false
    const f = field as Record<string, unknown>
    if (typeof f.fieldName !== 'string') return false
    if (!VALID_FIELD_TYPES.includes(f.fieldType as string)) return false
    // Validate fieldValue type
    if (f.fieldValue !== null && !VALID_FIELD_VALUE_TYPES.includes(typeof f.fieldValue)) return false
  }

  // Validate optional string|null fields
  if (d.rawText !== undefined && d.rawText !== null && typeof d.rawText !== 'string') return false
  if (d.taxRelevanceNotes !== undefined && d.taxRelevanceNotes !== null && typeof d.taxRelevanceNotes !== 'string') return false

  return true
}

/**
 * Common field name translations English → Vietnamese
 * Sorted by key length descending to match longest first
 */
const FIELD_TRANSLATIONS: [string, string][] = [
  ['Total Amount', 'Tổng số tiền'],
  ['Account Number', 'Số tài khoản'],
  ['Amount', 'Số tiền'],
  ['Address', 'Địa chỉ'],
  ['Reference', 'Số tham chiếu'],
  ['Date', 'Ngày'],
  ['Name', 'Tên'],
  ['SSN', 'Số An sinh Xã hội'],
  ['EIN', 'Số ID Doanh nghiệp'],
]

const FIELD_TYPE_HINTS: Record<string, string> = {
  amount: '(Số tiền)',
  date: '(Ngày)',
  identifier: '(Mã số)',
  text: '',
  boolean: '(Có/Không)',
}

function translateFieldLabel(name: string, type: string): string {
  // Exact match first
  for (const [key, value] of FIELD_TRANSLATIONS) {
    if (name === key) return value
  }

  // Partial match (longest keys checked first due to sorted array)
  for (const [key, value] of FIELD_TRANSLATIONS) {
    if (name.toLowerCase().includes(key.toLowerCase())) return value
  }

  return `${name} ${FIELD_TYPE_HINTS[type] || ''}`.trim()
}

/**
 * Static Vietnamese field labels for generic extractor metadata
 */
export const GENERIC_EXTRACTOR_FIELD_LABELS_VI: Record<string, string> = {
  documentType: 'Loại tài liệu',
  extractedFields: 'Các trường đã trích xuất',
  rawText: 'Văn bản thô',
  taxRelevanceNotes: 'Ghi chú liên quan thuế',
  extractedAt: 'Thời gian trích xuất',
}

/**
 * Generate Vietnamese labels for dynamically extracted fields
 */
export function generateFieldLabelsVi(data: GenericExtractedData): Record<string, string> {
  const labels: Record<string, string> = {
    documentType: GENERIC_EXTRACTOR_FIELD_LABELS_VI.documentType,
    rawText: GENERIC_EXTRACTOR_FIELD_LABELS_VI.rawText,
    taxRelevanceNotes: GENERIC_EXTRACTOR_FIELD_LABELS_VI.taxRelevanceNotes,
    extractedAt: GENERIC_EXTRACTOR_FIELD_LABELS_VI.extractedAt,
  }

  for (const field of data.extractedFields) {
    labels[field.fieldName] = translateFieldLabel(field.fieldName, field.fieldType)
  }

  return labels
}
