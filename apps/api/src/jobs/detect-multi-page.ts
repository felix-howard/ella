/**
 * Multi-Page Document Detection Job
 * Background job for detecting and grouping related document pages
 *
 * Workflow:
 * 1. Fetch newly classified document
 * 2. Fetch recent ungrouped docs in same case (last 7 days)
 * 3. AI visual comparison to detect related pages
 * 4. Create/update DocumentGroup and rename files with _PartXofY
 */

import { inngest } from '../lib/inngest'
import { prisma } from '../lib/db'
import { fetchImageBuffer, renameFile } from '../services/storage'
import { analyzeDocumentGrouping } from '../services/ai'

// Confidence threshold for accepting AI grouping
const GROUP_CONFIDENCE_THRESHOLD = 0.80

// How far back to look for related documents
const LOOKBACK_DAYS = 7

// Maximum number of candidates to compare (cost/performance tradeoff)
const MAX_CANDIDATES = 10

/**
 * Result type for grouping analysis step
 */
interface GroupingStepResult {
  matchFound: boolean
  confidence: number
  matchedIndices: number[]
  pageOrder: string[]
  groupName: string | null
  reasoning: string
  validCandidates: Array<{ id: string; r2Key: string; displayName: string | null }>
  error?: string
}

/**
 * Parse page reference from AI response to get document ID
 * pageOrder format: "existing_doc_0", "new_doc", "existing_doc_2"
 */
function parsePageRef(
  pageRef: string,
  newDocId: string,
  candidateDocs: Array<{ id: string }>
): string | null {
  if (pageRef === 'new_doc') {
    return newDocId
  }

  const match = pageRef.match(/^existing_doc_(\d+)$/)
  if (match) {
    const idx = parseInt(match[1], 10)
    if (idx >= 0 && idx < candidateDocs.length) {
      return candidateDocs[idx].id
    }
  }

  return null
}

