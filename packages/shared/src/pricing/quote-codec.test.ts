import { describe, expect, it } from 'vitest'
import { createDefaultPricingInput } from './calculator'
import { decodePricingQuote, encodePricingQuote } from './quote-codec'

describe('pricing quote codec', () => {
  it('round-trips pricing input for print quote links', () => {
    const input = createDefaultPricingInput()
    input.payrollEmployees = 2
    input.oneTime.startLlc = 1

    const encoded = encodePricingQuote(input)
    const decoded = decodePricingQuote(encoded)

    expect(decoded?.v).toBe(1)
    expect(decoded?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(decoded?.input).toEqual(input)
  })

  it('returns null for malformed quote payloads', () => {
    expect(decodePricingQuote(null)).toBeNull()
    expect(decodePricingQuote('%7Bbad-json')).toBeNull()
    expect(decodePricingQuote(encodeURIComponent(JSON.stringify({ v: 2 })))).toBeNull()
  })
})
