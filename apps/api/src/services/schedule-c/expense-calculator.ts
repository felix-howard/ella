/**
 * Schedule C Expense Calculator Service
 * Calculate gross receipts, total expenses, and net profit from Schedule C data
 */
import { prisma } from '../../lib/db'
import { Prisma } from '@ella/db'
import { config } from '../../lib/config'
import type { ScheduleCExpense } from '@ella/db'

// Re-export Decimal for convenience
const Decimal = Prisma.Decimal
type Decimal = Prisma.Decimal

// IRS 2024 standard mileage rate: 67 cents per mile
// Stored as cents to avoid floating point issues
const DEFAULT_MILEAGE_RATE_CENTS = 67

/**
 * Get mileage rate from config or use default
 */
export function getMileageRateCents(): number {
  return config.scheduleC?.mileageRateCents || DEFAULT_MILEAGE_RATE_CENTS
}

/**
 * Calculate gross receipts from verified 1099-NEC documents
 * Sums nonemployeeCompensation (box 1) from all verified 1099-NECs
 */
export async function calculateGrossReceipts(caseId: string): Promise<Decimal> {
  const verifiedDocs = await prisma.digitalDoc.findMany({
    where: {
      caseId,
      docType: 'FORM_1099_NEC',
      status: 'VERIFIED',
    },
    select: {
      extractedData: true,
    },
  })

  let total = new Decimal(0)

  for (const doc of verifiedDocs) {
    const data = doc.extractedData as { nonemployeeCompensation?: string | number } | null
    if (data?.nonemployeeCompensation) {
      const amount = new Decimal(data.nonemployeeCompensation)
      total = total.plus(amount)
    }
  }

  return total
}

/**
 * Calculate car/mileage deduction from business miles driven
 * Uses standard mileage rate method
 */
export function calculateMileageDeduction(miles: number | null): Decimal {
  if (!miles || miles <= 0) return new Decimal(0)
  const rateDollars = getMileageRateCents() / 100
  return new Decimal(miles).times(rateDollars)
}

// Expense field names (IRS Schedule C Part II lines)
const EXPENSE_FIELDS = [
  'advertising',
  'carExpense',
  'commissions',
  'contractLabor',
  'depletion',
  'depreciation',
  'employeeBenefits',
  'insurance',
  'interestMortgage',
  'interestOther',
  'legalServices',
  'officeExpense',
  'pensionPlans',
  'rentEquipment',
  'rentProperty',
  'repairs',
  'supplies',
  'taxesAndLicenses',
  'travel',
  'meals',
  'utilities',
  'wages',
  'otherExpenses',
] as const

/**
 * Calculate total expenses from Schedule C expense data
 * Note: If using mileage method, includes mileage deduction; excludes carExpense
 * If using actual expenses, includes carExpense; excludes mileage
 */
export function calculateTotalExpenses(expense: ScheduleCExpense): Decimal {
  let total = new Decimal(0)

  for (const field of EXPENSE_FIELDS) {
    const value = expense[field as keyof ScheduleCExpense]
    if (value && value instanceof Decimal) {
      total = total.plus(value)
    }
  }

  // Add mileage deduction if using standard mileage method (vehicleMiles > 0)
  // Note: carExpense and vehicleMiles are mutually exclusive per IRS rules
  if (expense.vehicleMiles && expense.vehicleMiles > 0) {
    // If using mileage method, add mileage deduction (already included if carExpense is set)
    // Only add if carExpense is not set (to avoid double-counting)
    if (!expense.carExpense || expense.carExpense.isZero()) {
      total = total.plus(calculateMileageDeduction(expense.vehicleMiles))
    }
  }

  return total
}

/**
 * Calculate gross income (gross receipts minus returns and cost of goods)
 */
export function calculateGrossIncome(expense: ScheduleCExpense): Decimal {
  const grossReceipts = expense.grossReceipts || new Decimal(0)
  const returns = expense.returns || new Decimal(0)
  const costOfGoods = expense.costOfGoods || new Decimal(0)
  const otherIncome = expense.otherIncome || new Decimal(0)

  return grossReceipts.minus(returns).minus(costOfGoods).plus(otherIncome)
}

/**
 * Calculate net profit/loss (gross income - total expenses)
 */
export function calculateNetProfit(expense: ScheduleCExpense): Decimal {
  const grossIncome = calculateGrossIncome(expense)
  const totalExpenses = calculateTotalExpenses(expense)
  return grossIncome.minus(totalExpenses)
}

/**
 * Calculate all Schedule C totals for display
 */
export interface ScheduleCTotals {
  grossReceipts: Decimal
  returns: Decimal
  costOfGoods: Decimal
  grossIncome: Decimal
  totalExpenses: Decimal
  mileageDeduction: Decimal
  netProfit: Decimal
}

export function calculateScheduleCTotals(expense: ScheduleCExpense): ScheduleCTotals {
  const mileageDeduction = expense.vehicleMiles && (!expense.carExpense || expense.carExpense.isZero())
    ? calculateMileageDeduction(expense.vehicleMiles)
    : new Decimal(0)

  return {
    grossReceipts: expense.grossReceipts || new Decimal(0),
    returns: expense.returns || new Decimal(0),
    costOfGoods: expense.costOfGoods || new Decimal(0),
    grossIncome: calculateGrossIncome(expense),
    totalExpenses: calculateTotalExpenses(expense),
    mileageDeduction,
    netProfit: calculateNetProfit(expense),
  }
}
