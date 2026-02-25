/**
 * Batch Document Grouping Job
 * Processes ALL classified documents in a case at once
 * Triggered manually via POST /cases/:caseId/group-documents
 *
 * Algorithm (Phase 2: Hierarchical Clustering):
 * 1. Fetch all classified documents in case
 * 2. Metadata-first bucketing: Group by (formType, taxpayerName)
 * 3. Per bucket: N×N pairwise AI comparison
 * 4. Union-Find for transitive grouping (A~B, B~C → A+B+C)
 * 5. Create/update DocumentGroup records
 *
 * Key improvements over single-pass:
 * - Taxpayer separation: Different taxpayers never mixed
 * - Transitive closure: Late pages join existing groups correctly
 * - Explainability: Logs show bucket keys and confidence scores
 */

import { inngest } from '../lib/inngest'
import { prisma } from '../lib/db'
import { fetchImageBuffer, renameFileRaw } from '../services/storage'
import { analyzeDocumentGrouping } from '../services/ai'
import {
  UnionFind,
  normalizeTaxpayerName,
  bucketDocumentsByMetadata,
  sortDocumentsByPageMarker,
  validatePageSequence,
  GROUP_CONFIDENCE_THRESHOLD,
  METADATA_BUCKETING_THRESHOLD,
  type DocumentForGrouping,
  type MetadataBucket,
} from './grouping-utils'

// Configuration (non-exported)
const MAX_DOCS_PER_CLUSTER = 20 // Limit for AI comparison (cost/performance)
const MAX_BUCKET_PROCESS_TIME_MS = 90_000 // 90 seconds max per bucket (N² AI calls)

/**
 * Result from processing a single bucket
 */
interface BucketProcessResult {
  created: number
  updated: number
  docsProcessed: number
}

/**
 * Process a metadata bucket using N×N pairwise comparison + Union-Find
 * Key improvements over single-pass:
 * - All pairs compared (not just first vs rest)
 * - Transitive closure via Union-Find (A~B, B~C → A+B+C)
 * - Serialized AI calls with timeout protection (C1)
 * - Large bucket warnings (C2)
 */
