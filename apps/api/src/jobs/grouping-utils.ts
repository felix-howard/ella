/**
 * Grouping Utilities
 * Pure functions extracted from group-documents-batch for testability
 * Phase 6: Testing & Validation
 */

// Configuration constants (exported for testing)
export const GROUP_CONFIDENCE_THRESHOLD = 0.80
export const METADATA_BUCKETING_THRESHOLD = 0.80
// Lower threshold when metadata (taxpayerName) already matches - reduces AI variance impact
export const SAME_TAXPAYER_CONFIDENCE_THRESHOLD = 0.65

/**
 * Document data for grouping operations
 * Extended with aiMetadata for hierarchical clustering
 */
export interface DocumentForGrouping {
  id: string
  r2Key: string
  displayName: string | null
  classifiedType: string | null
  documentGroupId: string | null
  pageNumber: number | null
  mimeType: string | null
  aiConfidence: number | null
  aiMetadata: {
    taxpayerName?: string | null
    ssn4?: string | null
    pageInfo?: {
      currentPage?: number
      totalPages?: number
      pageMarkers?: string[]
      partNumber?: string | null  // Roman numeral (I, II, III) - NOT page number
      isWorksheet?: boolean | null  // True for software-generated supplements
    }
    parentDocumentId?: string | null
    parentFormType?: string | null
    continuationMarker?: {
      type: string | null
      parentForm: string | null
      lineNumber: string | null
    } | null
  } | null
}

/**
 * Metadata bucket for hierarchical clustering
 */
export interface MetadataBucket {
  key: string
  formType: string
  taxpayerName: string | null
  documents: DocumentForGrouping[]
}

/**
 * Union-Find (Disjoint Set Union) for transitive document grouping
 * Supports path compression and union by rank for O(α(n)) ≈ O(1) amortized operations
 */
export class UnionFind {
  private parent: Map<string, string>
  private rank: Map<string, number>

  constructor(docIds: string[]) {
    this.parent = new Map()
    this.rank = new Map()
    for (const id of docIds) {
      this.parent.set(id, id) // Each doc starts in own set
      this.rank.set(id, 0)
    }
  }

  /**
   * Find root of set containing docId with path compression
   */
  find(docId: string): string {
    const parent = this.parent.get(docId)
    if (!parent || parent === docId) {
      return docId
    }
    // Path compression: point directly to root
    const root = this.find(parent)
    this.parent.set(docId, root)
    return root
  }

  /**
   * Union two sets by rank (merge smaller tree into larger)
   * Returns true if union performed, false if already in same set
   */
  union(docId1: string, docId2: string): boolean {
    const root1 = this.find(docId1)
    const root2 = this.find(docId2)

    if (root1 === root2) return false // Already in same set

    const rank1 = this.rank.get(root1) || 0
    const rank2 = this.rank.get(root2) || 0

    // Attach smaller tree under larger tree
    if (rank1 < rank2) {
      this.parent.set(root1, root2)
    } else if (rank1 > rank2) {
      this.parent.set(root2, root1)
    } else {
      this.parent.set(root2, root1)
      this.rank.set(root1, rank1 + 1)
    }

    return true
  }

  /**
   * Extract all groups as Map<rootId, docIds[]>
   */
  getGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>()
    const docIds = Array.from(this.parent.keys())
    for (const docId of docIds) {
      const root = this.find(docId)
      if (!groups.has(root)) {
        groups.set(root, [])
      }
      groups.get(root)!.push(docId)
    }
    return groups
  }
}

/**
 * Normalize taxpayer name for bucketing
 * Case-insensitive, whitespace-normalized, handles joint returns and suffixes
 */
export function normalizeTaxpayerName(name: string | null | undefined): string | null {
  if (!name) return null

  let normalized = name.trim().toUpperCase()

  // Return null if name is only whitespace
  if (!normalized) return null

  // Remove punctuation (periods, commas) but keep hyphens in names
  normalized = normalized.replace(/[.,]/g, '')

  // Normalize conjunctions for joint returns: "John & Jane" → "JOHN_AND_JANE"
  normalized = normalized.replace(/\s+(&|AND)\s+/g, '_AND_')

  // Collapse multiple whitespace to single underscore
  normalized = normalized.replace(/\s+/g, '_')

  // Remove common suffixes that may vary in documents
  normalized = normalized.replace(/_(JR|SR|II|III|IV)$/g, '')

  return normalized
}

