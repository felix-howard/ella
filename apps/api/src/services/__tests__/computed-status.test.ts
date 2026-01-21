import { describe, it, expect } from 'vitest'
import {
  computeStatus,
  calculateStaleDays,
  type ComputedStatus,
  type ComputedStatusInput,
} from '@ella/shared/utils/computed-status'

describe('computeStatus', () => {
  /**
   * Test cases verify the priority order:
   * FILED > REVIEW > ENTRY_COMPLETE > READY_FOR_ENTRY > IN_PROGRESS > WAITING_DOCS > INTAKE
   */

  describe('Terminal states (manual flags)', () => {
    it('FILED takes priority over everything', () => {
      const input: ComputedStatusInput = {
        hasIntakeAnswers: true,
        missingDocsCount: 0,
        unverifiedDocsCount: 0,
        pendingEntryCount: 0,
        isInReview: true, // Even if isInReview is true
        isFiled: true,
      }
      const result = computeStatus(input)
      expect(result).toBe('FILED')
    })

    it('REVIEW takes priority when isInReview=true (and isFiled=false)', () => {
      const input: ComputedStatusInput = {
        hasIntakeAnswers: true,
        missingDocsCount: 0,
        unverifiedDocsCount: 0,
        pendingEntryCount: 0,
        isInReview: true,
        isFiled: false,
      }
      const result = computeStatus(input)
      expect(result).toBe('REVIEW')
    })
  })

  describe('Document/entry state progression', () => {
    it('INTAKE when hasIntakeAnswers=false', () => {
      const input: ComputedStatusInput = {
        hasIntakeAnswers: false,
        missingDocsCount: 0,
        unverifiedDocsCount: 0,
        pendingEntryCount: 0,
        isInReview: false,
        isFiled: false,
      }
      const result = computeStatus(input)
      expect(result).toBe('INTAKE')
    })

    it('WAITING_DOCS when missingDocsCount > 0', () => {
      const input: ComputedStatusInput = {
        hasIntakeAnswers: true,
        missingDocsCount: 3, // Missing docs
        unverifiedDocsCount: 0,
        pendingEntryCount: 0,
        isInReview: false,
        isFiled: false,
      }
      const result = computeStatus(input)
      expect(result).toBe('WAITING_DOCS')
    })

    it('IN_PROGRESS when unverifiedDocsCount > 0', () => {
      const input: ComputedStatusInput = {
        hasIntakeAnswers: true,
        missingDocsCount: 0,
        unverifiedDocsCount: 2, // Some docs need verification
        pendingEntryCount: 0,
        isInReview: false,
        isFiled: false,
      }
      const result = computeStatus(input)
      expect(result).toBe('IN_PROGRESS')
    })

    it('READY_FOR_ENTRY when pendingEntryCount > 0', () => {
      const input: ComputedStatusInput = {
        hasIntakeAnswers: true,
        missingDocsCount: 0,
        unverifiedDocsCount: 0,
        pendingEntryCount: 5, // All docs verified but entry incomplete
        isInReview: false,
        isFiled: false,
      }
      const result = computeStatus(input)
      expect(result).toBe('READY_FOR_ENTRY')
    })

    it('ENTRY_COMPLETE when all requirements met', () => {
      const input: ComputedStatusInput = {
        hasIntakeAnswers: true,
        missingDocsCount: 0,
        unverifiedDocsCount: 0,
        pendingEntryCount: 0, // All entry complete
        isInReview: false,
        isFiled: false,
      }
      const result = computeStatus(input)
      expect(result).toBe('ENTRY_COMPLETE')
    })
  })

  describe('Priority ordering verification', () => {
    it('REVIEW takes priority over ENTRY_COMPLETE', () => {
      const input: ComputedStatusInput = {
        hasIntakeAnswers: true,
        missingDocsCount: 0,
        unverifiedDocsCount: 0,
        pendingEntryCount: 0, // Would be ENTRY_COMPLETE
        isInReview: true, // But review takes priority
        isFiled: false,
      }
      const result = computeStatus(input)
      expect(result).toBe('REVIEW')
    })

    it('WAITING_DOCS takes priority over IN_PROGRESS', () => {
      const input: ComputedStatusInput = {
        hasIntakeAnswers: true,
        missingDocsCount: 1, // Missing docs
        unverifiedDocsCount: 3, // Has unverified docs too
        pendingEntryCount: 0,
        isInReview: false,
        isFiled: false,
      }
      const result = computeStatus(input)
      expect(result).toBe('WAITING_DOCS') // Missing takes priority
    })

    it('IN_PROGRESS takes priority over READY_FOR_ENTRY', () => {
      const input: ComputedStatusInput = {
        hasIntakeAnswers: true,
        missingDocsCount: 0,
        unverifiedDocsCount: 1, // Some unverified
        pendingEntryCount: 5, // Also has pending entry
        isInReview: false,
        isFiled: false,
      }
      const result = computeStatus(input)
      expect(result).toBe('IN_PROGRESS') // Unverified takes priority
    })
  })

  describe('Edge cases', () => {
    it('handles all fields at 0', () => {
      const input: ComputedStatusInput = {
        hasIntakeAnswers: true,
        missingDocsCount: 0,
        unverifiedDocsCount: 0,
        pendingEntryCount: 0,
        isInReview: false,
        isFiled: false,
      }
      const result = computeStatus(input)
      expect(result).toBe('ENTRY_COMPLETE')
    })

    it('handles large doc counts', () => {
      const input: ComputedStatusInput = {
        hasIntakeAnswers: true,
        missingDocsCount: 100,
        unverifiedDocsCount: 50,
        pendingEntryCount: 200,
        isInReview: false,
        isFiled: false,
      }
      const result = computeStatus(input)
      expect(result).toBe('WAITING_DOCS') // First priority triggers
    })

    it('INTAKE overrides all doc counts when hasIntakeAnswers=false', () => {
      const input: ComputedStatusInput = {
        hasIntakeAnswers: false,
        missingDocsCount: 10,
        unverifiedDocsCount: 5,
        pendingEntryCount: 20,
        isInReview: false,
        isFiled: false,
      }
      const result = computeStatus(input)
      expect(result).toBe('INTAKE') // No answers = INTAKE regardless
    })
  })
})

