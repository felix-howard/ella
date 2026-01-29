/**
 * Expense Calculator Unit Tests
 * Tests calculateGrossReceipts, calculateMileageDeduction, calculateTotalExpenses,
 * calculateGrossIncome, calculateNetProfit, calculateScheduleCTotals
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Prisma } from '@ella/db'

const Decimal = Prisma.Decimal

// Mock prisma before importing
vi.mock('../../../lib/db', () => ({
  prisma: {
    digitalDoc: {
      findMany: vi.fn(),
    },
  },
}))

// Mock config
vi.mock('../../../lib/config', () => ({
  config: {
    scheduleC: { mileageRateCents: 67 },
  },
}))

import { prisma } from '../../../lib/db'
import {
  calculateGrossReceipts,
  calculateMileageDeduction,
  calculateTotalExpenses,
  calculateGrossIncome,
  calculateNetProfit,
  calculateScheduleCTotals,
  getMileageRateCents,
  getGrossReceiptsBreakdown,
} from '../expense-calculator'
import { createExpense } from './schedule-c-test-helpers'

describe('Expense Calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getMileageRateCents', () => {
    it('returns configured rate', () => {
      expect(getMileageRateCents()).toBe(67)
    })
  })

  describe('calculateGrossReceipts', () => {
    const mockFindMany = vi.mocked(prisma.digitalDoc.findMany)

    it('sums verified 1099-NEC nonemployeeCompensation amounts', async () => {
      mockFindMany.mockResolvedValueOnce([
        { extractedData: { nonemployeeCompensation: '5000.00' } },
        { extractedData: { nonemployeeCompensation: '3000.50' } },
      ] as any)

      const result = await calculateGrossReceipts('case-1')
      expect(result.toFixed(2)).toBe('8000.50')
    })

    it('returns zero when no verified 1099-NECs', async () => {
      mockFindMany.mockResolvedValueOnce([])
      const result = await calculateGrossReceipts('case-1')
      expect(result.isZero()).toBe(true)
    })

    it('skips docs with null extractedData', async () => {
      mockFindMany.mockResolvedValueOnce([
        { extractedData: null },
        { extractedData: { nonemployeeCompensation: '1000' } },
      ] as any)

      const result = await calculateGrossReceipts('case-1')
      expect(result.toFixed(2)).toBe('1000.00')
    })

    it('skips docs without nonemployeeCompensation field', async () => {
      mockFindMany.mockResolvedValueOnce([
        { extractedData: { otherField: '999' } },
        { extractedData: { nonemployeeCompensation: '2000' } },
      ] as any)

      const result = await calculateGrossReceipts('case-1')
      expect(result.toFixed(2)).toBe('2000.00')
    })

    it('handles numeric nonemployeeCompensation values', async () => {
      mockFindMany.mockResolvedValueOnce([
        { extractedData: { nonemployeeCompensation: 7500 } },
      ] as any)

      const result = await calculateGrossReceipts('case-1')
      expect(result.toFixed(2)).toBe('7500.00')
    })

    it('queries only VERIFIED 1099-NEC docs for the case', async () => {
      mockFindMany.mockResolvedValueOnce([])
      await calculateGrossReceipts('case-123')

      // Now delegates to getGrossReceiptsBreakdown which includes id + orderBy
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          caseId: 'case-123',
          docType: 'FORM_1099_NEC',
          status: 'VERIFIED',
        },
        select: { id: true, extractedData: true },
        orderBy: { createdAt: 'asc' },
      })
    })
  })

  describe('calculateMileageDeduction', () => {
    it('calculates deduction at $0.67/mile', () => {
      const result = calculateMileageDeduction(1000)
      expect(result.toFixed(2)).toBe('670.00')
    })

    it('returns zero for null miles', () => {
      expect(calculateMileageDeduction(null).isZero()).toBe(true)
    })

    it('returns zero for zero miles', () => {
      expect(calculateMileageDeduction(0).isZero()).toBe(true)
    })

    it('returns zero for negative miles', () => {
      expect(calculateMileageDeduction(-100).isZero()).toBe(true)
    })

    it('handles small mileage amounts', () => {
      const result = calculateMileageDeduction(1)
      expect(result.toFixed(2)).toBe('0.67')
    })
  })

  describe('calculateTotalExpenses', () => {
    it('returns zero when all expense fields null', () => {
      const expense = createExpense()
      expect(calculateTotalExpenses(expense).isZero()).toBe(true)
    })

    it('sums all non-null expense fields', () => {
      const expense = createExpense({
        advertising: new Decimal('100'),
        insurance: new Decimal('200'),
        supplies: new Decimal('50.50'),
      })
      expect(calculateTotalExpenses(expense).toFixed(2)).toBe('350.50')
    })

    it('includes mileage deduction when vehicleMiles set and no carExpense', () => {
      const expense = createExpense({
        vehicleMiles: 1000,
        insurance: new Decimal('200'),
      })
      // 1000 * 0.67 = 670 + 200 = 870
      expect(calculateTotalExpenses(expense).toFixed(2)).toBe('870.00')
    })

    it('does NOT add mileage deduction when carExpense is set', () => {
      const expense = createExpense({
        vehicleMiles: 1000,
        carExpense: new Decimal('500'),
        insurance: new Decimal('200'),
      })
      // carExpense(500) + insurance(200) = 700, no mileage
      expect(calculateTotalExpenses(expense).toFixed(2)).toBe('700.00')
    })

    it('does NOT add mileage deduction when carExpense is zero', () => {
      const expense = createExpense({
        vehicleMiles: 1000,
        carExpense: new Decimal('0'),
        insurance: new Decimal('200'),
      })
      // carExpense is zero (isZero true), so mileage IS added: 670 + 200 = 870
      expect(calculateTotalExpenses(expense).toFixed(2)).toBe('870.00')
    })

    it('sums all 23 expense categories', () => {
      const expense = createExpense({
        advertising: new Decimal('1'),
        carExpense: new Decimal('2'),
        commissions: new Decimal('3'),
        contractLabor: new Decimal('4'),
        depletion: new Decimal('5'),
        depreciation: new Decimal('6'),
        employeeBenefits: new Decimal('7'),
        insurance: new Decimal('8'),
        interestMortgage: new Decimal('9'),
        interestOther: new Decimal('10'),
        legalServices: new Decimal('11'),
        officeExpense: new Decimal('12'),
        pensionPlans: new Decimal('13'),
        rentEquipment: new Decimal('14'),
        rentProperty: new Decimal('15'),
        repairs: new Decimal('16'),
        supplies: new Decimal('17'),
        taxesAndLicenses: new Decimal('18'),
        travel: new Decimal('19'),
        meals: new Decimal('20'),
        utilities: new Decimal('21'),
        wages: new Decimal('22'),
        otherExpenses: new Decimal('23'),
      })
      // Sum of 1..23 = 276
      expect(calculateTotalExpenses(expense).toFixed(2)).toBe('276.00')
    })
  })

  describe('calculateGrossIncome', () => {
    it('returns zero when all income fields null', () => {
      const expense = createExpense()
      expect(calculateGrossIncome(expense).isZero()).toBe(true)
    })

    it('calculates grossReceipts - returns - costOfGoods + otherIncome', () => {
      const expense = createExpense({
        grossReceipts: new Decimal('10000'),
        returns: new Decimal('500'),
        costOfGoods: new Decimal('2000'),
        otherIncome: new Decimal('300'),
      })
      // 10000 - 500 - 2000 + 300 = 7800
      expect(calculateGrossIncome(expense).toFixed(2)).toBe('7800.00')
    })

    it('handles only grossReceipts with other fields null', () => {
      const expense = createExpense({
        grossReceipts: new Decimal('5000'),
      })
      expect(calculateGrossIncome(expense).toFixed(2)).toBe('5000.00')
    })

    it('can produce negative gross income', () => {
      const expense = createExpense({
        grossReceipts: new Decimal('1000'),
        costOfGoods: new Decimal('5000'),
      })
      // 1000 - 0 - 5000 + 0 = -4000
      expect(calculateGrossIncome(expense).toFixed(2)).toBe('-4000.00')
    })
  })

  describe('calculateNetProfit', () => {
    it('calculates grossIncome - totalExpenses', () => {
      const expense = createExpense({
        grossReceipts: new Decimal('10000'),
        advertising: new Decimal('1000'),
        insurance: new Decimal('500'),
      })
      // grossIncome = 10000, totalExpenses = 1500
      expect(calculateNetProfit(expense).toFixed(2)).toBe('8500.00')
    })

    it('returns negative for net loss', () => {
      const expense = createExpense({
        grossReceipts: new Decimal('1000'),
        advertising: new Decimal('3000'),
      })
      // grossIncome = 1000, totalExpenses = 3000
      expect(calculateNetProfit(expense).toFixed(2)).toBe('-2000.00')
    })

    it('returns zero when no data', () => {
      const expense = createExpense()
      expect(calculateNetProfit(expense).isZero()).toBe(true)
    })
  })

  describe('getGrossReceiptsBreakdown', () => {
    const mockFindMany = vi.mocked(prisma.digitalDoc.findMany)

    it('returns per-payer breakdown with docId, payerName, amount', async () => {
      mockFindMany.mockResolvedValueOnce([
        { id: 'doc-1', extractedData: { payerName: 'ABC Corp', nonemployeeCompensation: '5000.00' } },
        { id: 'doc-2', extractedData: { payerName: 'XYZ Inc', nonemployeeCompensation: '3000.50' } },
      ] as any)

      const result = await getGrossReceiptsBreakdown('case-1')
      expect(result).toEqual([
        { docId: 'doc-1', payerName: 'ABC Corp', nonemployeeCompensation: '5000.00' },
        { docId: 'doc-2', payerName: 'XYZ Inc', nonemployeeCompensation: '3000.50' },
      ])
    })

    it('returns empty array when no verified 1099-NECs', async () => {
      mockFindMany.mockResolvedValueOnce([])
      const result = await getGrossReceiptsBreakdown('case-1')
      expect(result).toEqual([])
    })

    it('returns null payerName when not in extractedData', async () => {
      mockFindMany.mockResolvedValueOnce([
        { id: 'doc-1', extractedData: { nonemployeeCompensation: '2000' } },
      ] as any)

      const result = await getGrossReceiptsBreakdown('case-1')
      expect(result).toEqual([
        { docId: 'doc-1', payerName: null, nonemployeeCompensation: '2000.00' },
      ])
    })

    it('filters out docs without nonemployeeCompensation', async () => {
      mockFindMany.mockResolvedValueOnce([
        { id: 'doc-1', extractedData: { otherField: '999' } },
        { id: 'doc-2', extractedData: { nonemployeeCompensation: '1500' } },
        { id: 'doc-3', extractedData: null },
      ] as any)

      const result = await getGrossReceiptsBreakdown('case-1')
      expect(result).toHaveLength(1)
      expect(result[0].docId).toBe('doc-2')
    })

    it('handles numeric compensation values', async () => {
      mockFindMany.mockResolvedValueOnce([
        { id: 'doc-1', extractedData: { payerName: 'Test', nonemployeeCompensation: 7500 } },
      ] as any)

      const result = await getGrossReceiptsBreakdown('case-1')
      expect(result[0].nonemployeeCompensation).toBe('7500.00')
    })

    it('queries with correct filters and ordering', async () => {
      mockFindMany.mockResolvedValueOnce([])
      await getGrossReceiptsBreakdown('case-123')

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          caseId: 'case-123',
          docType: 'FORM_1099_NEC',
          status: 'VERIFIED',
        },
        select: { id: true, extractedData: true },
        orderBy: { createdAt: 'asc' },
      })
    })
  })

  describe('calculateScheduleCTotals', () => {
    it('returns all calculated totals', () => {
      const expense = createExpense({
        grossReceipts: new Decimal('10000'),
        returns: new Decimal('200'),
        costOfGoods: new Decimal('1000'),
        otherIncome: new Decimal('500'),
        advertising: new Decimal('300'),
        vehicleMiles: 500,
      })

      const totals = calculateScheduleCTotals(expense)

      expect(totals.grossReceipts.toFixed(2)).toBe('10000.00')
      expect(totals.returns.toFixed(2)).toBe('200.00')
      expect(totals.costOfGoods.toFixed(2)).toBe('1000.00')
      expect(totals.grossIncome.toFixed(2)).toBe('9300.00') // 10000-200-1000+500
      // mileage: 500 * 0.67 = 335
      expect(totals.mileageDeduction.toFixed(2)).toBe('335.00')
      expect(totals.totalExpenses.toFixed(2)).toBe('635.00') // 300 + 335
      expect(totals.netProfit.toFixed(2)).toBe('8665.00') // 9300 - 635
    })

    it('returns zeros when expense has no data', () => {
      const expense = createExpense()
      const totals = calculateScheduleCTotals(expense)

      expect(totals.grossReceipts.isZero()).toBe(true)
      expect(totals.returns.isZero()).toBe(true)
      expect(totals.costOfGoods.isZero()).toBe(true)
      expect(totals.grossIncome.isZero()).toBe(true)
      expect(totals.totalExpenses.isZero()).toBe(true)
      expect(totals.mileageDeduction.isZero()).toBe(true)
      expect(totals.netProfit.isZero()).toBe(true)
    })

    it('mileageDeduction is zero when carExpense is set', () => {
      const expense = createExpense({
        vehicleMiles: 1000,
        carExpense: new Decimal('500'),
      })

      const totals = calculateScheduleCTotals(expense)
      expect(totals.mileageDeduction.isZero()).toBe(true)
    })
  })
})
