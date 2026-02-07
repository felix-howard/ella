/**
 * Schedule E Expense Calculator Service
 * Calculate totals for rental property income/expenses
 */
import type { ScheduleEProperty, ScheduleETotals } from '@ella/shared'

/**
 * Calculate totals for a single property
 * Returns totalExpenses and netIncome
 */
export function calculatePropertyTotals(property: Partial<ScheduleEProperty>): {
  totalExpenses: number
  netIncome: number
} {
  const expenseFields = [
    property.insurance ?? 0,
    property.mortgageInterest ?? 0,
    property.repairs ?? 0,
    property.taxes ?? 0,
    property.utilities ?? 0,
    property.managementFees ?? 0,
    property.cleaningMaintenance ?? 0,
  ]

  const otherTotal = (property.otherExpenses ?? []).reduce(
    (sum, expense) => sum + (expense.amount ?? 0),
    0
  )

  const totalExpenses = expenseFields.reduce((sum, value) => sum + value, 0) + otherTotal
  const rentsReceived = property.rentsReceived ?? 0
  const netIncome = rentsReceived - totalExpenses

  return { totalExpenses, netIncome }
}

/**
 * Calculate aggregate totals across all properties
 */
export function calculateScheduleETotals(properties: Partial<ScheduleEProperty>[]): ScheduleETotals {
  let totalRent = 0
  let totalExpenses = 0
  let totalNet = 0

  for (const property of properties) {
    const propertyTotals = calculatePropertyTotals(property)
    totalRent += property.rentsReceived ?? 0
    totalExpenses += propertyTotals.totalExpenses
    totalNet += propertyTotals.netIncome
  }

  return {
    totalRent,
    totalExpenses,
    totalNet,
    propertyCount: properties.length,
  }
}

/**
 * Calculate fair rental days from months rented
 * Uses IRS standard of 30 days per month average
 */
export function calculateFairRentalDays(monthsRented: number): number {
  return Math.round(monthsRented * 30.4167)
}

/**
 * Recalculate totals for all properties and return updated array
 */
export function recalculateAllTotals(
  properties: Partial<ScheduleEProperty>[]
): ScheduleEProperty[] {
  return properties.map((property) => {
    const { totalExpenses, netIncome } = calculatePropertyTotals(property)
    return {
      ...property,
      totalExpenses,
      netIncome,
    } as ScheduleEProperty
  })
}
