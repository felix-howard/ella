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
import { fetchImageBuffer, renameFileRaw } from '../services/storage'
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

    // Step 2: Fetch recent docs in same case (including already-grouped for late page joining)
    const recentDocs = await step.run('fetch-recent-docs', async () => {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - LOOKBACK_DAYS)

      return prisma.rawImage.findMany({
        where: {
          caseId,
          id: { not: rawImageId },
          createdAt: { gte: cutoffDate },
          // REMOVED: documentGroupId: null - allow late pages to find existing groups
          status: { in: ['CLASSIFIED', 'LINKED'] }, // Only processed documents
        },
        select: {
          id: true,
          r2Key: true,
          displayName: true,
          classifiedType: true,
          aiMetadata: true,
          mimeType: true,
          documentGroupId: true, // Include for late page joining
          pageNumber: true, // Include for page reordering
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

    // Step 4: Apply grouping - create/join DocumentGroup and update documents
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

      // Check if any matched doc is already in a group (for late page joining)
      let existingGroupId: string | null = null
      for (const { docId } of pageDocIds) {
        if (docId === rawImageId) continue // Skip new doc
        const matchedDoc = await prisma.rawImage.findUnique({
          where: { id: docId },
          select: { documentGroupId: true },
        })
        if (matchedDoc?.documentGroupId) {
          existingGroupId = matchedDoc.documentGroupId
          break
        }
      }

      // Get base name from first document's existing displayName (for group display)
      const firstDocId = pageDocIds[0].docId
      const firstDoc = await prisma.rawImage.findUnique({
        where: { id: firstDocId },
        select: { displayName: true },
      })
      const existingName = firstDoc?.displayName || newDoc.displayName || 'MultiPageDoc'
      const baseName = existingName.replace(/_Part\d+of\d+$/i, '')

      let group: { id: string; baseName: string; pageCount: number }
      let totalPages: number

      if (existingGroupId) {
        // JOIN existing group - late page arriving
        const existingGroup = await prisma.documentGroup.findUnique({
          where: { id: existingGroupId },
          include: { images: { select: { id: true, pageNumber: true } } },
        })

        if (!existingGroup) {
          console.warn('[detect-multi-page] Existing group not found')
          return { success: false, reason: 'Existing group not found', groupId: null, pageCount: 0 }
        }

        // Calculate new total: existing pages + new doc (only count docs not already in group)
        const existingPageIds = new Set(existingGroup.images.map((r) => r.id))
        const newDocsCount = pageDocIds.filter(({ docId }) => !existingPageIds.has(docId)).length
        totalPages = existingGroup.pageCount + newDocsCount

        // Update group pageCount
        await prisma.documentGroup.update({
          where: { id: existingGroupId },
          data: { pageCount: totalPages },
        })

        // Update existing members' totalPages
        await prisma.rawImage.updateMany({
          where: { documentGroupId: existingGroupId },
          data: { totalPages },
        })

        group = { id: existingGroupId, baseName: existingGroup.baseName, pageCount: totalPages }

        console.log(
          `[detect-multi-page] Joined existing group ${group.id}: ${group.baseName} (now ${totalPages} pages)`
        )
      } else {
        // CREATE new group
        totalPages = pageDocIds.length

        const newGroup = await prisma.documentGroup.create({
          data: {
            caseId,
            baseName,
            documentType: newDoc.classifiedType || 'OTHER',
            pageCount: totalPages,
            confidence: groupingResult.confidence,
          },
        })

        group = { id: newGroup.id, baseName, pageCount: totalPages }

        console.log(
          `[detect-multi-page] Created group ${group.id}: ${baseName} (${totalPages} pages)`
        )
      }

      // Update all documents with page numbers and rename
      // PHASE 02 FIX: Use each document's OWN displayName, not group baseName
      const renameResults: Array<{
        docId: string
        pageNum: number
        renamed: boolean
        newKey?: string
      }> = []

      for (const { docId, pageNum } of pageDocIds) {
        const partSuffix = `_Part${pageNum}of${totalPages}`

        // Get current document data
        const doc = await prisma.rawImage.findUnique({
          where: { id: docId },
          select: { r2Key: true, displayName: true, documentGroupId: true },
        })

        if (!doc) continue

        // Skip if already in this group (just update totalPages)
        if (doc.documentGroupId === group.id) {
          await prisma.rawImage.update({
            where: { id: docId },
            data: { totalPages, pageNumber: pageNum },
          })
          renameResults.push({ docId, pageNum, renamed: false })
          continue
        }

        // PHASE 02 FIX: Use THIS document's own displayName, not group baseName
        const ownBaseName = (doc.displayName || '').replace(/_Part\d+of\d+$/i, '')
        const newDisplayName = ownBaseName ? `${ownBaseName}${partSuffix}` : `${baseName}${partSuffix}`

        // Update document in DB with its own displayName + part suffix
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

        // Rename file in R2: append _PartXofY suffix to existing filename
        const currentFilename = doc.r2Key.split('/').pop() || ''
        const nameWithoutExt = currentFilename.replace(/\.[^.]+$/, '')
        const cleanName = nameWithoutExt.replace(/_Part\d+of\d+$/i, '')
        const newFilenameBase = `${cleanName}${partSuffix}`

        const renameResult = await renameFileRaw(doc.r2Key, caseId, newFilenameBase)

        if (renameResult.success && renameResult.newKey !== doc.r2Key) {
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
        baseName: group.baseName,
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
