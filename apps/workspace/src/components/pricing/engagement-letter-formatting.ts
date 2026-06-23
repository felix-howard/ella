export const OUT_OF_SCOPE_HOURLY_RATE = 300
export const TAX_ALLOCATION_MONTHS = 6

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

const MONEY_FORMAT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatPreparedDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not dated'
  return DATE_FORMAT.format(date)
}

export function formatMoney(amount: number): string {
  return MONEY_FORMAT.format(amount)
}

export function plural(count: number): string {
  return count === 1 ? '' : 's'
}

export function renderList(items: string[]): string {
  return `<ul>\n${items.map((item) => `  <li>${escapeHtml(item)}</li>`).join('\n')}\n</ul>`
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
