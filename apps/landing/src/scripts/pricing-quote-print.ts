import { calculatePrice, isPricingInputSane, type LineItem } from '@/config/pricing'
import { siteConfig } from '@/config/site'
import { formatUsd } from './pricing-calculator-format'
import { decodePricingQuote } from './pricing-quote-codec'

const TERMS = [
  'This estimate is based on the information entered in the pricing calculator.',
  'Final fees may change after Ella Tax Services reviews entity structure, tax years, states, deadlines, notices, bookkeeping condition, and filing facts.',
  'State filing fees, government fees, penalties, interest, and third-party platform fees are excluded unless listed separately.',
  'Recurring services are billed monthly. One-time setup and fixed-fee services are due before work begins unless agreed otherwise in writing.',
]

function qs<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector<T>(selector)
}

function setText(selector: string, value: string): void {
  const el = qs(selector)
  if (el) el.textContent = value
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'To be confirmed'
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

function makeQuoteId(createdAt: string, raw: string): string {
  let hash = 0
  for (const char of raw) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const date = createdAt.slice(0, 10).replace(/-/g, '')
  return `EST-${date}-${hash.toString(36).slice(0, 5).toUpperCase()}`
}

function addCell(row: HTMLTableRowElement, text: string, className = ''): void {
  const cell = document.createElement('td')
  cell.textContent = text
  if (className) cell.className = className
  row.appendChild(cell)
}

function renderRows(selector: string, items: LineItem[], cadence: string): void {
  const body = qs<HTMLTableSectionElement>(selector)
  if (!body) return
  body.replaceChildren()
  for (const item of items) {
    const row = document.createElement('tr')
    const label = document.createElement('td')
    label.textContent = item.label
    if (item.note) {
      const note = document.createElement('span')
      note.textContent = item.note
      note.className = 'line-note'
      label.appendChild(note)
    }
    row.appendChild(label)
    addCell(row, cadence)
    addCell(row, formatUsd(item.amount), 'amount')
    body.appendChild(row)
  }
}

function renderTerms(): void {
  const list = qs<HTMLUListElement>('[data-quote-terms]')
  if (!list) return
  list.replaceChildren()
  for (const term of TERMS) {
    const item = document.createElement('li')
    item.textContent = term
    list.appendChild(item)
  }
}

function showInvalid(message: string): void {
  document.documentElement.dataset.quoteState = 'invalid'
  setText('[data-quote-error]', message)
}

function init(): void {
  const raw = new URLSearchParams(window.location.search).get('q')
  const payload = decodePricingQuote(raw)
  if (!payload || !isPricingInputSane(payload.input)) {
    showInvalid('This quote link is missing, expired, or malformed. Return to pricing and print a new PDF.')
    return
  }

  const result = calculatePrice(payload.input)
  if (!result.hasAnySelection || result.isEnterprise) {
    showInvalid('This calculation needs a standard quote selection before it can be printed.')
    return
  }

  const dueToday = result.monthlyTotal + result.setupTotal
  const quoteId = makeQuoteId(payload.createdAt, raw ?? '')
  document.title = `${quoteId} - Ella Tax Services Quote`
  document.documentElement.dataset.quoteState = 'ready'
  setText('[data-quote-id]', quoteId)
  setText('[data-quote-date]', formatDate(payload.createdAt))
  setText('[data-quote-tier]', result.tierLabel)
  setText('[data-quote-monthly]', `${formatUsd(result.monthlyTotal)} / month`)
  setText('[data-quote-setup]', formatUsd(result.setupTotal))
  setText('[data-quote-due]', formatUsd(dueToday))
  setText('[data-quote-next-month]', `${formatUsd(result.monthlyTotal)} / month`)
  setText('[data-quote-company]', siteConfig.legalName)
  setText('[data-quote-contact]', `${siteConfig.contact.email} | ${siteConfig.contact.phone}`)
  renderRows('[data-quote-monthly-rows]', result.monthlyItems, 'Monthly')
  renderRows('[data-quote-setup-rows]', result.setupItems, 'One-time')
  renderTerms()
  window.setTimeout(() => window.print(), 250)
}

qs<HTMLButtonElement>('[data-print-now]')?.addEventListener('click', () => window.print())

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
