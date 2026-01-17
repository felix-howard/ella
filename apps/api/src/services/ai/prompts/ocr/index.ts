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
import {
  get1099KExtractionPrompt as _get1099KPrompt,
  validate1099KData as _validate1099K,
  FORM_1099_K_FIELD_LABELS_VI as _1099KLabels,
} from './1099-k'
import {
  getScheduleK1ExtractionPrompt as _getK1Prompt,
  validateScheduleK1Data as _validateK1,
  SCHEDULE_K1_FIELD_LABELS_VI as _K1Labels,
} from './k-1'
import {
  getBankStatementExtractionPrompt as _getBankStatementPrompt,
  validateBankStatementData as _validateBankStatement,
  BANK_STATEMENT_FIELD_LABELS_VI as _BankStatementLabels,
} from './bank-statement'
import {
  get1099DivExtractionPrompt as _get1099DivPrompt,
  validate1099DivData as _validate1099Div,
  FORM_1099_DIV_FIELD_LABELS_VI as _1099DivLabels,
} from './1099-div'
import {
  get1099RExtractionPrompt as _get1099RPrompt,
  validate1099RData as _validate1099R,
  FORM_1099_R_FIELD_LABELS_VI as _1099RLabels,
} from './1099-r'
import {
  getSsa1099ExtractionPrompt as _getSsa1099Prompt,
  validateSsa1099Data as _validateSsa1099,
  FORM_SSA_1099_FIELD_LABELS_VI as _Ssa1099Labels,
} from './1099-ssa'
import {
  get1098ExtractionPrompt as _get1098Prompt,
  validate1098Data as _validate1098,
  FORM_1098_FIELD_LABELS_VI as _1098Labels,
} from './1098'
import {
  get1095AExtractionPrompt as _get1095APrompt,
  validate1095AData as _validate1095A,
  FORM_1095_A_FIELD_LABELS_VI as _1095ALabels,
} from './1095-a'

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

// Re-export 1099-K prompt and types
export {
  get1099KExtractionPrompt,
  validate1099KData,
  FORM_1099_K_FIELD_LABELS_VI,
} from './1099-k'
export type { Form1099KExtractedData } from './1099-k'

// Re-export Schedule K-1 prompt and types
export {
  getScheduleK1ExtractionPrompt,
  validateScheduleK1Data,
  SCHEDULE_K1_FIELD_LABELS_VI,
} from './k-1'
export type { ScheduleK1ExtractedData } from './k-1'

// Re-export Bank Statement prompt and types
export {
  getBankStatementExtractionPrompt,
  validateBankStatementData,
  BANK_STATEMENT_FIELD_LABELS_VI,
} from './bank-statement'
export type { BankStatementExtractedData } from './bank-statement'

// Re-export 1099-DIV prompt and types
export {
  get1099DivExtractionPrompt,
  validate1099DivData,
  FORM_1099_DIV_FIELD_LABELS_VI,
} from './1099-div'
export type { Form1099DivExtractedData } from './1099-div'

// Re-export 1099-R prompt and types
export {
  get1099RExtractionPrompt,
  validate1099RData,
  FORM_1099_R_FIELD_LABELS_VI,
} from './1099-r'
export type { Form1099RExtractedData } from './1099-r'

// Re-export SSA-1099 prompt and types
export {
  getSsa1099ExtractionPrompt,
  validateSsa1099Data,
  FORM_SSA_1099_FIELD_LABELS_VI,
} from './1099-ssa'
export type { FormSsa1099ExtractedData } from './1099-ssa'

// Re-export 1098 prompt and types
export {
  get1098ExtractionPrompt,
  validate1098Data,
  FORM_1098_FIELD_LABELS_VI,
} from './1098'
export type { Form1098ExtractedData } from './1098'

// Re-export 1095-A prompt and types
export {
  get1095AExtractionPrompt,
  validate1095AData,
  FORM_1095_A_FIELD_LABELS_VI,
} from './1095-a'
export type { Form1095AExtractedData } from './1095-a'

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
  | 'FORM_1099_SSA'
  | 'FORM_1098'
  | 'FORM_1095_A'
  | 'SCHEDULE_K1'
  | 'BANK_STATEMENT'
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
    case 'FORM_1099_K':
      return _get1099KPrompt()
    case 'FORM_1099_DIV':
      return _get1099DivPrompt()
    case 'FORM_1099_R':
      return _get1099RPrompt()
    case 'FORM_1099_SSA':
      return _getSsa1099Prompt()
    case 'FORM_1098':
      return _get1098Prompt()
    case 'FORM_1095_A':
      return _get1095APrompt()
    case 'SCHEDULE_K1':
      return _getK1Prompt()
    case 'BANK_STATEMENT':
      return _getBankStatementPrompt()
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
    'FORM_1099_K',
    'FORM_1099_DIV',
    'FORM_1099_R',
    'FORM_1099_SSA',
    'FORM_1098',
    'FORM_1095_A',
    'SCHEDULE_K1',
    'BANK_STATEMENT',
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
    case 'FORM_1099_K':
      return _validate1099K(data)
    case 'FORM_1099_DIV':
      return _validate1099Div(data)
    case 'FORM_1099_R':
      return _validate1099R(data)
    case 'FORM_1099_SSA':
      return _validateSsa1099(data)
    case 'FORM_1098':
      return _validate1098(data)
    case 'FORM_1095_A':
      return _validate1095A(data)
    case 'SCHEDULE_K1':
      return _validateK1(data)
    case 'BANK_STATEMENT':
      return _validateBankStatement(data)
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
    case 'FORM_1099_K':
      return _1099KLabels
    case 'FORM_1099_DIV':
      return _1099DivLabels
    case 'FORM_1099_R':
      return _1099RLabels
    case 'FORM_1099_SSA':
      return _Ssa1099Labels
    case 'FORM_1098':
      return _1098Labels
    case 'FORM_1095_A':
      return _1095ALabels
    case 'SCHEDULE_K1':
      return _K1Labels
    case 'BANK_STATEMENT':
      return _BankStatementLabels
    case 'SSN_CARD':
      return _SsnCardLabels
    case 'DRIVER_LICENSE':
      return _DLLabels
    default:
      return {}
  }
}
