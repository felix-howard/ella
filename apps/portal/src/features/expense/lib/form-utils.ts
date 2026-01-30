/**
 * Form Utilities (Simplified)
 * Convert form data to API input format
 * Handles customExpenses JSONB array serialization
 */
import type { ExpenseFormInput } from './expense-api'

/**
 * Convert form data to API input format
 * Filters out incomplete custom expense rows (need both name + amount)
 */
export function toApiInput(data: Record<string, unknown>): ExpenseFormInput {
  // Filter customExpenses: only include rows where both name and amount are present
  const rawItems = data.customExpenses as Array<{ name: string; amount: number | null }> | undefined
  const customExpenses = rawItems
    ?.filter(item => item.name && item.amount !== null && item.amount !== undefined)
    .map(item => ({ name: item.name, amount: item.amount as number })) ?? []

  return {
    grossReceipts: data.grossReceipts as number | null,
    travel: data.travel as number | null,
    meals: data.meals as number | null,
    supplies: data.supplies as number | null,
    carExpense: data.carExpense as number | null,
    vehicleMiles: data.vehicleMiles as number | null,
    customExpenses,
  }
}
