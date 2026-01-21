/**
 * Inngest Client Singleton
 * Durable background job processing for document classification
 */

import { Inngest } from 'inngest'

/**
 * Event payload for document upload
 * Triggered when a new document is uploaded and needs classification
 */
export type DocumentUploadedEvent = {
  data: {
    rawImageId: string
    caseId: string
    r2Key: string
    mimeType: string
    uploadedAt: string
  }
}

/**
 * Event payload for classification completion
 * Used to notify frontend of classification results
 * @phase Phase 05 - Real-time Updates
 */
export type ClassificationCompleteEvent = {
  data: {
    rawImageId: string
    caseId: string
    docType: string | null
    confidence: number
    status: 'success' | 'failed' | 'needs_review'
    errorMessage?: string
  }
}

/**
 * Event map for type-safe event handling
 */
export type Events = {
  'document/uploaded': DocumentUploadedEvent
  'document/classification.complete': ClassificationCompleteEvent
}

/**
 * Inngest client singleton
 * All background jobs should use this instance
 */
export const inngest = new Inngest({
  id: 'ella',
})
