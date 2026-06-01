import type { CalcInput } from '@/config/pricing'

export interface PricingQuotePayload {
  v: 1
  createdAt: string
  input: CalcInput
}

export function encodePricingQuote(input: CalcInput): string {
  const payload: PricingQuotePayload = {
    v: 1,
    createdAt: new Date().toISOString(),
    input,
  }
  return encodeURIComponent(JSON.stringify(payload))
}

export function decodePricingQuote(raw: string | null): PricingQuotePayload | null {
  if (!raw) return null
  try {
    const json = raw.trim().startsWith('{') ? raw : decodeURIComponent(raw)
    const parsed = JSON.parse(json) as Partial<PricingQuotePayload>
    if (parsed.v !== 1 || typeof parsed.createdAt !== 'string' || !parsed.input) return null
    return parsed as PricingQuotePayload
  } catch {
    return null
  }
}