describe('calculateStaleDays', () => {
  describe('Date parsing', () => {
    it('accepts Date object', () => {
      const now = new Date()
      const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)
      const result = calculateStaleDays(eightDaysAgo, 7)
      expect(result).toBe(8)
    })

    it('accepts ISO string', () => {
      const now = new Date()
      const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)
      const result = calculateStaleDays(eightDaysAgo.toISOString(), 7)
      expect(result).toBe(8)
    })
  })

  describe('Threshold logic', () => {
    it('returns null when within threshold', () => {
      const now = new Date()
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      const result = calculateStaleDays(threeDaysAgo, 7)
      expect(result).toBeNull()
    })

    it('returns days when exceeding threshold', () => {
      const now = new Date()
      const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)
      const result = calculateStaleDays(eightDaysAgo, 7)
      expect(result).toBe(8)
    })

    it('returns 0 when exactly at threshold', () => {
      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const result = calculateStaleDays(sevenDaysAgo, 7)
      expect(result).toBe(7)
    })

    it('uses default threshold of 7 days', () => {
      const now = new Date()
      const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)
      const result = calculateStaleDays(eightDaysAgo) // No threshold arg
      expect(result).toBe(8)
    })
  })

  describe('Edge cases', () => {
    it('handles recent activity (0 days)', () => {
      const now = new Date()
      const result = calculateStaleDays(now, 7)
      expect(result).toBeNull()
    })

    it('handles very old activity', () => {
      const now = new Date()
      const oneHundredDaysAgo = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000)
      const result = calculateStaleDays(oneHundredDaysAgo, 7)
      expect(result).toBe(100)
    })

    it('handles custom thresholds', () => {
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const result = calculateStaleDays(thirtyDaysAgo, 30)
      expect(result).toBe(30)
    })

    it('returns null for very short custom threshold', () => {
      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const result = calculateStaleDays(oneDayAgo, 2)
      expect(result).toBeNull()
    })
  })
})