/**
 * Check if two documents have matching taxpayer metadata
 * Used to apply lower confidence threshold during grouping
 * Returns true if both have taxpayerName and they match after normalization
 */
export function doTaxpayerNamesMatch(
  doc1Metadata: DocumentForGrouping['aiMetadata'],
  doc2Metadata: DocumentForGrouping['aiMetadata']
): boolean {
  const name1 = normalizeTaxpayerName(doc1Metadata?.taxpayerName)
  const name2 = normalizeTaxpayerName(doc2Metadata?.taxpayerName)

  // Both must have taxpayer names to match
  if (!name1 || !name2) return false

  return name1 === name2
}

/**
 * Bucket documents by (formType, taxpayerName) for metadata-first clustering
 * High-confidence metadata (>0.8) → separate buckets per taxpayer
 * Low-confidence or missing → "_unassigned" bucket (form-type only)
 */
export function bucketDocumentsByMetadata(
  documents: DocumentForGrouping[]
): Map<string, MetadataBucket> {
  const buckets = new Map<string, MetadataBucket>()

  for (const doc of documents) {
    const metadata = doc.aiMetadata
    const taxpayerName = metadata?.taxpayerName
    const formType = doc.classifiedType || 'UNKNOWN'
    const confidence = doc.aiConfidence || 0

    let bucketKey: string
    let normalizedName: string | null = null

    // High-confidence metadata with taxpayer name: bucket by (formType, taxpayerName)
    if (taxpayerName && confidence >= METADATA_BUCKETING_THRESHOLD) {
      normalizedName = normalizeTaxpayerName(taxpayerName)
      bucketKey = `${formType}|${normalizedName}`
    } else {
      // Low confidence or missing metadata: bucket by form type only
      bucketKey = `${formType}|_unassigned`
    }

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        key: bucketKey,
        formType,
        taxpayerName: normalizedName,
        documents: [],
      })
    }
    buckets.get(bucketKey)!.documents.push(doc)
  }

  return buckets
}

/**
 * Sort documents by page markers extracted from AI metadata
 *
 * Sorting priority (highest to lowest):
 * 1. Explicit page number (pageInfo.currentPage) - from "Page X" in header/footer
 * 2. Continuation markers - documents with "(continued)" come after non-continued
 * 3. Worksheets/supplements - always come LAST (after all official form pages)
 * 4. Upload order fallback - only when no other indicators available
 *
 * Phase 3: Page Order Detection (Enhanced)
 */
