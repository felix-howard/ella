/**
 * OCR Prompts Index
 * Router for document-type specific OCR extraction prompts
 */

// Import for internal use
import {
  getW2ExtractionPrompt as _getW2Prompt,
  validateW2Data as _validateW2,
  W2_FIELD_LABELS_VI as _W2Labels,
} from './w2'
import {
  get1099IntExtractionPrompt as _get1099IntPrompt,
  validate1099IntData as _validate1099Int,
  FORM_1099_INT_FIELD_LABELS_VI as _1099IntLabels,
} from './1099-int'

// Re-export W2 prompt and types
export {
  getW2ExtractionPrompt,
  validateW2Data,
  W2_FIELD_LABELS_VI,
} from './w2'
export type { W2ExtractedData } from './w2'

// Re-export 1099-INT prompt and types
export {
  get1099IntExtractionPrompt,
  validate1099IntData,
  FORM_1099_INT_FIELD_LABELS_VI,
} from './1099-int'
export type { Form1099IntExtractedData } from './1099-int'

/**
 * Supported OCR document types
 */
export type OcrDocType =
  | 'W2'
  | 'FORM_1099_INT'
  | 'FORM_1099_NEC'
  | 'FORM_1099_DIV'
  | 'FORM_1099_K'
  | 'FORM_1099_R'
  | 'SSN_CARD'
  | 'DRIVER_LICENSE'

/**
 * Get the appropriate OCR prompt for a document type
 * Returns null if document type doesn't have OCR support
 */
export function getOcrPromptForDocType(docType: string): string | null {
  switch (docType) {
    case 'W2':
      return _getW2Prompt()
    case 'FORM_1099_INT':
      return _get1099IntPrompt()
    // Future prompts will be added here:
    // case 'FORM_1099_NEC':
    //   return get1099NecExtractionPrompt()
    // case 'SSN_CARD':
    //   return getSsnCardExtractionPrompt()
    default:
      return null
  }
}

/**
 * Check if a document type supports OCR extraction
 */
export function supportsOcrExtraction(docType: string): boolean {
  const supportedTypes: string[] = [
    'W2',
    'FORM_1099_INT',
    // Future supported types:
    // 'FORM_1099_NEC',
    // 'FORM_1099_DIV',
    // 'SSN_CARD',
    // 'DRIVER_LICENSE',
  ]
  return supportedTypes.includes(docType)
}

/**
 * Validate extracted data based on document type
 */
export function validateExtractedData(docType: string, data: unknown): boolean {
  switch (docType) {
    case 'W2':
      return _validateW2(data)
    case 'FORM_1099_INT':
      return _validate1099Int(data)
    default:
      return false
  }
}

/**
 * Get field labels for a document type
 */
export function getFieldLabels(docType: string): Record<string, string> {
  switch (docType) {
    case 'W2':
      return _W2Labels
    case 'FORM_1099_INT':
      return _1099IntLabels
    default:
      return {}
  }
}
