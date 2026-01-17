/**
 * AI Services Index
 * Exports all AI-related services for document processing
 */

// Gemini Client
export {
  generateContent,
  generateJsonContent,
  analyzeImage,
  parseJsonResponse,
  imageBufferToPart,
  validateImageBuffer,
  isGeminiConfigured,
  getGeminiStatus,
  type GeminiResponse,
  type ImageData,
} from './gemini-client'

// Document Classifier
export {
  classifyDocument,
  batchClassifyDocuments,
  requiresOcrExtraction,
  getDocTypeLabel,
  type DocumentClassificationResult,
} from './document-classifier'

// Blur Detector
export {
  detectBlur,
  quickBlurCheck,
  getQualityGrade,
  shouldRequestResend,
  getResendMessage,
  type ImageQualityResult,
  type BlurIssue,
} from './blur-detector'

// OCR Extractor Service
export {
  extractDocumentData,
  getExtractionStatusMessage,
  needsManualVerification,
  type OcrExtractionResult,
} from './ocr-extractor'

// OCR Prompts (for direct access)
export {
  getOcrPromptForDocType,
  supportsOcrExtraction,
  validateExtractedData,
  getFieldLabels,
  type W2ExtractedData,
  type Form1099IntExtractedData,
  type Form1099NecExtractedData,
  type SsnCardExtractedData,
  type DriverLicenseExtractedData,
  type OcrDocType,
} from './prompts/ocr'

// Classification prompts
export {
  SUPPORTED_DOC_TYPES,
  type SupportedDocType,
  type ClassificationResult,
} from './prompts/classify'

// Blur detection types
export { type BlurDetectionResult } from './prompts/blur-check'

// Document Processing Pipeline
export {
  processImage,
  processImageBatch,
  getPipelineStatus,
} from './document-pipeline'

// Pipeline Types
export type {
  PipelineResult,
  BatchImageInput,
  PipelineConfig,
  ActionMetadata,
  CreateActionParams,
} from './pipeline-types'
export { DEFAULT_PIPELINE_CONFIG } from './pipeline-types'

// Pipeline Helpers (for advanced use)
export {
  createAction,
  linkToChecklistItem,
  upsertDigitalDoc,
} from './pipeline-helpers'

// Duplicate Detection
export {
  generateImageHash,
  isValidHash,
  hammingDistance,
  areDuplicates,
  findDuplicateGroup,
  assignToImageGroup,
  selectBestImage,
  getGroupImages,
  type DuplicateDetectionResult,
} from './duplicate-detector'

// AI Error Messages - Vietnamese localization
export {
  getVietnameseError,
  getActionTitle,
  getActionPriority,
  type AIErrorType,
} from './ai-error-messages'