export const detectMultiPageJob = inngest.createFunction(
  {
    id: 'detect-multi-page',
    throttle: { limit: 5, period: '1m' }, // Prevent excessive AI calls
  },
  { event: 'document/classified' },
  async ({ event, step }) => {
    const { rawImageId, caseId } = event.data

    // Step 1: Get the newly classified document
    const newDoc = await step.run('fetch-new-doc', async () => {
      return prisma.rawImage.findUnique({
        where: { id: rawImageId },
        select: {
          id: true,
          r2Key: true,
          displayName: true,
          classifiedType: true,
          aiMetadata: true,
          documentGroupId: true,
          mimeType: true,
        },
      })
    })

    // Exit if document not found or already grouped
    if (!newDoc) {
      return { skipped: true, reason: 'Document not found' }
    }

    if (newDoc.documentGroupId) {
      return { skipped: true, reason: 'Already grouped' }
    }

    // Step 2: Fetch recent ungrouped docs in same case
    const recentDocs = await step.run('fetch-recent-docs', async () => {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - LOOKBACK_DAYS)

      return prisma.rawImage.findMany({
        where: {
          caseId,
          id: { not: rawImageId },
          createdAt: { gte: cutoffDate },
          documentGroupId: null, // Only ungrouped documents
          status: { in: ['CLASSIFIED', 'LINKED'] }, // Only processed documents
        },
        select: {
          id: true,
          r2Key: true,
          displayName: true,
          classifiedType: true,
          aiMetadata: true,
          mimeType: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50, // Fetch more than MAX_CANDIDATES for filtering
      })
    })

    // Exit if no documents to compare against
    if (recentDocs.length === 0) {
      return { skipped: true, reason: 'No other docs to compare' }
    }

    // Step 3: AI grouping analysis
    const groupingResult = await step.run('analyze-grouping', async (): Promise<GroupingStepResult> => {
      // Fetch new document image
      const newDocImage = await fetchImageBuffer(newDoc.r2Key)
      if (!newDocImage) {
        return {
          matchFound: false,
          confidence: 0,
          matchedIndices: [],
          pageOrder: [],
          groupName: null,
          reasoning: 'Failed to fetch new doc image',
          validCandidates: [],
          error: 'Failed to fetch new doc image',
        }
      }

      // Limit candidates for cost/performance
      const candidates = recentDocs.slice(0, MAX_CANDIDATES)

      // Fetch candidate images in parallel
      const candidateResults = await Promise.all(
        candidates.map(async (doc) => {
          const img = await fetchImageBuffer(doc.r2Key)
          return { doc, buffer: img?.buffer || null }
        })
      )

      // Filter out failed fetches
      const validCandidates = candidateResults.filter(
        (c): c is { doc: typeof candidates[0]; buffer: Buffer } => c.buffer !== null
      )

      if (validCandidates.length === 0) {
        return {
          matchFound: false,
          confidence: 0,
          matchedIndices: [],
          pageOrder: [],
          groupName: null,
          reasoning: 'No valid candidate images',
          validCandidates: [],
          error: 'No valid candidate images',
        }
      }

      // Call AI for grouping analysis
      const result = await analyzeDocumentGrouping(
        newDocImage.buffer,
        validCandidates.map((c) => c.buffer),
        validCandidates.map((c) => ({ id: c.doc.id, displayName: c.doc.displayName }))
      )

      // Return with valid candidates for page order processing
      return {
        ...result,
        validCandidates: validCandidates.map((c) => ({
          id: c.doc.id,
          r2Key: c.doc.r2Key,
          displayName: c.doc.displayName,
        })),
      }
    })

    // Exit if no match or below confidence threshold
    if (
      !groupingResult.matchFound ||
      groupingResult.confidence < GROUP_CONFIDENCE_THRESHOLD
    ) {
      return {
        analyzed: true,
        matchFound: false,
        confidence: groupingResult.confidence,
        reason: groupingResult.reasoning || 'No match found',
      }
    }

    // Step 4: Apply grouping - create DocumentGroup and update documents
    const groupingApplied = await step.run('apply-grouping', async () => {
      const validCandidates = groupingResult.validCandidates

      // Parse page order to get actual document IDs
      const pageDocIds: Array<{ docId: string; pageNum: number }> = []
      for (let i = 0; i < groupingResult.pageOrder.length; i++) {
        const pageRef = groupingResult.pageOrder[i]
        const docId = parsePageRef(pageRef, rawImageId, validCandidates)
        if (docId) {
          pageDocIds.push({ docId, pageNum: i + 1 })
        }
      }

      if (pageDocIds.length < 2) {
        console.warn('[detect-multi-page] Not enough valid pages to group')
        return { success: false, reason: 'Not enough valid pages', groupId: null, pageCount: 0 }
      }

      const totalPages = pageDocIds.length
      const baseName = groupingResult.groupName || newDoc.displayName || 'MultiPageDoc'

      // Create DocumentGroup
      const group = await prisma.documentGroup.create({
        data: {
          caseId,
          baseName,
          documentType: newDoc.classifiedType || 'OTHER',
          pageCount: totalPages,
          confidence: groupingResult.confidence,
        },
      })

      console.log(
        `[detect-multi-page] Created group ${group.id}: ${baseName} (${totalPages} pages)`
      )

      // Update all documents with page numbers and rename
      const renameResults: Array<{
        docId: string
        pageNum: number
        renamed: boolean
        newKey?: string
      }> = []

      for (const { docId, pageNum } of pageDocIds) {
        const partSuffix = `_Part${pageNum}of${totalPages}`
        const newDisplayName = `${baseName}${partSuffix}`

        // Get current document data
        const doc = await prisma.rawImage.findUnique({
          where: { id: docId },
          select: { r2Key: true, displayName: true },
        })

        if (!doc) continue

        // Update document in DB
        await prisma.rawImage.update({
          where: { id: docId },
          data: {
            documentGroupId: group.id,
            pageNumber: pageNum,
            totalPages,
            displayName: newDisplayName,
            groupConfidence: groupingResult.confidence,
          },
        })

        // Rename file in R2 to include part suffix
        const renameResult = await renameFile(doc.r2Key, caseId, {
          taxYear: null,
          docType: newDisplayName,
          source: null,
          recipientName: null,
        })

        if (renameResult.success && renameResult.newKey !== doc.r2Key) {
          // Update r2Key in DB
          await prisma.rawImage.update({
            where: { id: docId },
            data: { r2Key: renameResult.newKey },
          })
        }

        renameResults.push({
          docId,
          pageNum,
          renamed: renameResult.success,
          newKey: renameResult.success ? renameResult.newKey : undefined,
        })
      }

      return {
        success: true,
        groupId: group.id,
        baseName,
        pageCount: totalPages,
        renameResults,
      }
    })

    return {
      analyzed: true,
      matchFound: true,
      confidence: groupingResult.confidence,
      groupedWith: groupingResult.matchedIndices.length,
      groupId: groupingApplied.groupId,
      pageCount: groupingApplied.pageCount,
      reasoning: groupingResult.reasoning,
    }
  }
)
