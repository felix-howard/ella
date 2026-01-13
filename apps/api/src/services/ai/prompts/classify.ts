/**
 * Document Classification Prompt
 * Prompt for classifying tax document types using Gemini vision
 */

// All supported document types matching the DocType enum in schema
export const SUPPORTED_DOC_TYPES = [
  'SSN_CARD',
  'DRIVER_LICENSE',
  'PASSPORT',
  'W2',
  'FORM_1099_INT',
  'FORM_1099_DIV',
  'FORM_1099_NEC',
  'FORM_1099_MISC',
  'FORM_1099_K',
  'FORM_1099_R',
  'FORM_1099_G',
  'FORM_1099_SSA',
  'BANK_STATEMENT',
  'PROFIT_LOSS_STATEMENT',
  'BUSINESS_LICENSE',
  'EIN_LETTER',
  'FORM_1098',
  'FORM_1098_T',
  'RECEIPT',
  'BIRTH_CERTIFICATE',
  'DAYCARE_RECEIPT',
  'OTHER',
] as const

export type SupportedDocType = (typeof SUPPORTED_DOC_TYPES)[number]

/**
 * Expected classification result structure
 */
export interface ClassificationResult {
  docType: SupportedDocType | 'UNKNOWN'
  confidence: number // 0-1 scale
  reasoning: string
  alternativeTypes?: Array<{
    docType: SupportedDocType
    confidence: number
  }>
}

/**
 * Generate the classification prompt
 */
export function getClassificationPrompt(): string {
  return `You are an expert document classifier for US tax preparation. Analyze the image and classify it into one of these document types:

IDENTIFICATION DOCUMENTS:
- SSN_CARD: Social Security Card (blue/white card with SSN number)
- DRIVER_LICENSE: Driver's license or state ID card
- PASSPORT: US or foreign passport

TAX FORMS - INCOME:
- W2: Form W-2 Wage and Tax Statement (from employers)
- FORM_1099_INT: Form 1099-INT Interest Income (from banks)
- FORM_1099_DIV: Form 1099-DIV Dividend Income
- FORM_1099_NEC: Form 1099-NEC Nonemployee Compensation (freelance/contractor)
- FORM_1099_MISC: Form 1099-MISC Miscellaneous Income
- FORM_1099_K: Form 1099-K Payment Card and Third Party Network Transactions
- FORM_1099_R: Form 1099-R Distributions from Retirement Plans
- FORM_1099_G: Form 1099-G Government Payments (unemployment, refunds)
- FORM_1099_SSA: Form SSA-1099 Social Security Benefits

TAX FORMS - DEDUCTIONS:
- FORM_1098: Form 1098 Mortgage Interest Statement
- FORM_1098_T: Form 1098-T Tuition Statement

BUSINESS DOCUMENTS:
- BANK_STATEMENT: Bank account statements
- PROFIT_LOSS_STATEMENT: Business profit/loss statements
- BUSINESS_LICENSE: Business license or registration
- EIN_LETTER: IRS EIN assignment letter (CP 575)

OTHER DOCUMENTS:
- RECEIPT: General receipts, invoices
- BIRTH_CERTIFICATE: Birth certificate (for dependents)
- DAYCARE_RECEIPT: Childcare/daycare receipts or statements
- OTHER: Other document types not listed above

If the image is unclear, unreadable, or doesn't match any category, use UNKNOWN.

Respond in JSON format:
{
  "docType": "DOC_TYPE_HERE",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this classification was chosen",
  "alternativeTypes": [
    {"docType": "ALTERNATIVE_TYPE", "confidence": 0.3}
  ]
}

Rules:
1. confidence should be 0-1 where 1 is absolutely certain
2. Include alternativeTypes only if confidence < 0.8
3. Look for key identifiers: form numbers, titles, logos
4. For 1099 forms, note the specific variant (INT, DIV, NEC, etc.)
5. For W2, look for "Wage and Tax Statement" and boxes for wages/taxes`
}

/**
 * Validate classification result
 */
export function validateClassificationResult(
  result: unknown
): result is ClassificationResult {
  if (!result || typeof result !== 'object') return false

  const r = result as Record<string, unknown>

  if (typeof r.docType !== 'string') return false
  if (typeof r.confidence !== 'number') return false
  if (typeof r.reasoning !== 'string') return false

  // Validate docType is valid
  const validTypes = [...SUPPORTED_DOC_TYPES, 'UNKNOWN']
  if (!validTypes.includes(r.docType as SupportedDocType)) return false

  // Validate confidence range
  if (r.confidence < 0 || r.confidence > 1) return false

  return true
}
