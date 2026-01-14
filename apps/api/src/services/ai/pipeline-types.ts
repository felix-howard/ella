/**
 * AI Pipeline Types and Interfaces
 * Shared types for document processing pipeline
 */
import type { DocType, ActionType, ActionPriority } from '@ella/db'

/**
 * Pipeline result for a single image
 */
export interface PipelineResult {
  rawImageId: string
  success: boolean
  classification?: {
    docType: DocType | 'UNKNOWN'
    confidence: number
  }
  blurDetection?: {
    isBlurry: boolean
    blurScore: number
    needsResend: boolean
    message?: string
  }
  ocrExtraction?: {
    success: boolean
    hasData: boolean
    confidence: number
  }
  digitalDocId?: string
  actionsCreated: string[]
  error?: string
  processingTimeMs: number
}

/**
 * Typed action metadata schemas for different action types
 */
export interface ActionMetadataBase {
  rawImageId: string
}

export interface ClassificationFailedMetadata extends ActionMetadataBase {
  error?: string
}

export interface BlurryDetectedMetadata extends ActionMetadataBase {
  docType: DocType | 'UNKNOWN'
  blurScore: number
}

export interface VerifyDocsMetadata extends ActionMetadataBase {
  digitalDocId?: string
  docType?: DocType
  confidence?: number
}

export interface AiFailedMetadata extends ActionMetadataBase {
  errorMessage?: string
  r2Key?: string
  attemptedAt?: string
}

/**
 * Union type for all action metadata
 */
export type ActionMetadata =
  | ClassificationFailedMetadata
  | BlurryDetectedMetadata
  | VerifyDocsMetadata
  | AiFailedMetadata

/**
 * Action creation params
 */
export interface CreateActionParams {
  caseId: string
  type: ActionType
  priority: ActionPriority
  title: string
  description: string
  metadata: ActionMetadata
}

/**
 * Batch processing input
 */
export interface BatchImageInput {
  id: string
  buffer: Buffer
  mimeType: string
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  maxRetries: number
  retryDelayMs: number
  batchConcurrency: number
}

/**
 * Default pipeline configuration
 */
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  maxRetries: 2,
  retryDelayMs: 1000,
  batchConcurrency: 3,
}
