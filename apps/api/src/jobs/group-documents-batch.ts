/**
 * Batch Document Grouping Job
 * Processes ALL classified documents in a case at once
 * Triggered manually via POST /cases/:caseId/group-documents
 *
 * Algorithm:
 * 1. Fetch all classified documents in case
 * 2. Cluster documents by form type (to reduce AI comparison scope)
 * 3. For each cluster with 2+ docs, AI-compare to detect multi-page groups
 * 4. Create/update DocumentGroup records
 *
 * This replaces auto-triggered detect-multi-page for bulk uploads
 */

import { inngest } from '../lib/inngest'
import { prisma } from '../lib/db'
import { fetchImageBuffer, renameFileRaw } from '../services/storage'
import { analyzeDocumentGrouping } from '../services/ai'

// Configuration
const GROUP_CONFIDENCE_THRESHOLD = 0.80
const MAX_DOCS_PER_CLUSTER = 20 // Limit for AI comparison (cost/performance)

/**
 * Document data for grouping operations
 */
interface DocumentForGrouping {
  id: string
  r2Key: string
  displayName: string | null
  classifiedType: string | null
  documentGroupId: string | null
  pageNumber: number | null
  mimeType: string | null
}

/**
 * Type cluster for batch processing
 */
interface TypeCluster {
  type: string
  documents: DocumentForGrouping[]
}

/**
 * Result from processing a single cluster
 */
interface ClusterProcessResult {
  created: number
  updated: number
  docsProcessed: number
}

/**
 * Parse page reference from AI response to get document ID
 * pageOrder format: "existing_doc_0", "new_doc", "existing_doc_2"
 * For batch mode, we use "doc_0", "doc_1", etc.
 */
function parsePageRefBatch(
  pageRef: string,
  documents: Array<{ id: string }>
): string | null {
  const match = pageRef.match(/^doc_(\d+)$/)
  if (match) {
    const idx = parseInt(match[1], 10)
    if (idx >= 0 && idx < documents.length) {
      return documents[idx].id
    }
  }
  return null
}

/**
 * Process a cluster of same-type documents
 * Compare documents within the cluster to detect multi-page groups
 */
