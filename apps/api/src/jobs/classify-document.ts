/**
 * Document Classification Job
 * Background job for AI-powered document classification using Gemini
 *
 * Workflow:
 * 1. Fetch image from R2
 * 2. Classify with Gemini
 * 3. Detect duplicates
 * 4. Update DB + confidence routing
 * 5. OCR extraction (if >60%)
 * 6. Notify frontend
 */

import { inngest } from '../lib/inngest'

export const classifyDocumentJob = inngest.createFunction(
  {
    id: 'classify-document',
    retries: 3,
  },
  { event: 'document/uploaded' },
  async ({ event, step }) => {
    const { rawImageId, caseId, r2Key, mimeType } = event.data

    // Step 1: Fetch image from R2 (implemented in Phase 02)
    const imageData = await step.run('fetch-image', async () => {
      console.log(`[ClassifyJob] Fetching image ${r2Key}`)
      // Placeholder - will fetch from R2 in Phase 02
      return { r2Key, mimeType }
    })

    // Step 2: Classify with Gemini (implemented in Phase 02)
    const classification = await step.run('classify', async () => {
      console.log(`[ClassifyJob] Classifying ${rawImageId}`)
      // Placeholder - will use Gemini classification in Phase 02
      return {
        docType: null,
        confidence: 0,
        status: 'pending' as const,
      }
    })

    // Step 3: Update database (implemented in Phase 02)
    await step.run('update-db', async () => {
      console.log(`[ClassifyJob] Updating DB for ${rawImageId}`)
      // Placeholder - will update RawImage record in Phase 02
    })

    console.log(`[ClassifyJob] Completed processing ${rawImageId}`)

    return {
      rawImageId,
      caseId,
      ...classification,
    }
  }
)
