/**
 * Document Grouping Utility
 * Groups multi-page documents for visual display in Files Tab
 * Supports backend grouping (documentGroupId) and filename pattern detection
 */

import type { RawImage } from './api-client'

export interface DocumentGroup {
  groupKey: string
  baseName: string
  images: RawImage[]
  source: 'backend' | 'pattern'
  pageCount: number
}

export interface GroupingResult {
  groups: DocumentGroup[]
  ungrouped: RawImage[]
}

// Patterns for multi-page detection
const PART_PATTERN = /[_-]?Part(\d+)of(\d+)/i
const PAGE_PATTERN = /[_-]?Page(\d+)[_-]?/i
const SHORT_PATTERN = /[_-]?P(\d+)[_-]?/i

interface ParsedPageInfo {
  baseName: string
  pageNumber: number
  totalPages: number | null
  patternMatch: string
}

/**
 * Parse page info from filename
 * Returns null if no page pattern found
 */
function parsePagePattern(filename: string): ParsedPageInfo | null {
  // Try Part1of4 pattern first
  const partMatch = filename.match(PART_PATTERN)
  if (partMatch) {
    const pageNumber = parseInt(partMatch[1], 10)
    const totalPages = parseInt(partMatch[2], 10)
    const baseName = filename.slice(0, partMatch.index).replace(/[_-]$/, '')
    return { baseName, pageNumber, totalPages, patternMatch: partMatch[0] }
  }

  // Try Page1 pattern
  const pageMatch = filename.match(PAGE_PATTERN)
  if (pageMatch) {
    const pageNumber = parseInt(pageMatch[1], 10)
    const baseName = filename.slice(0, pageMatch.index).replace(/[_-]$/, '')
    return { baseName, pageNumber, totalPages: null, patternMatch: pageMatch[0] }
  }

  // Try P1 shorthand
  const shortMatch = filename.match(SHORT_PATTERN)
  if (shortMatch) {
    const pageNumber = parseInt(shortMatch[1], 10)
    const baseName = filename.slice(0, shortMatch.index).replace(/[_-]$/, '')
    return { baseName, pageNumber, totalPages: null, patternMatch: shortMatch[0] }
  }

  return null
}

/**
 * Group documents by documentGroupId (backend) or filename pattern
 * Returns groups sorted by page number and remaining ungrouped docs
 */
export function groupDocuments(images: RawImage[]): GroupingResult {
  const backendGroups = new Map<string, RawImage[]>()
  const tempPatternGroups = new Map<string, RawImage[]>()
  const ungrouped: RawImage[] = []
  const processedIds = new Set<string>()

  // Phase 1: Group by backend documentGroupId
  for (const img of images) {
    if (img.documentGroupId) {
      const existing = backendGroups.get(img.documentGroupId) || []
      existing.push(img)
      backendGroups.set(img.documentGroupId, existing)
      processedIds.add(img.id)
    }
  }

  // Phase 2: Pattern-based grouping for remaining docs
  for (const img of images) {
    if (processedIds.has(img.id)) continue

    const filename = img.displayName || img.filename
    const parsed = parsePagePattern(filename)

    if (parsed) {
      // Normalize key: lowercase base name
      const key = parsed.baseName.toLowerCase()
      const existing = tempPatternGroups.get(key) || []
      existing.push(img)
      tempPatternGroups.set(key, existing)
      processedIds.add(img.id)
    }
  }

  // Phase 3: Only keep pattern groups with 2+ pages
  const patternGroups = new Map<string, { images: RawImage[]; baseName: string }>()
  for (const [key, groupImages] of tempPatternGroups) {
    if (groupImages.length >= 2) {
      const filename = groupImages[0].displayName || groupImages[0].filename
      const parsed = parsePagePattern(filename)
      const baseName = parsed?.baseName || key
      patternGroups.set(key, { images: groupImages, baseName })
    } else {
      // Single page with pattern = ungrouped (might be standalone)
      for (const img of groupImages) {
        ungrouped.push(img)
        processedIds.delete(img.id)
      }
    }
  }

  // Phase 4: Remaining unprocessed = ungrouped
  for (const img of images) {
    if (!processedIds.has(img.id)) {
      ungrouped.push(img)
    }
  }

  // Build output groups
  const groups: DocumentGroup[] = []

  // Backend groups
  for (const [groupId, groupImages] of backendGroups) {
    // Sort by pageNumber (backend provides this)
    const sorted = [...groupImages].sort((a, b) => {
      const pageA = a.pageNumber ?? 0
      const pageB = b.pageNumber ?? 0
      return pageA - pageB
    })

    // Get baseName from first image
    const firstName = sorted[0].displayName || sorted[0].filename
    const parsed = parsePagePattern(firstName)
    const baseName = parsed?.baseName || firstName.replace(/\.[^/.]+$/, '')

    groups.push({
      groupKey: groupId,
      baseName,
      images: sorted,
      source: 'backend',
      pageCount: sorted[0].totalPages || sorted.length,
    })
  }

  // Pattern groups
  for (const [key, { images: groupImages, baseName }] of patternGroups) {
    // Sort by parsed page number
    const sorted = [...groupImages].sort((a, b) => {
      const filenameA = a.displayName || a.filename
      const filenameB = b.displayName || b.filename
      const parsedA = parsePagePattern(filenameA)
      const parsedB = parsePagePattern(filenameB)
      return (parsedA?.pageNumber ?? 0) - (parsedB?.pageNumber ?? 0)
    })

    groups.push({
      groupKey: `pattern:${key}`,
      baseName,
      images: sorted,
      source: 'pattern',
      pageCount: sorted.length,
    })
  }

  return { groups, ungrouped }
}

/**
 * Get page info for display (e.g., "Part 2/4")
 * Uses backend fields if available, falls back to filename parsing
 */
export function getPageDisplay(image: RawImage): string | null {
  // Backend data preferred
  if (image.pageNumber != null && image.totalPages != null) {
    return `Part ${image.pageNumber}/${image.totalPages}`
  }

  // Fallback to filename parsing
  const filename = image.displayName || image.filename
  const parsed = parsePagePattern(filename)
  if (parsed) {
    if (parsed.totalPages) {
      return `Part ${parsed.pageNumber}/${parsed.totalPages}`
    }
    return `Page ${parsed.pageNumber}`
  }

  return null
}

/**
 * Check if image is part of a multi-page group
 */
export function isMultiPageDoc(image: RawImage): boolean {
  if (image.documentGroupId) return true
  const filename = image.displayName || image.filename
  return parsePagePattern(filename) !== null
}
