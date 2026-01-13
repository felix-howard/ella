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
import {
  get1099NecExtractionPrompt as _get1099NecPrompt,
  validate1099NecData as _validate1099Nec,
  FORM_1099_NEC_FIELD_LABELS_VI as _1099NecLabels,
} from './1099-nec'
import {
  getSsnCardExtractionPrompt as _getSsnCardPrompt,
  validateSsnCardData as _validateSsnCard,
  SSN_CARD_FIELD_LABELS_VI as _SsnCardLabels,
  getDriverLicenseExtractionPrompt as _getDLPrompt,
  validateDriverLicenseData as _validateDL,
  DRIVER_LICENSE_FIELD_LABELS_VI as _DLLabels,
} from './ssn-dl'

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

// Re-export 1099-NEC prompt and types
export {
  get1099NecExtractionPrompt,
  validate1099NecData,
  FORM_1099_NEC_FIELD_LABELS_VI,
} from './1099-nec'
export type { Form1099NecExtractedData } from './1099-nec'

// Re-export SSN Card and Driver's License prompts and types
export {
  getSsnCardExtractionPrompt,
  validateSsnCardData,
  SSN_CARD_FIELD_LABELS_VI,
  getDriverLicenseExtractionPrompt,
  validateDriverLicenseData,
  DRIVER_LICENSE_FIELD_LABELS_VI,
} from './ssn-dl'
export type { SsnCardExtractedData, DriverLicenseExtractedData } from './ssn-dl'

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
    case 'FORM_1099_NEC':
      return _get1099NecPrompt()
    case 'SSN_CARD':
      return _getSsnCardPrompt()
    case 'DRIVER_LICENSE':
      return _getDLPrompt()
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
    'FORM_1099_NEC',
    'SSN_CARD',
    'DRIVER_LICENSE',
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
    case 'FORM_1099_NEC':
      return _validate1099Nec(data)
    case 'SSN_CARD':
      return _validateSsnCard(data)
    case 'DRIVER_LICENSE':
      return _validateDL(data)
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
    case 'FORM_1099_NEC':
      return _1099NecLabels
    case 'SSN_CARD':
      return _SsnCardLabels
    case 'DRIVER_LICENSE':
      return _DLLabels
    default:
      return {}
  }
}
