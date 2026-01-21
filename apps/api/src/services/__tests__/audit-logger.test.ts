/**
 * Audit Logger Service Unit Tests
 * Tests logProfileChanges, computeIntakeAnswersDiff, computeProfileFieldDiff
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock prisma before importing
vi.mock('../../lib/db', () => ({
  prisma: {
    auditLog: {
      createMany: vi.fn(),
    },
  },
}))

import { prisma } from '../../lib/db'
import {
  logProfileChanges,
  computeIntakeAnswersDiff,
  computeProfileFieldDiff,
  type FieldChange,
} from '../audit-logger'

describe('Audit Logger', () => {
  const mockCreateMany = vi.mocked(prisma.auditLog.createMany)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('logProfileChanges', () => {
    it('should create audit entry for single field change', async () => {
      mockCreateMany.mockResolvedValueOnce({ count: 1 })

      const changes: FieldChange[] = [
        { field: 'intakeAnswers.hasW2', oldValue: false, newValue: true },
      ]

      await logProfileChanges('client-123', changes, 'staff-456')

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            entityType: 'CLIENT_PROFILE',
            entityId: 'client-123',
            field: 'intakeAnswers.hasW2',
            oldValue: false,
            newValue: true,
            changedById: 'staff-456',
          }),
        ],
      })
    })

    it('should batch multiple changes in single createMany call', async () => {
      mockCreateMany.mockResolvedValueOnce({ count: 3 })

      const changes: FieldChange[] = [
        { field: 'intakeAnswers.hasW2', oldValue: false, newValue: true },
        { field: 'intakeAnswers.w2Count', oldValue: null, newValue: 2 },
        { field: 'filingStatus', oldValue: 'SINGLE', newValue: 'MARRIED' },
      ]

      await logProfileChanges('client-123', changes, 'staff-456')

      expect(mockCreateMany).toHaveBeenCalledTimes(1)
      expect(mockCreateMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ field: 'intakeAnswers.hasW2' }),
          expect.objectContaining({ field: 'intakeAnswers.w2Count' }),
          expect.objectContaining({ field: 'filingStatus' }),
        ]),
      })

      const callData = mockCreateMany.mock.calls[0]?.[0]?.data
      expect(callData).toHaveLength(3)
    })

    it('should handle undefined staffId (system changes)', async () => {
      mockCreateMany.mockResolvedValueOnce({ count: 1 })

      const changes: FieldChange[] = [
        { field: 'intakeAnswers.hasW2', oldValue: false, newValue: true },
      ]

      await logProfileChanges('client-123', changes, undefined)

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            entityType: 'CLIENT_PROFILE',
            entityId: 'client-123',
            changedById: undefined,
          }),
        ],
      })
    })

    it('should skip logging when changes array is empty', async () => {
      await logProfileChanges('client-123', [], 'staff-456')

      expect(mockCreateMany).not.toHaveBeenCalled()
    })

    it('should handle null values correctly', async () => {
      mockCreateMany.mockResolvedValueOnce({ count: 1 })

      const changes: FieldChange[] = [
        { field: 'intakeAnswers.email', oldValue: 'test@example.com', newValue: null },
      ]

      await logProfileChanges('client-123', changes)

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            oldValue: 'test@example.com',
            // newValue should be Prisma.JsonNull for explicit null
          }),
        ],
      })
    })

    it('should handle database errors gracefully', async () => {
      mockCreateMany.mockRejectedValueOnce(new Error('Database error'))

      const changes: FieldChange[] = [
        { field: 'intakeAnswers.hasW2', oldValue: false, newValue: true },
      ]

      // Should not throw - errors are logged but not propagated
      await expect(logProfileChanges('client-123', changes)).resolves.not.toThrow()

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        '[AuditLog] CRITICAL: Failed to log changes',
        expect.objectContaining({
          clientId: 'client-123',
          changesCount: 1,
        })
      )
    })

    it('should log success message on completion', async () => {
      mockCreateMany.mockResolvedValueOnce({ count: 2 })

      const changes: FieldChange[] = [
        { field: 'field1', oldValue: 'a', newValue: 'b' },
        { field: 'field2', oldValue: 1, newValue: 2 },
      ]

      await logProfileChanges('client-123', changes)

      expect(console.log).toHaveBeenCalledWith(
        '[AuditLog] Logged 2 changes for client client-123'
      )
    })
  })

  describe('computeIntakeAnswersDiff', () => {
    it('should detect single field change', () => {
      const oldAnswers = { hasW2: false, w2Count: 1 }
      const newAnswers = { hasW2: true, w2Count: 1 }

      const diff = computeIntakeAnswersDiff(oldAnswers, newAnswers)

      expect(diff).toHaveLength(1)
      expect(diff[0]).toEqual({
        field: 'intakeAnswers.hasW2',
        oldValue: false,
        newValue: true,
      })
    })

    it('should detect multiple field changes', () => {
      const oldAnswers = { hasW2: false, w2Count: 1, hasBankAccount: true }
      const newAnswers = { hasW2: true, w2Count: 3, hasBankAccount: true }

      const diff = computeIntakeAnswersDiff(oldAnswers, newAnswers)

      expect(diff).toHaveLength(2)
      expect(diff).toEqual(
        expect.arrayContaining([
          { field: 'intakeAnswers.hasW2', oldValue: false, newValue: true },
          { field: 'intakeAnswers.w2Count', oldValue: 1, newValue: 3 },
        ])
      )
    })

    it('should not report unchanged fields', () => {
      const oldAnswers = { hasW2: true, w2Count: 2 }
      const newAnswers = { hasW2: true, w2Count: 2 }

      const diff = computeIntakeAnswersDiff(oldAnswers, newAnswers)

      expect(diff).toHaveLength(0)
    })

    it('should detect new fields added', () => {
      const oldAnswers = { hasW2: true }
      const newAnswers = { hasW2: true, hasBankAccount: true }

      const diff = computeIntakeAnswersDiff(oldAnswers, newAnswers)

      expect(diff).toHaveLength(1)
      expect(diff[0]).toEqual({
        field: 'intakeAnswers.hasBankAccount',
        oldValue: undefined,
        newValue: true,
      })
    })

    it('should handle string value changes', () => {
      const oldAnswers = { filingStatus: 'SINGLE' }
      const newAnswers = { filingStatus: 'MARRIED' }

      const diff = computeIntakeAnswersDiff(oldAnswers, newAnswers)

      expect(diff).toHaveLength(1)
      expect(diff[0]).toEqual({
        field: 'intakeAnswers.filingStatus',
        oldValue: 'SINGLE',
        newValue: 'MARRIED',
      })
    })

    it('should handle number to boolean type change', () => {
      // Edge case: type mismatch (shouldn't happen in practice but worth testing)
      const oldAnswers = { someField: 1 }
      const newAnswers = { someField: true }

      const diff = computeIntakeAnswersDiff(oldAnswers, newAnswers)

      expect(diff).toHaveLength(1)
      expect(diff[0].oldValue).toBe(1)
      expect(diff[0].newValue).toBe(true)
    })

    it('should only compare keys present in newAnswers', () => {
      // Partial update pattern - old has more keys than new
      const oldAnswers = { hasW2: true, w2Count: 2, hasBankAccount: false }
      const newAnswers = { hasW2: false }  // Only updating hasW2

      const diff = computeIntakeAnswersDiff(oldAnswers, newAnswers)

      // Should only report change for hasW2, not missing hasBankAccount
      expect(diff).toHaveLength(1)
      expect(diff[0].field).toBe('intakeAnswers.hasW2')
    })

    it('should handle empty objects', () => {
      const diff1 = computeIntakeAnswersDiff({}, {})
      expect(diff1).toHaveLength(0)

      const diff2 = computeIntakeAnswersDiff({ hasW2: true }, {})
      expect(diff2).toHaveLength(0)

      const diff3 = computeIntakeAnswersDiff({}, { hasW2: true })
      expect(diff3).toHaveLength(1)
    })
  })

  describe('computeProfileFieldDiff', () => {
    it('should detect filingStatus change', () => {
      const oldProfile = { filingStatus: 'SINGLE' }
      const newProfile = { filingStatus: 'MARRIED_FILING_JOINTLY' }

      const diff = computeProfileFieldDiff(oldProfile, newProfile)

      expect(diff).toHaveLength(1)
      expect(diff[0]).toEqual({
        field: 'filingStatus',
        oldValue: 'SINGLE',
        newValue: 'MARRIED_FILING_JOINTLY',
      })
    })

    it('should not report when filingStatus unchanged', () => {
      const oldProfile = { filingStatus: 'SINGLE' }
      const newProfile = { filingStatus: 'SINGLE' }

      const diff = computeProfileFieldDiff(oldProfile, newProfile)

      expect(diff).toHaveLength(0)
    })

    it('should handle undefined new filingStatus', () => {
      const oldProfile = { filingStatus: 'SINGLE' }
      const newProfile = {}

      const diff = computeProfileFieldDiff(oldProfile, newProfile)

      // Should not report when newProfile.filingStatus is undefined (not updating)
      expect(diff).toHaveLength(0)
    })

    it('should detect null to value change', () => {
      const oldProfile = { filingStatus: null }
      const newProfile = { filingStatus: 'SINGLE' }

      const diff = computeProfileFieldDiff(oldProfile, newProfile)

      expect(diff).toHaveLength(1)
      expect(diff[0].oldValue).toBeNull()
      expect(diff[0].newValue).toBe('SINGLE')
    })

    it('should handle empty profiles', () => {
      const diff = computeProfileFieldDiff({}, {})
      expect(diff).toHaveLength(0)
    })
  })

  describe('Integration Scenarios', () => {
    it('should correctly diff complex intake answer updates', () => {
      const oldAnswers = {
        hasW2: true,
        w2Count: 2,
        hasKidsUnder17: true,
        numKidsUnder17: 3,
        hasSelfEmployment: false,
        filingStatus: 'SINGLE',
      }

      const newAnswers = {
        hasW2: true,          // unchanged
        w2Count: 3,           // changed: 2 -> 3
        hasKidsUnder17: false, // changed: true -> false
        numKidsUnder17: 0,     // changed: 3 -> 0
        hasSelfEmployment: true, // changed: false -> true
        filingStatus: 'MARRIED', // changed: SINGLE -> MARRIED
      }

      const diff = computeIntakeAnswersDiff(oldAnswers, newAnswers)

      expect(diff).toHaveLength(5)
      const fieldNames = diff.map(d => d.field)
      expect(fieldNames).toContain('intakeAnswers.w2Count')
      expect(fieldNames).toContain('intakeAnswers.hasKidsUnder17')
      expect(fieldNames).toContain('intakeAnswers.numKidsUnder17')
      expect(fieldNames).toContain('intakeAnswers.hasSelfEmployment')
      expect(fieldNames).toContain('intakeAnswers.filingStatus')
    })

    it('should log combined intake and profile changes', async () => {
      mockCreateMany.mockResolvedValueOnce({ count: 3 })

      const intakeChanges = computeIntakeAnswersDiff(
        { hasW2: false },
        { hasW2: true }
      )
      const profileChanges = computeProfileFieldDiff(
        { filingStatus: 'SINGLE' },
        { filingStatus: 'MARRIED' }
      )

      const allChanges = [...intakeChanges, ...profileChanges]
      expect(allChanges).toHaveLength(2)

      await logProfileChanges('client-123', allChanges, 'staff-456')

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ field: 'intakeAnswers.hasW2' }),
          expect.objectContaining({ field: 'filingStatus' }),
        ]),
      })
    })
  })
})
