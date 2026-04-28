/**
 * Frontend helpers for Schedule C expense data.
 *
 * countScheduleCExpenseLines: how many IRS Part II expense categories have
 * a non-zero amount + any positive custom-expense rows. Used by the business
 * delete confirmation modal to surface the magnitude of data being lost.
 */
import type { ScheduleCExpense } from './api-client'

const EXPENSE_FIELDS: Array<keyof ScheduleCExpense> = [
  'advertising', 'carExpense', 'commissions', 'contractLabor', 'depletion',
  'depreciation', 'employeeBenefits', 'insurance', 'interestMortgage',
  'interestOther', 'legalServices', 'officeExpense', 'pensionPlans',
  'rentEquipment', 'rentProperty', 'repairs', 'supplies', 'taxesAndLicenses',
  'travel', 'meals', 'utilities', 'wages', 'otherExpenses',
]

export function countScheduleCExpenseLines(expense: ScheduleCExpense | null): number {
  if (!expense) return 0
  let count = 0
  for (const field of EXPENSE_FIELDS) {
    const value = expense[field]
    if (typeof value === 'string' && value !== '' && Number(value) !== 0) count++
  }
  if (expense.customExpenses) {
    for (const item of expense.customExpenses) {
      if (item.amount > 0) count++
    }
  }
  return count
}
