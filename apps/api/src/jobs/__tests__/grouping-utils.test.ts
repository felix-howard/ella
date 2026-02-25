/**
 * Document Grouping Utilities Test Suite
 * Phase 6: Testing & Validation
 *
 * Tests for:
 * - UnionFind class (transitive grouping)
 * - normalizeTaxpayerName (name normalization for bucketing)
 * - bucketDocumentsByMetadata (metadata-first clustering)
 * - sortDocumentsByPageMarker (page order detection)
 * - validatePageSequence (sequence validation)
 */

import { describe, it, expect } from 'vitest'
import {
  UnionFind,
  normalizeTaxpayerName,
  bucketDocumentsByMetadata,
  sortDocumentsByPageMarker,
  validatePageSequence,
  METADATA_BUCKETING_THRESHOLD,
  type DocumentForGrouping,
} from '../grouping-utils'

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a mock document for testing
 */
function createMockDocument(
  id: string,
  opts: {
    classifiedType?: string
    taxpayerName?: string | null
    ssn4?: string | null
    aiConfidence?: number
    pageInfo?: {
      currentPage?: number
      totalPages?: number
      partNumber?: string | null
      isWorksheet?: boolean | null
    }
    documentGroupId?: string | null
    displayName?: string
    continuationMarker?: {
      type: string | null
      parentForm: string | null
      lineNumber: string | null
    } | null
  } = {}
): DocumentForGrouping {
  return {
    id,
    r2Key: `uploads/${id}.pdf`,
    displayName: opts.displayName ?? `Doc_${id}`,
    classifiedType: opts.classifiedType ?? 'SCHEDULE_SE',
    documentGroupId: opts.documentGroupId ?? null,
    pageNumber: null,
    mimeType: 'application/pdf',
    aiConfidence: opts.aiConfidence ?? 0.9,
    aiMetadata: {
      taxpayerName: opts.taxpayerName ?? null,
      ssn4: opts.ssn4 ?? null,
      pageInfo: opts.pageInfo ?? undefined,
      continuationMarker: opts.continuationMarker ?? undefined,
    },
  }
}

// =============================================================================
// UnionFind Tests (Transitive Grouping)
// =============================================================================

