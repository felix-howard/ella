/**
 * Schedule E Expense Calculator Tests
 */
import { describe, it, expect } from 'vitest'
import {
  calculatePropertyTotals,
  calculateScheduleETotals,
  calculateFairRentalDays,
  recalculateAllTotals,
} from '../expense-calculator'
import type { ScheduleEProperty } from '@ella/shared'

describe('calculatePropertyTotals', () => {
  it('should calculate total expenses correctly', () => {
    const property: Partial<ScheduleEProperty> = {
      insurance: 1200,
      mortgageInterest: 8000,
      repairs: 500,
      taxes: 3000,
      utilities: 1500,
      managementFees: 1000,
      cleaningMaintenance: 600,
      otherExpenses: [],
      rentsReceived: 24000,
    }

    const result = calculatePropertyTotals(property)

    expect(result.totalExpenses).toBe(15800)
    expect(result.netIncome).toBe(8200) // 24000 - 15800
  })

  it('should include other expenses in total', () => {
    const property: Partial<ScheduleEProperty> = {
      insurance: 1000,
      mortgageInterest: 5000,
      repairs: 0,
      taxes: 2000,
      utilities: 0,
      managementFees: 0,
      cleaningMaintenance: 0,
      otherExpenses: [
        { name: 'HOA fees', amount: 1200 },
        { name: 'Landscaping', amount: 800 },
      ],
      rentsReceived: 15000,
    }

    const result = calculatePropertyTotals(property)

    expect(result.totalExpenses).toBe(10000) // 1000 + 5000 + 2000 + 1200 + 800
    expect(result.netIncome).toBe(5000)
  })

  it('should handle empty property', () => {
    const result = calculatePropertyTotals({})

    expect(result.totalExpenses).toBe(0)
    expect(result.netIncome).toBe(0)
  })

  it('should handle missing otherExpenses', () => {
    const property: Partial<ScheduleEProperty> = {
      insurance: 500,
      rentsReceived: 1000,
    }

    const result = calculatePropertyTotals(property)

    expect(result.totalExpenses).toBe(500)
    expect(result.netIncome).toBe(500)
  })

  it('should calculate negative net income when expenses exceed rent', () => {
    const property: Partial<ScheduleEProperty> = {
      insurance: 1000,
      mortgageInterest: 15000,
      taxes: 5000,
      rentsReceived: 12000,
    }

    const result = calculatePropertyTotals(property)

    expect(result.totalExpenses).toBe(21000)
    expect(result.netIncome).toBe(-9000)
  })
})

describe('calculateScheduleETotals', () => {
  it('should aggregate totals across multiple properties', () => {
    const properties: Partial<ScheduleEProperty>[] = [
      {
        rentsReceived: 24000,
        insurance: 1200,
        mortgageInterest: 8000,
        otherExpenses: [],
      },
      {
        rentsReceived: 18000,
        insurance: 1000,
        mortgageInterest: 6000,
        otherExpenses: [],
      },
    ]

    const result = calculateScheduleETotals(properties)

    expect(result.totalRent).toBe(42000)
    expect(result.totalExpenses).toBe(16200) // (1200+8000) + (1000+6000)
    expect(result.totalNet).toBe(25800)
    expect(result.propertyCount).toBe(2)
  })

  it('should handle empty properties array', () => {
    const result = calculateScheduleETotals([])

    expect(result.totalRent).toBe(0)
    expect(result.totalExpenses).toBe(0)
    expect(result.totalNet).toBe(0)
    expect(result.propertyCount).toBe(0)
  })

  it('should handle single property', () => {
    const properties: Partial<ScheduleEProperty>[] = [
      {
        rentsReceived: 12000,
        insurance: 500,
        taxes: 1500,
        otherExpenses: [],
      },
    ]

    const result = calculateScheduleETotals(properties)

    expect(result.totalRent).toBe(12000)
    expect(result.totalExpenses).toBe(2000)
    expect(result.totalNet).toBe(10000)
    expect(result.propertyCount).toBe(1)
  })
})

describe('calculateFairRentalDays', () => {
  it('should calculate fair rental days for 12 months', () => {
    const result = calculateFairRentalDays(12)
    expect(result).toBe(365) // 12 * 30.4167 ≈ 365
  })

  it('should calculate fair rental days for 6 months', () => {
    const result = calculateFairRentalDays(6)
    expect(result).toBe(183) // 6 * 30.4167 ≈ 183 (rounded)
  })

  it('should calculate fair rental days for 1 month', () => {
    const result = calculateFairRentalDays(1)
    expect(result).toBe(30) // 1 * 30.4167 ≈ 30
  })

  it('should return 0 for 0 months', () => {
    const result = calculateFairRentalDays(0)
    expect(result).toBe(0)
  })
})

describe('recalculateAllTotals', () => {
  it('should recalculate totals for all properties', () => {
    const properties: Partial<ScheduleEProperty>[] = [
      {
        id: 'A',
        address: { street: '123 Main', city: 'City', state: 'CA', zip: '90210' },
        propertyType: 1,
        monthsRented: 12,
        fairRentalDays: 365,
        personalUseDays: 0,
        rentsReceived: 24000,
        insurance: 1200,
        mortgageInterest: 8000,
        repairs: 500,
        taxes: 3000,
        utilities: 1500,
        managementFees: 1000,
        cleaningMaintenance: 600,
        otherExpenses: [],
        totalExpenses: 0, // Will be recalculated
        netIncome: 0, // Will be recalculated
      },
    ]

    const result = recalculateAllTotals(properties)

    expect(result[0].totalExpenses).toBe(15800)
    expect(result[0].netIncome).toBe(8200)
  })

  it('should preserve all other property fields', () => {
    const properties: Partial<ScheduleEProperty>[] = [
      {
        id: 'B',
        address: { street: '456 Oak', city: 'Town', state: 'NY', zip: '10001' },
        propertyType: 2,
        monthsRented: 10,
        fairRentalDays: 304,
        personalUseDays: 30,
        rentsReceived: 18000,
        insurance: 800,
        mortgageInterest: 6000,
        repairs: 200,
        taxes: 2000,
        utilities: 1000,
        managementFees: 500,
        cleaningMaintenance: 300,
        otherExpenses: [{ name: 'HOA', amount: 200 }],
        totalExpenses: 0,
        netIncome: 0,
      },
    ]

    const result = recalculateAllTotals(properties)

    expect(result[0].id).toBe('B')
    expect(result[0].address?.street).toBe('456 Oak')
    expect(result[0].propertyType).toBe(2)
    expect(result[0].monthsRented).toBe(10)
    expect(result[0].otherExpenses).toHaveLength(1)
    expect(result[0].totalExpenses).toBe(11000) // 800+6000+200+2000+1000+500+300+200
    expect(result[0].netIncome).toBe(7000)
  })
})
