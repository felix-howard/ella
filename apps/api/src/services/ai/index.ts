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

// OCR Prompts (for direct access)
export {
  getOcrPromptForDocType,
  supportsOcrExtraction,
  validateExtractedData,
  getFieldLabels,
  type W2ExtractedData,
  type Form1099IntExtractedData,
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
