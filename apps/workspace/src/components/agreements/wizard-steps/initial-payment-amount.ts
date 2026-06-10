/**
 * Agreement initial-payment amount inputs store a plain numeric string and
 * render a formatted USD value. The raw string is what validation and API
 * payloads consume.
 */
export function sanitizePaymentAmountInput(input: string): string {
  let cleaned = input.replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
    cleaned = cleaned.slice(0, firstDot + 3)
  }
  return cleaned
}

export function formatPaymentAmountInput(raw: string): string {
  if (!raw) return ''
  const [intPart, decPart] = raw.split('.')
  const grouped = intPart ? Number(intPart).toLocaleString('en-US') : '0'
  const dollars = `$${grouped}`
  return decPart !== undefined ? `${dollars}.${decPart}` : dollars
}