async function processCluster(
  caseId: string,
  documents: DocumentForGrouping[],
  forceRegroup?: boolean
): Promise<ClusterProcessResult> {
  let created = 0
  let updated = 0

  // Limit to MAX_DOCS_PER_CLUSTER for performance
  const docsToProcess = documents.slice(0, MAX_DOCS_PER_CLUSTER)

  // Fetch all document images in parallel (use allSettled to handle individual failures)
  const fetchResults = await Promise.allSettled(
    docsToProcess.map(async (doc) => {
      const img = await fetchImageBuffer(doc.r2Key)
      return { doc, buffer: img?.buffer || null }
    })
  )

  // Extract successful fetches, log failures
  const docsWithImages: Array<{ doc: DocumentForGrouping; buffer: Buffer | null }> = []
  for (let i = 0; i < fetchResults.length; i++) {
    const result = fetchResults[i]
    if (result.status === 'fulfilled') {
      docsWithImages.push(result.value)
    } else {
      console.warn(`[batch-grouping] Failed to fetch image for doc ${docsToProcess[i].id}: ${result.reason}`)
    }
  }

  // Filter out failed fetches (null buffers)
  const validDocs = docsWithImages.filter(
    (d): d is { doc: DocumentForGrouping; buffer: Buffer } => d.buffer !== null
  )

  if (validDocs.length < 2) {
    return { created, updated, docsProcessed: 0 }
  }

  // For batch mode, we compare all documents at once
  // The first document serves as the "new doc" reference for the AI
  const [firstDoc, ...restDocs] = validDocs

  const result = await analyzeDocumentGrouping(
    firstDoc.buffer,
    restDocs.map((d) => d.buffer),
    restDocs.map((d) => ({ id: d.doc.id, displayName: d.doc.displayName }))
  )

  // If no match found or below threshold, nothing to do
  if (!result.matchFound || result.confidence < GROUP_CONFIDENCE_THRESHOLD) {
    console.log(
      `[batch-grouping] No match in cluster (conf: ${result.confidence}, reason: ${result.reasoning})`
    )
    return { created, updated, docsProcessed: validDocs.length }
  }

  // Parse page order to get document IDs
  // pageOrder uses "new_doc" for first doc, "existing_doc_N" for rest
  const allDocsForRef = [
    { id: firstDoc.doc.id },
    ...restDocs.map((d) => ({ id: d.doc.id })),
  ]

  const pageDocIds: Array<{ docId: string; pageNum: number }> = []
  for (let i = 0; i < result.pageOrder.length; i++) {
    const pageRef = result.pageOrder[i]
    let docId: string | null = null

    if (pageRef === 'new_doc') {
      docId = firstDoc.doc.id
    } else {
      const match = pageRef.match(/^existing_doc_(\d+)$/)
      if (match) {
        const idx = parseInt(match[1], 10)
        if (idx >= 0 && idx < restDocs.length) {
          docId = restDocs[idx].doc.id
        }
      }
    }

    if (docId) {
      pageDocIds.push({ docId, pageNum: i + 1 })
    }
  }

  if (pageDocIds.length < 2) {
    console.warn('[batch-grouping] Not enough valid pages to group')
    return { created, updated, docsProcessed: validDocs.length }
  }

  // Check if any document is already in a group
  let existingGroupId: string | null = null
  for (const { docId } of pageDocIds) {
    const doc = validDocs.find((v) => v.doc.id === docId)?.doc
    if (doc?.documentGroupId) {
      existingGroupId = doc.documentGroupId
      break
    }
  }

  // Get base name from first document
  const baseName = (firstDoc.doc.displayName || 'MultiPageDoc').replace(
    /_Part\d+of\d+$/i,
    ''
  )

  let groupId: string
  let totalPages: number

  if (existingGroupId) {
    // Join existing group
    const existingGroup = await prisma.documentGroup.findUnique({
      where: { id: existingGroupId },
      include: { images: { select: { id: true } } },
    })

    if (!existingGroup) {
      console.warn('[batch-grouping] Existing group not found')
      return { created, updated, docsProcessed: validDocs.length }
    }

    // Calculate new page count
    const existingPageIds = new Set(existingGroup.images.map((r) => r.id))
    const newDocsCount = pageDocIds.filter(
      ({ docId }) => !existingPageIds.has(docId)
    ).length
    totalPages = existingGroup.pageCount + newDocsCount

    // Update group
    await prisma.documentGroup.update({
      where: { id: existingGroupId },
      data: { pageCount: totalPages },
    })

    // Update existing members' totalPages
    await prisma.rawImage.updateMany({
      where: { documentGroupId: existingGroupId },
      data: { totalPages },
    })

    groupId = existingGroupId
    updated++

    console.log(
      `[batch-grouping] Joined existing group ${groupId}: ${existingGroup.baseName} (now ${totalPages} pages)`
    )
  } else {
    // Create new group
    totalPages = pageDocIds.length

    const newGroup = await prisma.documentGroup.create({
      data: {
        caseId,
        baseName,
        documentType: firstDoc.doc.classifiedType || 'OTHER',
        pageCount: totalPages,
        confidence: result.confidence,
      },
    })

    groupId = newGroup.id
    created++

    console.log(
      `[batch-grouping] Created group ${groupId}: ${baseName} (${totalPages} pages)`
    )
  }

  // Update all documents with page numbers and rename
  for (const { docId, pageNum } of pageDocIds) {
    const partSuffix = `_Part${pageNum}of${totalPages}`

    const doc = await prisma.rawImage.findUnique({
      where: { id: docId },
      select: { r2Key: true, displayName: true, documentGroupId: true },
    })

    if (!doc) continue

    // Skip if already in this group (just update page info if needed)
    if (doc.documentGroupId === groupId) {
      const existingBaseName = (doc.displayName || '').replace(
        /_Part\d+of\d+$/i,
        ''
      )
      const updatedDisplayName = existingBaseName
        ? `${existingBaseName}${partSuffix}`
        : `${baseName}${partSuffix}`

      await prisma.rawImage.update({
        where: { id: docId },
        data: {
          totalPages,
          pageNumber: pageNum,
          displayName: updatedDisplayName,
        },
      })
      continue
    }

    // Use this document's own displayName
    const ownBaseName = (doc.displayName || '').replace(/_Part\d+of\d+$/i, '')
    const newDisplayName = ownBaseName
      ? `${ownBaseName}${partSuffix}`
      : `${baseName}${partSuffix}`

    // Update document in DB
    await prisma.rawImage.update({
      where: { id: docId },
      data: {
        documentGroupId: groupId,
        pageNumber: pageNum,
        totalPages,
        displayName: newDisplayName,
        groupConfidence: result.confidence,
      },
    })

    // Rename file in R2 (non-blocking - DB update is source of truth)
    const currentFilename = doc.r2Key.split('/').pop() || ''
    const nameWithoutExt = currentFilename.replace(/\.[^.]+$/, '')
    const cleanName = nameWithoutExt.replace(/_Part\d+of\d+$/i, '')
    const newFilenameBase = `${cleanName}${partSuffix}`

    try {
      const renameResult = await renameFileRaw(doc.r2Key, caseId, newFilenameBase)

      if (renameResult.success && renameResult.newKey !== doc.r2Key) {
        await prisma.rawImage.update({
          where: { id: docId },
          data: { r2Key: renameResult.newKey },
        })
      } else if (!renameResult.success) {
        // Log but don't fail - DB grouping is complete, R2 rename is cosmetic
        console.warn(`[batch-grouping] R2 rename failed for doc ${docId}: file remains at ${doc.r2Key}`)
      }
    } catch (renameError) {
      // Catch unexpected errors - grouping is complete, just log the rename failure
      console.error(`[batch-grouping] R2 rename error for doc ${docId}:`, renameError)
    }
  }

  return { created, updated, docsProcessed: validDocs.length }
}

