import type { PricingCalculatorInput } from '@ella/shared/pricing'

export const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

export function clampWholeNumber(value: string | number, max = 1000, min = 0): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < min) return min
  return Math.min(Math.trunc(parsed), max)
}

export function serializePricingInput(input: PricingCalculatorInput): string {
  return JSON.stringify(input)
}

export function trimOptional(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}
