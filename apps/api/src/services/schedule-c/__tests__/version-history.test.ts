/**
 * Version History Service Unit Tests
 * Tests createExpenseSnapshot, detectChanges, createVersionEntry,
 * parseVersionHistory, appendVersionHistory
 */
import { describe, it, expect } from 'vitest'
import { Prisma } from '@ella/db'

const Decimal = Prisma.Decimal

import {
  createExpenseSnapshot,
  detectChanges,
  createVersionEntry,
  parseVersionHistory,
  appendVersionHistory,
  type VersionHistoryEntry,
} from '../version-history'
import { createExpense } from './schedule-c-test-helpers'

describe('Version History', () => {
  describe('createExpenseSnapshot', () => {
    it('creates snapshot with all null fields', () => {
      const expense = createExpense()
      const snapshot = createExpenseSnapshot(expense)

      expect(snapshot.businessName).toBeNull()
      expect(snapshot.grossReceipts).toBeNull()
      expect(snapshot.advertising).toBeNull()
      expect(snapshot.vehicleMiles).toBeNull()
    })

    it('converts Decimal fields to strings', () => {
      const expense = createExpense({
        grossReceipts: new Decimal('5000.50'),
        advertising: new Decimal('100'),
      })
      const snapshot = createExpenseSnapshot(expense)

      expect(snapshot.grossReceipts).toBe('5000.5')
      expect(snapshot.advertising).toBe('100')
    })

    it('preserves string and integer fields as-is', () => {
      const expense = createExpense({
        businessName: 'Test Business',
        otherExpensesNotes: 'Some notes',
        vehicleMiles: 1000,
      })
      const snapshot = createExpenseSnapshot(expense)

      expect(snapshot.businessName).toBe('Test Business')
      expect(snapshot.otherExpensesNotes).toBe('Some notes')
      expect(snapshot.vehicleMiles).toBe(1000)
    })
  })

  describe('detectChanges', () => {
    it('returns "Tạo mới" when no previous data', () => {
      const expense = createExpense({ grossReceipts: new Decimal('5000') })
      const changes = detectChanges(expense, null)
      expect(changes).toEqual(['Tạo mới'])
    })

    it('detects added fields', () => {
      const expense = createExpense({
        advertising: new Decimal('100'),
      })
      const previous = createExpenseSnapshot(createExpense())

      const changes = detectChanges(expense, previous)
      expect(changes).toContain('Thêm Quảng cáo')
    })

    it('detects removed fields', () => {
      const expense = createExpense()
      const previous = createExpenseSnapshot(
        createExpense({ advertising: new Decimal('100') })
      )

      const changes = detectChanges(expense, previous)
      expect(changes).toContain('Xóa Quảng cáo')
    })

    it('detects updated fields', () => {
      const expense = createExpense({
        advertising: new Decimal('200'),
      })
      const previous = createExpenseSnapshot(
        createExpense({ advertising: new Decimal('100') })
      )

      const changes = detectChanges(expense, previous)
      expect(changes).toContain('Cập nhật Quảng cáo')
    })

    it('returns empty array when no changes', () => {
      const expense = createExpense()
      const previous = createExpenseSnapshot(createExpense())

      const changes = detectChanges(expense, previous)
      expect(changes).toEqual([])
    })

    it('detects multiple changes', () => {
      const expense = createExpense({
        businessName: 'New Name',
        advertising: new Decimal('100'),
        insurance: new Decimal('200'),
      })
      const previous = createExpenseSnapshot(
        createExpense({
          businessName: 'Old Name',
          insurance: new Decimal('150'),
        })
      )

      const changes = detectChanges(expense, previous)
      expect(changes).toHaveLength(3)
      expect(changes).toContain('Cập nhật Tên doanh nghiệp')
      expect(changes).toContain('Thêm Quảng cáo')
      expect(changes).toContain('Cập nhật Bảo hiểm')
    })

    it('detects vehicle miles changes', () => {
      const expense = createExpense({ vehicleMiles: 500 })
      const previous = createExpenseSnapshot(createExpense())

      const changes = detectChanges(expense, previous)
      expect(changes).toContain('Thêm Số dặm xe')
    })
  })

  describe('createVersionEntry', () => {
    it('creates entry with version, timestamp, changes, and data', () => {
      const expense = createExpense({ grossReceipts: new Decimal('5000') })
      const entry = createVersionEntry(expense, null, 1)

      expect(entry.version).toBe(1)
      expect(entry.submittedAt).toBeDefined()
      expect(entry.changes).toEqual(['Tạo mới'])
      expect(entry.data.grossReceipts).toBe('5000')
    })

    it('creates entry with change detection from previous snapshot', () => {
      const expense = createExpense({ advertising: new Decimal('200') })
      const previous = createExpenseSnapshot(
        createExpense({ advertising: new Decimal('100') })
      )

      const entry = createVersionEntry(expense, previous, 2)
      expect(entry.version).toBe(2)
      expect(entry.changes).toContain('Cập nhật Quảng cáo')
    })
  })

  describe('parseVersionHistory', () => {
    it('returns empty array for null', () => {
      expect(parseVersionHistory(null)).toEqual([])
    })

    it('returns empty array for undefined', () => {
      expect(parseVersionHistory(undefined)).toEqual([])
    })

    it('returns array as-is', () => {
      const history: VersionHistoryEntry[] = [
        { version: 1, submittedAt: '2026-01-28T00:00:00Z', changes: ['Tạo mới'], data: {} },
      ]
      expect(parseVersionHistory(history)).toEqual(history)
    })

    it('parses JSON string', () => {
      const history = [
        { version: 1, submittedAt: '2026-01-28T00:00:00Z', changes: ['Tạo mới'], data: {} },
      ]
      const result = parseVersionHistory(JSON.stringify(history))
      expect(result).toEqual(history)
    })

    it('returns empty array for invalid JSON string', () => {
      expect(parseVersionHistory('not valid json')).toEqual([])
    })

    it('returns empty array for non-array/string types', () => {
      expect(parseVersionHistory(123)).toEqual([])
      expect(parseVersionHistory({})).toEqual([])
    })
  })

  describe('appendVersionHistory', () => {
    it('appends entry to existing history', () => {
      const existing: VersionHistoryEntry[] = [
        { version: 1, submittedAt: '2026-01-28T00:00:00Z', changes: ['Tạo mới'], data: {} },
      ]
      const newEntry: VersionHistoryEntry = {
        version: 2,
        submittedAt: '2026-01-29T00:00:00Z',
        changes: ['Cập nhật Quảng cáo'],
        data: {},
      }

      const result = appendVersionHistory(existing, newEntry)
      expect(result).toHaveLength(2)
      expect(result[1].version).toBe(2)
    })

    it('creates new history from null', () => {
      const newEntry: VersionHistoryEntry = {
        version: 1,
        submittedAt: '2026-01-28T00:00:00Z',
        changes: ['Tạo mới'],
        data: {},
      }

      const result = appendVersionHistory(null, newEntry)
      expect(result).toHaveLength(1)
      expect(result[0].version).toBe(1)
    })

    it('handles JSON string history', () => {
      const existing = JSON.stringify([
        { version: 1, submittedAt: '2026-01-28T00:00:00Z', changes: ['Tạo mới'], data: {} },
      ])
      const newEntry: VersionHistoryEntry = {
        version: 2,
        submittedAt: '2026-01-29T00:00:00Z',
        changes: ['Update'],
        data: {},
      }

      const result = appendVersionHistory(existing, newEntry)
      expect(result).toHaveLength(2)
    })
  })
})
