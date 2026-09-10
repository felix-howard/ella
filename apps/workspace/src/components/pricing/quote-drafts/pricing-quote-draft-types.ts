import { materializePricingSetupRates, type PricingCalculatorInput } from '@ella/shared/pricing'

export function canonicalizePricingQuoteDraftInput(
  input: PricingCalculatorInput
): PricingCalculatorInput {
  const canonical = materializePricingSetupRates(input)
  return {
    ...canonical,
    customItems: (canonical.customItems ?? []).map((item) => ({
      ...item,
      id: item.id.trim(),
      label: item.label.trim(),
    })),
  }
}

export function pricingQuoteDraftSignature(input: PricingCalculatorInput): string {
  return JSON.stringify(canonicalizePricingQuoteDraftInput(input), (_key, value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    )
  })
}