export function sortDocumentsByPageMarker<T extends { doc: DocumentForGrouping; originalIndex: number }>(
  documents: T[]
): Array<T & { pageNum: number }> {
  // First pass: assign sort keys to each document
  const docsWithSortInfo = documents.map((d) => {
    const metadata = d.doc.aiMetadata
    // Support both pageInfo (legacy/tests) and pageMarker (AI classification output)
    // AI classification stores: pageMarker.current, pageMarker.total
    // Legacy/tests use: pageInfo.currentPage, pageInfo.totalPages
    const pageInfo = metadata?.pageInfo
    const pageMarker = (metadata as Record<string, unknown>)?.pageMarker as {
      current?: number | null
      total?: number | null
      partNumber?: string | null
      isWorksheet?: boolean | null
    } | null | undefined
    const continuationMarker = metadata?.continuationMarker

    // Determine if this is a worksheet/supplement (should come last)
    // Check both pageInfo and pageMarker for isWorksheet
    const isWorksheet = pageInfo?.isWorksheet === true || pageMarker?.isWorksheet === true
    const displayName = d.doc.displayName?.toLowerCase() || ''
    const isLikelyWorksheet = isWorksheet ||
      displayName.includes('universaltax') ||
      displayName.includes('calculation') ||
      displayName.includes('worksheet') ||
      displayName.includes('statement') && !displayName.includes('form')

    // Determine if this has a continuation marker (usually page 2+)
    const hasContinuationMarker = continuationMarker?.type != null

    // Get explicit page number if available
    // Check pageMarker.current (from AI classification) first, then pageInfo.currentPage (legacy)
    const currentFromMarker = pageMarker?.current && pageMarker.current > 0 ? pageMarker.current : null
    const currentFromInfo = pageInfo?.currentPage && pageInfo.currentPage > 0 ? pageInfo.currentPage : null
    const explicitPageNum = currentFromMarker ?? currentFromInfo

    // Check if this looks like page 1 (Part I without explicit page number)
    // Check both pageInfo and pageMarker for partNumber
    const partNumber = (pageInfo?.partNumber ?? pageMarker?.partNumber)?.toUpperCase()
    const isLikelyPage1 = partNumber === 'I' && explicitPageNum === null && !hasContinuationMarker && !isLikelyWorksheet

    return {
      ...d,
      explicitPageNum,
      isWorksheet: isLikelyWorksheet,
      hasContinuationMarker,
      isLikelyPage1,
    }
  })

  // Count documents with explicit page numbers
  const docsWithExplicitPages = docsWithSortInfo.filter(d => d.explicitPageNum !== null)
  const maxExplicitPage = docsWithExplicitPages.length > 0
    ? Math.max(...docsWithExplicitPages.map(d => d.explicitPageNum!))
    : 0

  // Second pass: assign final page numbers for sorting
  const docsWithPages = docsWithSortInfo.map((d, idx) => {
    let pageNum: number

    if (d.explicitPageNum !== null) {
      // Has explicit page number from "Page X" header - use directly
      pageNum = d.explicitPageNum
    } else if (d.isWorksheet) {
      // Worksheets go to the end (after all explicit pages + continuation docs)
      // Use 900 + original index to maintain relative order among worksheets
      pageNum = 900 + d.originalIndex
    } else if (d.hasContinuationMarker) {
      // Has continuation marker but no explicit page - likely page 2+
      // Put after page 1 documents but before worksheets
      // Use 100 + original index for relative ordering
      pageNum = 100 + d.originalIndex
    } else if (d.isLikelyPage1) {
      // Has Part I indicator without explicit page number - very likely page 1
      pageNum = 1
    } else {
      // No page info at all - use heuristics
      // If all other docs have page numbers, this might be page 1 (main form page)
      // Otherwise, maintain upload order but after docs with continuation markers
      if (maxExplicitPage > 0 && docsWithExplicitPages.length < documents.length) {
        // Some docs have explicit pages - this one might fill a gap
        // Check if page 1 is missing from explicit pages
        const hasPage1 = docsWithExplicitPages.some(d => d.explicitPageNum === 1)
        const hasLikelyPage1 = docsWithSortInfo.some(d => d.isLikelyPage1)
        if (!hasPage1 && !hasLikelyPage1 && !d.hasContinuationMarker) {
          // Likely the main form page (page 1) - only one doc should get this
          pageNum = 1
        } else {
          // Fill in after continuation docs
          pageNum = 100 + d.originalIndex
        }
      } else {
        // No explicit pages at all - use upload order
        pageNum = d.originalIndex + 1
      }
    }

    return { ...d, pageNum }
  })

  // Sort by page number (ascending)
  // Worksheets (900+) will naturally sort to the end
  docsWithPages.sort((a, b) => a.pageNum - b.pageNum)

  // Final pass: re-number sequentially for clean output (1, 2, 3...)
  // But keep the sorted order
  return docsWithPages.map((d, idx) => ({
    ...d,
    pageNum: idx + 1,  // Sequential 1-based numbering
  }))
}

/**
 * Validate page sequence for completeness (no gaps, no duplicates)
 * Phase 3: Page Order Detection
 */
export function validatePageSequence(
  documents: Array<{ pageNum: number }>
): { valid: boolean; reason: string } {
  // Handle empty array edge case
  if (documents.length === 0) {
    return { valid: false, reason: 'No documents in sequence' }
  }

  const pageNums = documents.map((d) => d.pageNum)
  const uniquePages = new Set(pageNums)

  // Check for duplicates
  if (uniquePages.size !== pageNums.length) {
    return {
      valid: false,
      reason: `Duplicate page numbers: ${pageNums.join(', ')}`,
    }
  }

  // Check for gaps (e.g., 1, 3, 4 missing 2)
  const sorted = [...pageNums].sort((a, b) => a - b)
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1] !== sorted[i] + 1) {
      return {
        valid: false,
        reason: `Gap in sequence: page ${sorted[i]} → ${sorted[i + 1]}`,
      }
    }
  }

  // Check if sequence starts at 1
  if (sorted[0] !== 1) {
    return {
      valid: false,
      reason: `Sequence should start at page 1, got ${sorted[0]}`,
    }
  }

  return { valid: true, reason: 'Valid sequence' }
}