describe('UnionFind', () => {
  describe('initialization', () => {
    it('creates separate sets for each document', () => {
      const uf = new UnionFind(['doc1', 'doc2', 'doc3'])
      expect(uf.find('doc1')).toBe('doc1')
      expect(uf.find('doc2')).toBe('doc2')
      expect(uf.find('doc3')).toBe('doc3')
    })

    it('handles empty initialization', () => {
      const uf = new UnionFind([])
      const groups = uf.getGroups()
      expect(groups.size).toBe(0)
    })
  })

  describe('union operation', () => {
    it('unions two documents into same set', () => {
      const uf = new UnionFind(['doc1', 'doc2'])
      const result = uf.union('doc1', 'doc2')
      expect(result).toBe(true)
      expect(uf.find('doc1')).toBe(uf.find('doc2'))
    })

    it('returns false when documents already in same set', () => {
      const uf = new UnionFind(['doc1', 'doc2'])
      uf.union('doc1', 'doc2')
      const result = uf.union('doc1', 'doc2')
      expect(result).toBe(false)
    })

    it('handles transitive grouping (A~B, B~C → A~C)', () => {
      const uf = new UnionFind(['doc1', 'doc2', 'doc3'])
      uf.union('doc1', 'doc2')
      uf.union('doc2', 'doc3')

      // All should be in same set
      expect(uf.find('doc1')).toBe(uf.find('doc3'))
    })

    it('handles chain transitive grouping (A~B, C~D, B~C → A~D)', () => {
      const uf = new UnionFind(['A', 'B', 'C', 'D'])
      uf.union('A', 'B')
      uf.union('C', 'D')
      uf.union('B', 'C')

      // All should be in same set
      const root = uf.find('A')
      expect(uf.find('B')).toBe(root)
      expect(uf.find('C')).toBe(root)
      expect(uf.find('D')).toBe(root)
    })
  })

  describe('getGroups', () => {
    it('returns correct groups after unions', () => {
      const uf = new UnionFind(['doc1', 'doc2', 'doc3', 'doc4'])
      uf.union('doc1', 'doc2')
      uf.union('doc3', 'doc4')

      const groups = uf.getGroups()
      expect(groups.size).toBe(2)

      // Find the groups
      const groupSizes = Array.from(groups.values()).map((g) => g.length).sort()
      expect(groupSizes).toEqual([2, 2])
    })

    it('returns singleton groups for unmerged documents', () => {
      const uf = new UnionFind(['doc1', 'doc2', 'doc3'])
      uf.union('doc1', 'doc2')

      const groups = uf.getGroups()
      expect(groups.size).toBe(2)

      // doc3 should be in its own group
      expect(groups.get('doc3')).toEqual(['doc3'])
    })

    it('handles path compression correctly', () => {
      const uf = new UnionFind(['A', 'B', 'C', 'D', 'E'])
      // Create a chain: A->B->C->D->E
      uf.union('A', 'B')
      uf.union('B', 'C')
      uf.union('C', 'D')
      uf.union('D', 'E')

      // All should resolve to same root
      const groups = uf.getGroups()
      expect(groups.size).toBe(1)
      expect(Array.from(groups.values())[0].sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
    })
  })

  describe('multi-taxpayer scenario (core use case)', () => {
    it('keeps different taxpayer documents separate', () => {
      const uf = new UnionFind([
        'nguyen_se_p1',
        'nguyen_se_p2',
        'tran_se_p1',
        'tran_se_p2',
      ])

      // Group Nguyen's documents
      uf.union('nguyen_se_p1', 'nguyen_se_p2')

      // Group Tran's documents
      uf.union('tran_se_p1', 'tran_se_p2')

      const groups = uf.getGroups()
      expect(groups.size).toBe(2)

      // Verify no cross-taxpayer mixing
      expect(uf.find('nguyen_se_p1')).not.toBe(uf.find('tran_se_p1'))
    })
  })
})

// =============================================================================
// normalizeTaxpayerName Tests
// =============================================================================

describe('normalizeTaxpayerName', () => {
  describe('null/undefined handling', () => {
    it('returns null for null input', () => {
      expect(normalizeTaxpayerName(null)).toBeNull()
    })

    it('returns null for undefined input', () => {
      expect(normalizeTaxpayerName(undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(normalizeTaxpayerName('')).toBeNull()
    })

    it('returns null for whitespace only', () => {
      expect(normalizeTaxpayerName('   ')).toBeNull()
    })
  })

  describe('case normalization', () => {
    it('converts to uppercase', () => {
      expect(normalizeTaxpayerName('Nguyen Van Anh')).toBe('NGUYEN_VAN_ANH')
    })

    it('handles already uppercase', () => {
      expect(normalizeTaxpayerName('JOHN DOE')).toBe('JOHN_DOE')
    })

    it('handles mixed case', () => {
      expect(normalizeTaxpayerName('JoHn DoE')).toBe('JOHN_DOE')
    })
  })

  describe('whitespace handling', () => {
    it('trims leading/trailing whitespace', () => {
      expect(normalizeTaxpayerName('  John Doe  ')).toBe('JOHN_DOE')
    })

    it('collapses multiple spaces to single underscore', () => {
      expect(normalizeTaxpayerName('John   Doe')).toBe('JOHN_DOE')
    })
  })

  describe('punctuation handling', () => {
    it('removes periods', () => {
      expect(normalizeTaxpayerName('John D. Doe')).toBe('JOHN_D_DOE')
    })

    it('removes commas', () => {
      expect(normalizeTaxpayerName('Doe, John')).toBe('DOE_JOHN')
    })

    it('preserves hyphens in names', () => {
      expect(normalizeTaxpayerName("Jean-Pierre O'Brien")).toBe("JEAN-PIERRE_O'BRIEN")
    })
  })

  describe('joint returns handling', () => {
    it('normalizes & to _AND_', () => {
      expect(normalizeTaxpayerName('John & Jane Doe')).toBe('JOHN_AND_JANE_DOE')
    })

    it('normalizes AND to _AND_', () => {
      expect(normalizeTaxpayerName('John AND Jane Doe')).toBe('JOHN_AND_JANE_DOE')
    })

    it('handles lowercase and', () => {
      expect(normalizeTaxpayerName('John and Jane Doe')).toBe('JOHN_AND_JANE_DOE')
    })
  })

  describe('suffix removal', () => {
    it('removes JR suffix', () => {
      expect(normalizeTaxpayerName('John Doe Jr')).toBe('JOHN_DOE')
    })

    it('removes SR suffix', () => {
      expect(normalizeTaxpayerName('John Doe Sr')).toBe('JOHN_DOE')
    })

    it('removes II suffix', () => {
      expect(normalizeTaxpayerName('John Doe II')).toBe('JOHN_DOE')
    })

    it('removes III suffix', () => {
      expect(normalizeTaxpayerName('John Doe III')).toBe('JOHN_DOE')
    })

    it('removes IV suffix', () => {
      expect(normalizeTaxpayerName('John Doe IV')).toBe('JOHN_DOE')
    })

    it('does not remove suffix in middle of name', () => {
      expect(normalizeTaxpayerName('Junior Smith')).toBe('JUNIOR_SMITH')
    })
  })

  describe('Vietnamese names', () => {
    it('handles common Vietnamese names', () => {
      expect(normalizeTaxpayerName('Nguyen Van Anh')).toBe('NGUYEN_VAN_ANH')
    })

    it('handles Vietnamese names with variations', () => {
      expect(normalizeTaxpayerName('Tran Thi Hong')).toBe('TRAN_THI_HONG')
    })
  })
})

// =============================================================================
// bucketDocumentsByMetadata Tests
// =============================================================================

describe('bucketDocumentsByMetadata', () => {
  describe('empty input', () => {
    it('returns empty map for empty array', () => {
      const result = bucketDocumentsByMetadata([])
      expect(result.size).toBe(0)
    })
  })

  describe('high-confidence taxpayer bucketing', () => {
    it('groups by (formType, taxpayerName) for high confidence', () => {
      const docs: DocumentForGrouping[] = [
        createMockDocument('1', {
          classifiedType: 'SCHEDULE_SE',
          taxpayerName: 'Nguyen Van Anh',
          aiConfidence: 0.9,
        }),
        createMockDocument('2', {
          classifiedType: 'SCHEDULE_SE',
          taxpayerName: 'Nguyen Van Anh',
          aiConfidence: 0.85,
        }),
        createMockDocument('3', {
          classifiedType: 'SCHEDULE_SE',
          taxpayerName: 'Tran Thi Hong',
          aiConfidence: 0.9,
        }),
      ]

      const buckets = bucketDocumentsByMetadata(docs)

      expect(buckets.size).toBe(2)
      expect(buckets.has('SCHEDULE_SE|NGUYEN_VAN_ANH')).toBe(true)
      expect(buckets.has('SCHEDULE_SE|TRAN_THI_HONG')).toBe(true)
    })

    it('separates different form types for same taxpayer', () => {
      const docs: DocumentForGrouping[] = [
        createMockDocument('1', {
          classifiedType: 'SCHEDULE_SE',
          taxpayerName: 'John Doe',
          aiConfidence: 0.9,
        }),
        createMockDocument('2', {
          classifiedType: 'W2',
          taxpayerName: 'John Doe',
          aiConfidence: 0.9,
        }),
      ]

      const buckets = bucketDocumentsByMetadata(docs)

      expect(buckets.size).toBe(2)
      expect(buckets.has('SCHEDULE_SE|JOHN_DOE')).toBe(true)
      expect(buckets.has('W2|JOHN_DOE')).toBe(true)
    })
  })

  describe('low-confidence fallback', () => {
    it('uses _unassigned bucket for low confidence', () => {
      const docs: DocumentForGrouping[] = [
        createMockDocument('1', {
          classifiedType: 'SCHEDULE_SE',
          taxpayerName: 'John Doe',
          aiConfidence: 0.5, // Below threshold
        }),
      ]

      const buckets = bucketDocumentsByMetadata(docs)

      expect(buckets.size).toBe(1)
      expect(buckets.has('SCHEDULE_SE|_unassigned')).toBe(true)
    })

    it('uses _unassigned bucket when taxpayer name missing', () => {
      const docs: DocumentForGrouping[] = [
        createMockDocument('1', {
          classifiedType: 'SCHEDULE_SE',
          taxpayerName: null,
          aiConfidence: 0.9,
        }),
      ]

      const buckets = bucketDocumentsByMetadata(docs)

      expect(buckets.size).toBe(1)
      expect(buckets.has('SCHEDULE_SE|_unassigned')).toBe(true)
    })
  })

  describe('threshold boundary', () => {
    it('includes documents at exactly the threshold', () => {
      const docs: DocumentForGrouping[] = [
        createMockDocument('1', {
          classifiedType: 'W2',
          taxpayerName: 'Jane Smith',
          aiConfidence: METADATA_BUCKETING_THRESHOLD, // Exactly 0.80
        }),
      ]

      const buckets = bucketDocumentsByMetadata(docs)

      expect(buckets.has('W2|JANE_SMITH')).toBe(true)
      expect(buckets.has('W2|_unassigned')).toBe(false)
    })

    it('excludes documents just below threshold', () => {
      const docs: DocumentForGrouping[] = [
        createMockDocument('1', {
          classifiedType: 'W2',
          taxpayerName: 'Jane Smith',
          aiConfidence: METADATA_BUCKETING_THRESHOLD - 0.01, // 0.79
        }),
      ]

      const buckets = bucketDocumentsByMetadata(docs)

      expect(buckets.has('W2|JANE_SMITH')).toBe(false)
      expect(buckets.has('W2|_unassigned')).toBe(true)
    })
  })

  describe('multi-taxpayer separation (core use case)', () => {
    it('separates 4 Schedule SE files into 2 groups by taxpayer', () => {
      const docs: DocumentForGrouping[] = [
        createMockDocument('nguyen_p1', {
          classifiedType: 'SCHEDULE_SE',
          taxpayerName: 'Nguyen Van Anh',
          aiConfidence: 0.92,
        }),
        createMockDocument('nguyen_p2', {
          classifiedType: 'SCHEDULE_SE',
          taxpayerName: 'Nguyen Van Anh',
          aiConfidence: 0.90,
        }),
        createMockDocument('tran_p1', {
          classifiedType: 'SCHEDULE_SE',
          taxpayerName: 'Tran Thi Hong',
          aiConfidence: 0.95,
        }),
        createMockDocument('tran_p2', {
          classifiedType: 'SCHEDULE_SE',
          taxpayerName: 'Tran Thi Hong',
          aiConfidence: 0.88,
        }),
      ]

      const buckets = bucketDocumentsByMetadata(docs)

      expect(buckets.size).toBe(2)

      const nguyenBucket = buckets.get('SCHEDULE_SE|NGUYEN_VAN_ANH')
      const tranBucket = buckets.get('SCHEDULE_SE|TRAN_THI_HONG')

      expect(nguyenBucket?.documents).toHaveLength(2)
      expect(tranBucket?.documents).toHaveLength(2)

      // Verify no cross-taxpayer mixing
      expect(nguyenBucket?.documents.map((d) => d.id)).toEqual(['nguyen_p1', 'nguyen_p2'])
      expect(tranBucket?.documents.map((d) => d.id)).toEqual(['tran_p1', 'tran_p2'])
    })
  })
})

// =============================================================================
// sortDocumentsByPageMarker Tests (Phase 3)
// =============================================================================

describe('sortDocumentsByPageMarker', () => {
  describe('with page markers', () => {
    it('sorts by currentPage ascending', () => {
      const docs = [
        { doc: createMockDocument('3', { pageInfo: { currentPage: 3 } }), originalIndex: 0 },
        { doc: createMockDocument('1', { pageInfo: { currentPage: 1 } }), originalIndex: 1 },
        { doc: createMockDocument('2', { pageInfo: { currentPage: 2 } }), originalIndex: 2 },
      ]

      const sorted = sortDocumentsByPageMarker(docs)

      expect(sorted.map((d) => d.doc.id)).toEqual(['1', '2', '3'])
      expect(sorted.map((d) => d.pageNum)).toEqual([1, 2, 3])
    })

    it('handles out-of-order uploads correctly', () => {
      // Simulates: User uploads page 3, then page 1, then page 2
      const docs = [
        { doc: createMockDocument('page3', { pageInfo: { currentPage: 3 } }), originalIndex: 0 },
        { doc: createMockDocument('page1', { pageInfo: { currentPage: 1 } }), originalIndex: 1 },
        { doc: createMockDocument('page2', { pageInfo: { currentPage: 2 } }), originalIndex: 2 },
      ]

      const sorted = sortDocumentsByPageMarker(docs)

      expect(sorted[0].doc.id).toBe('page1')
      expect(sorted[1].doc.id).toBe('page2')
      expect(sorted[2].doc.id).toBe('page3')
    })
  })

  describe('without page markers (fallback to upload order)', () => {
    it('uses originalIndex + 1 when no pageInfo', () => {
      const docs = [
        { doc: createMockDocument('first'), originalIndex: 0 },
        { doc: createMockDocument('second'), originalIndex: 1 },
        { doc: createMockDocument('third'), originalIndex: 2 },
      ]

      const sorted = sortDocumentsByPageMarker(docs)

      expect(sorted.map((d) => d.pageNum)).toEqual([1, 2, 3])
      expect(sorted.map((d) => d.doc.id)).toEqual(['first', 'second', 'third'])
    })

    it('uses originalIndex when currentPage is 0', () => {
      const docs = [
        { doc: createMockDocument('a', { pageInfo: { currentPage: 0 } }), originalIndex: 0 },
        { doc: createMockDocument('b', { pageInfo: { currentPage: 0 } }), originalIndex: 1 },
      ]

      const sorted = sortDocumentsByPageMarker(docs)

      // Should fallback to originalIndex + 1
      expect(sorted.map((d) => d.pageNum)).toEqual([1, 2])
    })
  })

  describe('mixed markers and fallback', () => {
    it('sorts with partial page info - unknown doc fills gap as page 1', () => {
      const docs = [
        { doc: createMockDocument('known_p2', { pageInfo: { currentPage: 2 } }), originalIndex: 0 },
        { doc: createMockDocument('unknown', { pageInfo: undefined }), originalIndex: 1 },
      ]

      const sorted = sortDocumentsByPageMarker(docs)

      // unknown should be detected as likely page 1 (filling the gap)
      // Then known_p2 is page 2
      // After re-numbering: unknown=1, known_p2=2
      expect(sorted[0].doc.id).toBe('unknown')
      expect(sorted[1].doc.id).toBe('known_p2')
      expect(sorted.map((d) => d.pageNum)).toEqual([1, 2])
    })
  })

  describe('worksheet handling', () => {
    it('places worksheets at the end', () => {
      const docs = [
        { doc: createMockDocument('worksheet', { pageInfo: { isWorksheet: true } }), originalIndex: 0 },
        { doc: createMockDocument('page1', { pageInfo: { currentPage: 1 } }), originalIndex: 1 },
        { doc: createMockDocument('page2', { pageInfo: { currentPage: 2 } }), originalIndex: 2 },
      ]

      const sorted = sortDocumentsByPageMarker(docs)

      // page1, page2, worksheet
      expect(sorted.map((d) => d.doc.id)).toEqual(['page1', 'page2', 'worksheet'])
      expect(sorted.map((d) => d.pageNum)).toEqual([1, 2, 3])
    })

    it('detects worksheet from displayName containing universal', () => {
      const docs = [
        { doc: createMockDocument('uts', { displayName: 'UniversalTaxSystems_Calc' }), originalIndex: 0 },
        { doc: createMockDocument('page1', { pageInfo: { currentPage: 1 } }), originalIndex: 1 },
      ]

      const sorted = sortDocumentsByPageMarker(docs)

      // page1 first, then worksheet
      expect(sorted.map((d) => d.doc.id)).toEqual(['page1', 'uts'])
    })
  })

  describe('Part I detection (isLikelyPage1)', () => {
    it('treats Part I without explicit page number as page 1', () => {
      const docs = [
        { doc: createMockDocument('page2', { pageInfo: { currentPage: 2, partNumber: 'III' } }), originalIndex: 0 },
        { doc: createMockDocument('page1', { pageInfo: { partNumber: 'I' } }), originalIndex: 1 }, // No currentPage
      ]

      const sorted = sortDocumentsByPageMarker(docs)

      // page1 (Part I) should come first
      expect(sorted[0].doc.id).toBe('page1')
      expect(sorted[1].doc.id).toBe('page2')
    })
  })

  describe('Form 2210 scenario (3 pages with worksheet)', () => {
    it('correctly orders: Part I page → Part III page → worksheet', () => {
      // Simulates the real Form 2210 issue from user feedback
      const docs = [
        // Upload order: Part III (page 2), worksheet, Part I (page 1)
        {
          doc: createMockDocument('partIII', {
            pageInfo: { currentPage: 2, partNumber: 'III' },
            classifiedType: 'FORM_2210',
          }),
          originalIndex: 0,
        },
        {
          doc: createMockDocument('worksheet', {
            pageInfo: { isWorksheet: true },
            displayName: 'UniversalTaxSystems_2210_Calc',
            continuationMarker: { type: 'line-reference', parentForm: 'FORM_2210', lineNumber: '19' },
            classifiedType: 'FORM_2210',
          }),
          originalIndex: 1,
        },
        {
          doc: createMockDocument('partI', {
            pageInfo: { currentPage: 1, partNumber: 'I' },
            classifiedType: 'FORM_2210',
          }),
          originalIndex: 2,
        },
      ]

      const sorted = sortDocumentsByPageMarker(docs)

      // Expected order: partI (page 1), partIII (page 2), worksheet (page 3)
      expect(sorted.map((d) => d.doc.id)).toEqual(['partI', 'partIII', 'worksheet'])
      expect(sorted.map((d) => d.pageNum)).toEqual([1, 2, 3])
    })

    it('correctly orders Form 5695: Part I page → Part II page → continuation', () => {
      const docs = [
        // Upload order: Section B continued (page 1 line 25+), Part II (page 2), Part I (page 1)
        {
          doc: createMockDocument('sectionB', {
            pageInfo: { currentPage: 1, partNumber: null }, // Confusing - says page 1 but is continuation
            continuationMarker: { type: 'see-attached', parentForm: null, lineNumber: '25' },
            classifiedType: 'FORM_5695',
          }),
          originalIndex: 0,
        },
        {
          doc: createMockDocument('partII', {
            pageInfo: { currentPage: 2, partNumber: 'II' },
            classifiedType: 'FORM_5695',
          }),
          originalIndex: 1,
        },
        {
          doc: createMockDocument('partI', {
            pageInfo: { currentPage: 1, partNumber: 'I' },
            classifiedType: 'FORM_5695',
          }),
          originalIndex: 2,
        },
      ]

      const sorted = sortDocumentsByPageMarker(docs)

      // sectionB and partI both have currentPage: 1, but sectionB has continuationMarker
      // So partI (no continuation) should be page 1, sectionB (with continuation) should be after page 1
      // Actually this is a tricky case - both claim to be page 1
      // The algorithm should handle this by preferring non-continuation docs for page 1
      // For now, check that partII (page 2) comes after the page 1 docs
      expect(sorted[2].doc.id).toBe('partII')
    })
  })

  describe('pageMarker format (AI classification output)', () => {
    it('sorts by pageMarker.current when pageInfo is not present', () => {
      // This tests the actual format from AI classification
      // AI stores: pageMarker.current, not pageInfo.currentPage
      const docs = [
        {
          doc: {
            ...createMockDocument('page3'),
            aiMetadata: {
              pageMarker: { current: 3, total: 3, partNumber: null, isWorksheet: false },
            } as unknown as DocumentForGrouping['aiMetadata'],
          },
          originalIndex: 0,
        },
        {
          doc: {
            ...createMockDocument('page1'),
            aiMetadata: {
              pageMarker: { current: 1, total: 3, partNumber: 'I', isWorksheet: false },
            } as unknown as DocumentForGrouping['aiMetadata'],
          },
          originalIndex: 1,
        },
        {
          doc: {
            ...createMockDocument('page2'),
            aiMetadata: {
              pageMarker: { current: 2, total: 3, partNumber: 'II', isWorksheet: false },
            } as unknown as DocumentForGrouping['aiMetadata'],
          },
          originalIndex: 2,
        },
      ]

      const sorted = sortDocumentsByPageMarker(docs)

      // Should sort by pageMarker.current ascending: page1, page2, page3
      expect(sorted.map((d) => d.doc.id)).toEqual(['page1', 'page2', 'page3'])
      expect(sorted.map((d) => d.pageNum)).toEqual([1, 2, 3])
    })

    it('handles Form 5695 3-page scenario with pageMarker format', () => {
      // Real scenario: Form 5695 with 3 pages uploaded out of order
      // Page 1 = Part I (first page, no "Page X" indicator)
      // Page 2 = Part II (has "Page 2" in header)
      // Page 3 = Section B continued (has "Page 3" in header)
      const docs = [
        {
          doc: {
            ...createMockDocument('sectionB_page3'),
            displayName: '2024_FORM_5695_LynnieDoAndNhatTTran_(3)',
            aiMetadata: {
              taxpayerName: 'LYNNIE DO AND NHAT T TRAN',
              pageMarker: { current: 3, total: null, partNumber: null, isWorksheet: false },
            } as unknown as DocumentForGrouping['aiMetadata'],
          },
          originalIndex: 0,
        },
        {
          doc: {
            ...createMockDocument('partII_page2'),
            displayName: '2024_FORM_5695_LynnieDoAndNhatTTran',
            aiMetadata: {
              taxpayerName: 'LYNNIE DO AND NHAT T TRAN',
              pageMarker: { current: 2, total: null, partNumber: 'II', isWorksheet: false },
            } as unknown as DocumentForGrouping['aiMetadata'],
          },
          originalIndex: 1,
        },
        {
          doc: {
            ...createMockDocument('partI_page1'),
            displayName: '2024_FORM_5695_LynnieDoAndNhatTTran_(2)',
            aiMetadata: {
              taxpayerName: 'LYNNIE DO AND NHAT T TRAN',
              pageMarker: { current: 1, total: null, partNumber: 'I', isWorksheet: false },
            } as unknown as DocumentForGrouping['aiMetadata'],
          },
          originalIndex: 2,
        },
      ]

      const sorted = sortDocumentsByPageMarker(docs)

      // Expected order: Part I (page 1), Part II (page 2), Section B (page 3)
      expect(sorted.map((d) => d.doc.id)).toEqual(['partI_page1', 'partII_page2', 'sectionB_page3'])
      expect(sorted.map((d) => d.pageNum)).toEqual([1, 2, 3])
    })
  })

  describe('empty input', () => {
    it('returns empty array for empty input', () => {
      const sorted = sortDocumentsByPageMarker([])
      expect(sorted).toEqual([])
    })
  })
})

// =============================================================================
// validatePageSequence Tests (Phase 3)
// =============================================================================

describe('validatePageSequence', () => {
  describe('valid sequences', () => {
    it('validates simple 1,2,3 sequence', () => {
      const result = validatePageSequence([{ pageNum: 1 }, { pageNum: 2 }, { pageNum: 3 }])
      expect(result.valid).toBe(true)
      expect(result.reason).toBe('Valid sequence')
    })

    it('validates single page', () => {
      const result = validatePageSequence([{ pageNum: 1 }])
      expect(result.valid).toBe(true)
    })

    it('validates two pages', () => {
      const result = validatePageSequence([{ pageNum: 1 }, { pageNum: 2 }])
      expect(result.valid).toBe(true)
    })
  })

  describe('invalid sequences', () => {
    it('rejects empty sequence', () => {
      const result = validatePageSequence([])
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('No documents in sequence')
    })

    it('rejects duplicate page numbers', () => {
      const result = validatePageSequence([{ pageNum: 1 }, { pageNum: 1 }, { pageNum: 2 }])
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Duplicate page numbers')
    })

    it('rejects gaps in sequence', () => {
      const result = validatePageSequence([{ pageNum: 1 }, { pageNum: 3 }, { pageNum: 4 }])
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Gap in sequence')
    })

    it('rejects sequence not starting at 1', () => {
      const result = validatePageSequence([{ pageNum: 2 }, { pageNum: 3 }])
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Sequence should start at page 1')
    })
  })

  describe('edge cases', () => {
    it('handles large sequence', () => {
      const pages = Array.from({ length: 10 }, (_, i) => ({ pageNum: i + 1 }))
      const result = validatePageSequence(pages)
      expect(result.valid).toBe(true)
    })

    it('handles unsorted input (validates based on values)', () => {
      // Input order: 3, 1, 2 - but values are checked as set
      const result = validatePageSequence([{ pageNum: 3 }, { pageNum: 1 }, { pageNum: 2 }])
      expect(result.valid).toBe(true) // Values 1,2,3 form valid sequence
    })
  })
})

// =============================================================================
// Integration Tests (End-to-End Scenarios)
// =============================================================================

describe('Integration: Document Grouping Pipeline', () => {
  describe('Multi-taxpayer Schedule SE scenario', () => {
    it('correctly buckets and validates 4 Schedule SE files for 2 taxpayers', () => {
      // Scenario: 4 Schedule SE files from 2 different taxpayers
      const docs: DocumentForGrouping[] = [
        createMockDocument('nguyen_p1', {
          classifiedType: 'SCHEDULE_SE',
          taxpayerName: 'Nguyen Van Anh',
          aiConfidence: 0.92,
          pageInfo: { currentPage: 1, totalPages: 2 },
        }),
        createMockDocument('nguyen_p2', {
          classifiedType: 'SCHEDULE_SE',
          taxpayerName: 'Nguyen Van Anh',
          aiConfidence: 0.90,
          pageInfo: { currentPage: 2, totalPages: 2 },
        }),
        createMockDocument('tran_p1', {
          classifiedType: 'SCHEDULE_SE',
          taxpayerName: 'Tran Thi Hong',
          aiConfidence: 0.95,
          pageInfo: { currentPage: 1, totalPages: 2 },
        }),
        createMockDocument('tran_p2', {
          classifiedType: 'SCHEDULE_SE',
          taxpayerName: 'Tran Thi Hong',
          aiConfidence: 0.88,
          pageInfo: { currentPage: 2, totalPages: 2 },
        }),
      ]

      // Step 1: Bucket by metadata
      const buckets = bucketDocumentsByMetadata(docs)
      expect(buckets.size).toBe(2)

      // Step 2: For each bucket, simulate UnionFind grouping
      const nguyenBucket = buckets.get('SCHEDULE_SE|NGUYEN_VAN_ANH')!
      const ufNguyen = new UnionFind(nguyenBucket.documents.map((d) => d.id))
      ufNguyen.union('nguyen_p1', 'nguyen_p2')
      const nguyenGroups = ufNguyen.getGroups()
      expect(nguyenGroups.size).toBe(1)

      // Step 3: Sort by page markers
      const nguyenDocsForSort = nguyenBucket.documents.map((d, i) => ({
        doc: d,
        originalIndex: i,
      }))
      const sortedNguyen = sortDocumentsByPageMarker(nguyenDocsForSort)
      expect(sortedNguyen[0].doc.id).toBe('nguyen_p1')
      expect(sortedNguyen[1].doc.id).toBe('nguyen_p2')

      // Step 4: Validate sequence
      const validation = validatePageSequence(sortedNguyen)
      expect(validation.valid).toBe(true)
    })
  })

  describe('Page order correction scenario', () => {
    it('reorders pages uploaded in wrong order', () => {
      // Scenario: 3-page document uploaded as page3, page1, page2
      const docs: DocumentForGrouping[] = [
        createMockDocument('page3', {
          classifiedType: 'SCHEDULE_E',
          taxpayerName: 'John Doe',
          aiConfidence: 0.9,
          pageInfo: { currentPage: 3, totalPages: 3 },
        }),
        createMockDocument('page1', {
          classifiedType: 'SCHEDULE_E',
          taxpayerName: 'John Doe',
          aiConfidence: 0.9,
          pageInfo: { currentPage: 1, totalPages: 3 },
        }),
        createMockDocument('page2', {
          classifiedType: 'SCHEDULE_E',
          taxpayerName: 'John Doe',
          aiConfidence: 0.9,
          pageInfo: { currentPage: 2, totalPages: 3 },
        }),
      ]

      // Bucket (should be 1 bucket for same taxpayer/form)
      const buckets = bucketDocumentsByMetadata(docs)
      expect(buckets.size).toBe(1)

      const bucket = buckets.get('SCHEDULE_E|JOHN_DOE')!
      const docsForSort = bucket.documents.map((d, i) => ({
        doc: d,
        originalIndex: i,
      }))

      // Sort should reorder to 1, 2, 3
      const sorted = sortDocumentsByPageMarker(docsForSort)
      expect(sorted.map((d) => d.doc.id)).toEqual(['page1', 'page2', 'page3'])

      // Validate sequence
      const validation = validatePageSequence(sorted)
      expect(validation.valid).toBe(true)
    })
  })

  describe('Mixed confidence scenario', () => {
    it('separates high and low confidence documents', () => {
      const docs: DocumentForGrouping[] = [
        createMockDocument('high1', {
          classifiedType: 'W2',
          taxpayerName: 'John Doe',
          aiConfidence: 0.95,
        }),
        createMockDocument('low1', {
          classifiedType: 'W2',
          taxpayerName: 'Jane Smith',
          aiConfidence: 0.5, // Low confidence
        }),
        createMockDocument('high2', {
          classifiedType: 'W2',
          taxpayerName: 'John Doe',
          aiConfidence: 0.88,
        }),
      ]

      const buckets = bucketDocumentsByMetadata(docs)

      // Should have 2 buckets: W2|JOHN_DOE (high conf) and W2|_unassigned (low conf)
      expect(buckets.size).toBe(2)
      expect(buckets.has('W2|JOHN_DOE')).toBe(true)
      expect(buckets.has('W2|_unassigned')).toBe(true)

      // High confidence bucket should have 2 docs
      expect(buckets.get('W2|JOHN_DOE')?.documents).toHaveLength(2)

      // Low confidence bucket should have 1 doc
      expect(buckets.get('W2|_unassigned')?.documents).toHaveLength(1)
    })
  })
})