async function processBucket(
  caseId: string,
  bucket: MetadataBucket
): Promise<BucketProcessResult> {
  let created = 0
  let updated = 0
  const documents = bucket.documents
  const failedFetches: string[] = []

  console.log(
    `[batch-grouping] Processing bucket: ${bucket.key} (${documents.length} docs)`
  )

  // Fix C2: Warn about truncated documents
  const docsToProcess = documents.slice(0, MAX_DOCS_PER_CLUSTER)
  if (documents.length > MAX_DOCS_PER_CLUSTER) {
    const dropped = documents.length - MAX_DOCS_PER_CLUSTER
    console.warn(
      `[batch-grouping] Bucket ${bucket.key} has ${documents.length} docs, ` +
      `processing first ${MAX_DOCS_PER_CLUSTER}, skipping ${dropped} docs. ` +
      `Consider splitting into sub-buckets.`
    )
  }

  // Fetch all document images in parallel with index tracking (for H4 ordering)
  const fetchResults = await Promise.allSettled(
    docsToProcess.map(async (doc, idx) => {
      const img = await fetchImageBuffer(doc.r2Key)
      return { doc, buffer: img?.buffer || null, originalIndex: idx }
    })
  )

  // Extract successful fetches, log failures (Fix H2: track failed fetches)
  const docsWithImages: Array<{ doc: DocumentForGrouping; buffer: Buffer; originalIndex: number }> = []
  for (let i = 0; i < fetchResults.length; i++) {
    const result = fetchResults[i]
    if (result.status === 'fulfilled') {
      if (result.value.buffer !== null) {
        docsWithImages.push(result.value as { doc: DocumentForGrouping; buffer: Buffer; originalIndex: number })
      } else {
        console.warn(`[batch-grouping] Empty buffer for doc ${docsToProcess[i].id}`)
        failedFetches.push(docsToProcess[i].id)
      }
    } else {
      console.warn(`[batch-grouping] Failed to fetch image for doc ${docsToProcess[i].id}: ${result.reason}`)
      failedFetches.push(docsToProcess[i].id)
    }
  }

  // Fix H4: Sort by original index to maintain document order
  const validDocs = docsWithImages.sort((a, b) => a.originalIndex - b.originalIndex)

  if (validDocs.length < 2) {
    return { created, updated, docsProcessed: 0 }
  }

  // Initialize Union-Find for transitive grouping
  const uf = new UnionFind(validDocs.map((d) => d.doc.id))

  // N×N pairwise comparison with timeout (Fix C1)
  const comparisons = validDocs.length * (validDocs.length - 1) / 2
  console.log(`[batch-grouping] Running ${comparisons} pairwise comparisons`)

  const startTime = Date.now()
  let completedComparisons = 0
  let timedOut = false

  outerLoop:
  for (let i = 0; i < validDocs.length; i++) {
    for (let j = i + 1; j < validDocs.length; j++) {
      // Fix C1: Timeout check before each comparison
      if (Date.now() - startTime > MAX_BUCKET_PROCESS_TIME_MS) {
        console.warn(
          `[batch-grouping] Timeout after ${completedComparisons}/${comparisons} comparisons ` +
          `(${Math.round((Date.now() - startTime) / 1000)}s). Proceeding with partial results.`
        )
        timedOut = true
        break outerLoop
      }

      const doc1 = validDocs[i]
      const doc2 = validDocs[j]

      // Skip if already in same group (Union-Find optimization)
      if (uf.find(doc1.doc.id) === uf.find(doc2.doc.id)) {
        completedComparisons++
        continue
      }

      try {
        // AI visual comparison (doc1 as "new", doc2 as "existing")
        const result = await analyzeDocumentGrouping(
          doc1.buffer,
          [doc2.buffer],
          [{ id: doc2.doc.id, displayName: doc2.doc.displayName }]
        )

        // If match found with high confidence, union the sets
        if (result.matchFound && result.confidence >= GROUP_CONFIDENCE_THRESHOLD) {
          const unioned = uf.union(doc1.doc.id, doc2.doc.id)
          if (unioned) {
            console.log(
              `[batch-grouping] Matched: ${doc1.doc.displayName} + ${doc2.doc.displayName} (conf: ${result.confidence.toFixed(2)})`
            )
          }
        }
      } catch (aiError) {
        console.error(`[batch-grouping] AI comparison failed: ${doc1.doc.id} vs ${doc2.doc.id}`, aiError)
        // Continue with other comparisons
      }
      completedComparisons++
    }
  }

  if (timedOut) {
    console.log(`[batch-grouping] Completed ${completedComparisons}/${comparisons} comparisons before timeout`)
  }

  // Extract groups from Union-Find (filter out singletons)
  const groupsMap = uf.getGroups()
  const multiDocGroups = Array.from(groupsMap.entries()).filter(
    ([, docIds]) => docIds.length >= 2
  )

  console.log(`[batch-grouping] Found ${multiDocGroups.length} groups in bucket`)

  // Process each group
  for (const [rootId, docIds] of multiDocGroups) {
    const groupDocsUnsorted = validDocs.filter((v) => docIds.includes(v.doc.id))

    // Phase 3: Sort documents by page markers before group creation
    const groupDocs = sortDocumentsByPageMarker(groupDocsUnsorted)

    // Validate page sequence (log warning if invalid but proceed)
    const validation = validatePageSequence(groupDocs)
    if (!validation.valid) {
      console.warn(
        `[batch-grouping] Page sequence validation: ${validation.reason}. Using extracted order.`
      )
    }

    // Fix C3: Detect ALL existing group IDs for conflict handling
    const existingGroupIds = new Set<string>()
    for (const v of groupDocs) {
      if (v.doc.documentGroupId) {
        existingGroupIds.add(v.doc.documentGroupId)
      }
    }

    // Handle group conflicts: multiple existing groups being merged
    let existingGroupId: string | null = null
    if (existingGroupIds.size > 1) {
      console.warn(
        `[batch-grouping] Group conflict: Documents belong to ${existingGroupIds.size} existing groups: ` +
        `${Array.from(existingGroupIds).join(', ')}. Using largest group as target.`
      )
      // Fetch group sizes and use largest
      const groupCounts = await prisma.documentGroup.findMany({
        where: { id: { in: Array.from(existingGroupIds) } },
        select: { id: true, pageCount: true },
      })
      const sorted = groupCounts.sort((a, b) => b.pageCount - a.pageCount)
      existingGroupId = sorted[0]?.id || null
    } else if (existingGroupIds.size === 1) {
      existingGroupId = Array.from(existingGroupIds)[0]
    }

    // Use first doc's displayName for base name
    const firstDoc = groupDocs[0]
    const baseName = (firstDoc.doc.displayName || 'MultiPageDoc').replace(
      /_Part\d+of\d+$/i,
      ''
    )

    let groupId: string
    let totalPages: number
    let groupConfidence = GROUP_CONFIDENCE_THRESHOLD // Default

    if (existingGroupId) {
      // Join existing group
      const existingGroup = await prisma.documentGroup.findUnique({
        where: { id: existingGroupId },
        include: { images: { select: { id: true } } },
      })

      if (!existingGroup) {
        console.warn('[batch-grouping] Existing group not found')
        continue
      }

      // Calculate new page count
      const existingPageIds = new Set(existingGroup.images.map((r) => r.id))
      const newDocsCount = docIds.filter((id) => !existingPageIds.has(id)).length
      totalPages = existingGroup.pageCount + newDocsCount

      await prisma.documentGroup.update({
        where: { id: existingGroupId },
        data: { pageCount: totalPages },
      })

      await prisma.rawImage.updateMany({
        where: { documentGroupId: existingGroupId },
        data: { totalPages },
      })

      groupId = existingGroupId
      groupConfidence = existingGroup.confidence || GROUP_CONFIDENCE_THRESHOLD
      updated++

      console.log(
        `[batch-grouping] Joined group ${groupId}: ${existingGroup.baseName} (now ${totalPages} pages)`
      )
    } else {
      // Create new group
      totalPages = docIds.length

      const newGroup = await prisma.documentGroup.create({
        data: {
          caseId,
          baseName,
          documentType: firstDoc.doc.classifiedType || 'OTHER',
          pageCount: totalPages,
          confidence: GROUP_CONFIDENCE_THRESHOLD,
        },
      })

      groupId = newGroup.id
      created++

      console.log(
        `[batch-grouping] Created group ${groupId}: ${baseName} (${totalPages} pages)`
      )
    }

    // Update all documents with page numbers
    // Phase 3: Use extracted pageNum from sortDocumentsByPageMarker
    for (let i = 0; i < groupDocs.length; i++) {
      const v = groupDocs[i]
      const docId = v.doc.id
      // Use sequential position (1, 2, 3...) since docs are now sorted by pageMarker
      const assignedPageNum = i + 1
      const partSuffix = `_Part${assignedPageNum}of${totalPages}`

      const doc = await prisma.rawImage.findUnique({
        where: { id: docId },
        select: { r2Key: true, displayName: true, documentGroupId: true },
      })

      if (!doc) continue

      // Skip if already in this group (just update page info)
      if (doc.documentGroupId === groupId) {
        const existingBaseName = (doc.displayName || '').replace(/_Part\d+of\d+$/i, '')
        const updatedDisplayName = existingBaseName
          ? `${existingBaseName}${partSuffix}`
          : `${baseName}${partSuffix}`

        await prisma.rawImage.update({
          where: { id: docId },
          data: { totalPages, pageNumber: assignedPageNum, displayName: updatedDisplayName },
        })
        continue
      }

      // Use this document's own displayName
      const ownBaseName = (doc.displayName || '').replace(/_Part\d+of\d+$/i, '')
      const newDisplayName = ownBaseName
        ? `${ownBaseName}${partSuffix}`
        : `${baseName}${partSuffix}`

      await prisma.rawImage.update({
        where: { id: docId },
        data: {
          documentGroupId: groupId,
          pageNumber: assignedPageNum,
          totalPages,
          displayName: newDisplayName,
          groupConfidence,
        },
      })

      // Rename file in R2 with retry (Fix H2)
      const currentFilename = doc.r2Key.split('/').pop() || ''
      const nameWithoutExt = currentFilename.replace(/\.[^.]+$/, '')
      const cleanName = nameWithoutExt.replace(/_Part\d+of\d+$/i, '')
      const newFilenameBase = `${cleanName}${partSuffix}`

      let renameSuccess = false
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const renameResult = await renameFileRaw(doc.r2Key, caseId, newFilenameBase)
          if (renameResult.success && renameResult.newKey !== doc.r2Key) {
            await prisma.rawImage.update({
              where: { id: docId },
              data: { r2Key: renameResult.newKey },
            })
            renameSuccess = true
          } else if (renameResult.success) {
            // Same key, no update needed
            renameSuccess = true
          }
          break // Success, exit retry loop
        } catch (renameError) {
          if (attempt < 3) {
            console.warn(`[batch-grouping] R2 rename attempt ${attempt} failed for doc ${docId}, retrying...`)
            await new Promise(resolve => setTimeout(resolve, 500 * attempt)) // Exponential backoff
          } else {
            console.error(`[batch-grouping] R2 rename failed after 3 attempts for doc ${docId}:`, renameError)
            // Revert displayName to match actual R2 state
            await prisma.rawImage.update({
              where: { id: docId },
              data: { displayName: doc.displayName }, // Keep original displayName
            })
          }
        }
      }
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

    // Step 1: Fetch all classified documents in case (including metadata for bucketing)
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
          aiConfidence: true,
          aiMetadata: true, // Phase 1 metadata: taxpayerName, ssn4, pageInfo
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

    // Step 2: Bucket documents by metadata (formType + taxpayerName)
    // Phase 2 improvement: Taxpayer-separated buckets prevent cross-person grouping
    const buckets = await step.run('bucket-by-metadata', async () => {
      // Cast Prisma return types to our interface (Prisma returns Json, we know structure)
      const docsWithMetadata: DocumentForGrouping[] = documents.map((doc) => ({
        id: doc.id,
        r2Key: doc.r2Key,
        displayName: doc.displayName,
        classifiedType: doc.classifiedType,
        documentGroupId: doc.documentGroupId,
        pageNumber: doc.pageNumber,
        mimeType: doc.mimeType,
        aiConfidence: doc.aiConfidence,
        aiMetadata: doc.aiMetadata as DocumentForGrouping['aiMetadata'],
      }))

      const metadataBuckets = bucketDocumentsByMetadata(docsWithMetadata)

      // Log bucket formation for explainability
      const entries = Array.from(metadataBuckets.entries())
      for (const [key, bucket] of entries) {
        console.log(
          `[batch-grouping] Bucket: ${key} → ${bucket.documents.length} docs`
        )
      }

      // Convert to array and filter to buckets with 2+ docs
      return Array.from(metadataBuckets.values()).filter(
        (bucket) => bucket.documents.length >= 2
      )
    })

    if (buckets.length === 0) {
      return {
        success: true,
        message: 'No buckets with multiple documents',
        documentsProcessed: documents.length,
        groupsCreated: 0,
        groupsUpdated: 0,
        bucketsFound: 0,
        triggeredBy,
      }
    }

    // Step 3: Process each bucket sequentially (serialized AI calls)
    let totalCreated = 0
    let totalUpdated = 0
    let totalProcessed = 0

    for (const bucket of buckets) {
      // Reconstruct bucket with proper types after Inngest serialization
      const typedBucket: MetadataBucket = {
        key: bucket.key as string,
        formType: bucket.formType as string,
        taxpayerName: bucket.taxpayerName as string | null,
        documents: (bucket.documents as unknown[]).map((doc: unknown) => {
          const d = doc as Record<string, unknown>
          return {
            id: d.id as string,
            r2Key: d.r2Key as string,
            displayName: d.displayName as string | null,
            classifiedType: d.classifiedType as string | null,
            documentGroupId: d.documentGroupId as string | null,
            pageNumber: d.pageNumber as number | null,
            mimeType: d.mimeType as string | null,
            aiConfidence: d.aiConfidence as number | null,
            aiMetadata: d.aiMetadata as DocumentForGrouping['aiMetadata'],
          }
        }),
      }

      const result = await step.run(
        `process-bucket-${bucket.key.replace(/\|/g, '-')}`,
        async () => {
          return processBucket(caseId, typedBucket)
        }
      )

      totalCreated += result.created
      totalUpdated += result.updated
      totalProcessed += result.docsProcessed
    }

    // Step 4: Link continuation sheets to parent DocumentGroups (Phase 5)
    // After regular grouping, find any docs with parentDocumentId and attach to parent's group
    // Optimized: Pre-fetch all data to avoid N+1 queries, use atomic increment for race safety
    let continuationsLinked = 0
    const linkResult = await step.run('link-continuation-sheets', async () => {
      // Find all documents with continuation markers that have parentDocumentId
      const continuationDocs = await prisma.rawImage.findMany({
        where: {
          caseId,
          status: { in: ['CLASSIFIED', 'LINKED'] },
          documentGroupId: null, // Not yet grouped
        },
        select: {
          id: true,
          aiMetadata: true,
          displayName: true,
        },
      })

      // Filter to only docs with parentDocumentId and extract parent IDs
      const docsWithParent: Array<{
        id: string
        parentDocId: string
        displayName: string | null
      }> = []

      for (const doc of continuationDocs) {
        const metadata = doc.aiMetadata as DocumentForGrouping['aiMetadata']
        const parentDocId = metadata?.parentDocumentId
        if (parentDocId) {
          docsWithParent.push({
            id: doc.id,
            parentDocId,
            displayName: doc.displayName,
          })
        }
      }

      if (docsWithParent.length === 0) return 0

      // FIX #1: Pre-fetch all parent documents in single query (avoid N+1)
      const parentDocIds = [...new Set(docsWithParent.map((d) => d.parentDocId))]
      const parentDocs = await prisma.rawImage.findMany({
        where: { id: { in: parentDocIds } },
        select: { id: true, documentGroupId: true },
      })
      const parentDocMap = new Map(parentDocs.map((p) => [p.id, p.documentGroupId]))

      // Pre-fetch all document groups in single query
      const groupIds = [...new Set(parentDocs.map((p) => p.documentGroupId).filter(Boolean))] as string[]
      const groups = await prisma.documentGroup.findMany({
        where: { id: { in: groupIds } },
        select: { id: true, pageCount: true, baseName: true },
      })
      const groupMap = new Map(groups.map((g) => [g.id, g]))

      let linked = 0

      // Process each continuation doc
      for (const doc of docsWithParent) {
        const parentGroupId = parentDocMap.get(doc.parentDocId)

        if (!parentGroupId) {
          console.log(
            `[batch-grouping] Continuation ${doc.id} parent ${doc.parentDocId} has no group, skipping`
          )
          continue
        }

        // FIX #3: Check if doc already linked to a different group (prevent duplicate linking)
        const currentDoc = await prisma.rawImage.findUnique({
          where: { id: doc.id },
          select: { documentGroupId: true },
        })
        if (currentDoc?.documentGroupId && currentDoc.documentGroupId !== parentGroupId) {
          console.warn(
            `[batch-grouping] Continuation ${doc.id} already linked to different group ${currentDoc.documentGroupId}, skipping`
          )
          continue
        }

        // FIX #2: Use atomic transaction with increment for race-safe page numbering
        // Interactive transaction ensures pageCount is read and incremented atomically
        try {
          await prisma.$transaction(async (tx) => {
            // Read current pageCount inside transaction (locked read)
            const currentGroup = await tx.documentGroup.findUnique({
              where: { id: parentGroupId },
              select: { pageCount: true },
            })

            if (!currentGroup) {
              throw new Error(`Group ${parentGroupId} not found`)
            }

            const newPageNumber = currentGroup.pageCount + 1

            // Update continuation document
            await tx.rawImage.update({
              where: { id: doc.id },
              data: {
                documentGroupId: parentGroupId,
                pageNumber: newPageNumber,
                totalPages: newPageNumber, // Will be updated below
              },
            })

            // Atomically increment group page count
            await tx.documentGroup.update({
              where: { id: parentGroupId },
              data: { pageCount: { increment: 1 } },
            })

            // Update all docs in group with new total
            await tx.rawImage.updateMany({
              where: { documentGroupId: parentGroupId },
              data: { totalPages: newPageNumber },
            })
          })

          console.log(
            `[batch-grouping] Linked continuation ${doc.displayName} to parent group ${parentGroupId}`
          )
          linked++
        } catch (txError) {
          console.error(
            `[batch-grouping] Failed to link continuation ${doc.id}:`,
            txError
          )
          // Continue with other docs
        }
      }

      return linked
    })

    continuationsLinked = linkResult

    return {
      success: true,
      documentsProcessed: documents.length,
      bucketsProcessed: buckets.length,
      groupsCreated: totalCreated,
      groupsUpdated: totalUpdated,
      continuationsLinked,
      triggeredBy,
    }
  }
)
