/** Format a US phone number as XXX XXX XXXX, stripping country code prefix */
export function formatPhoneUS(value: string): string {
  const digits = value.replace(/\D/g, '')
  const cleaned = digits.startsWith('1') ? digits.slice(1) : digits
  const limited = cleaned.slice(0, 10)
  if (limited.length <= 3) return limited
  if (limited.length <= 6) return `${limited.slice(0, 3)} ${limited.slice(3)}`
  return `${limited.slice(0, 3)} ${limited.slice(3, 6)} ${limited.slice(6)}`
}