/**
 * Batch Document Grouping Inngest Job
 * Triggered by 'document/group-batch' event
 */
export const groupDocumentsBatchJob = inngest.createFunction(
  {
    id: 'group-documents-batch',
    retries: 2,
  },
  { event: 'document/group-batch' },
  async ({ event, step }) => {
    const { caseId, forceRegroup, triggeredBy } = event.data

    // Step 1: Fetch all classified documents in case
    const documents = await step.run('fetch-documents', async () => {
      const where: Record<string, unknown> = {
        caseId,
        status: { in: ['CLASSIFIED', 'LINKED'] },
      }

      // If not forceRegroup, only process ungrouped documents
      if (!forceRegroup) {
        where.documentGroupId = null
      }

      return prisma.rawImage.findMany({
        where,
        select: {
          id: true,
          r2Key: true,
          displayName: true,
          classifiedType: true,
          documentGroupId: true,
          pageNumber: true,
          mimeType: true,
        },
        orderBy: { createdAt: 'asc' },
      })
    })

    if (documents.length === 0) {
      return {
        success: true,
        message: 'No documents to process',
        documentsProcessed: 0,
        groupsCreated: 0,
        groupsUpdated: 0,
        triggeredBy,
      }
    }

    // Step 2: Cluster documents by form type
    const clusters = await step.run('cluster-by-type', async () => {
      const typeMap = new Map<string, DocumentForGrouping[]>()

      for (const doc of documents) {
        const docType = doc.classifiedType || 'OTHER'
        if (!typeMap.has(docType)) {
          typeMap.set(docType, [])
        }
        typeMap.get(docType)!.push(doc)
      }

      // Convert to array and filter to clusters with 2+ docs
      return Array.from(typeMap.entries())
        .map(([type, docs]) => ({ type, documents: docs }))
        .filter((cluster) => cluster.documents.length >= 2)
    })

    if (clusters.length === 0) {
      return {
        success: true,
        message: 'No clusters with multiple documents',
        documentsProcessed: documents.length,
        groupsCreated: 0,
        groupsUpdated: 0,
        clustersFound: 0,
        triggeredBy,
      }
    }

    // Step 3: Process each cluster sequentially (to manage memory)
    let totalCreated = 0
    let totalUpdated = 0
    let totalProcessed = 0

    for (const cluster of clusters) {
      const result = await step.run(
        `process-cluster-${cluster.type}`,
        async () => {
          return processCluster(caseId, cluster.documents, forceRegroup)
        }
      )

      totalCreated += result.created
      totalUpdated += result.updated
      totalProcessed += result.docsProcessed
    }

    return {
      success: true,
      documentsProcessed: documents.length,
      clustersProcessed: clusters.length,
      groupsCreated: totalCreated,
      groupsUpdated: totalUpdated,
      triggeredBy,
    }
  }
)
