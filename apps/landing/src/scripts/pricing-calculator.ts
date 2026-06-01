/**
 * Pricing calculator — client wiring for /pricing page. Reads form state
 * via [data-calc-input="<path>"] selectors, runs pure calculatePrice(),
 * and delegates to the render module to mutate the summary panel.
 * XSS-safe: all DOM writes go through `textContent` / cloned templates.
 */
import {
  calculatePrice,
  createDefaultPricingInput,
  isPricingInputSane,
  type CalcResult,
  type CalcInput,
} from '@/config/pricing'
import { formatBreakdown } from './pricing-calculator-format'
import { renderResult, resolveRefs } from './pricing-calculator-render'
import { initPaymentLink } from './pricing-payment-link'

function clampInt(raw: string): number {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.trunc(n))
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur[parts[i]]
    if (typeof next !== 'object' || next === null) return
    cur = next as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
}

function readElementValue(el: HTMLElement): unknown {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox') return el.checked
    if (el.type === 'radio') return el.checked ? el.value : undefined
    if (el.type === 'number' || el.inputMode === 'numeric') return clampInt(el.value)
    return el.value
  }
  if (el instanceof HTMLSelectElement) return el.value
  return undefined
}

function readInputs(form: HTMLFormElement): CalcInput {
  const draft = createDefaultPricingInput()
  const store = draft as unknown as Record<string, unknown>
  form.querySelectorAll<HTMLElement>('[data-calc-input]').forEach((el) => {
    const path = el.dataset.calcInput
    if (!path) return
    const value = readElementValue(el)
    if (value === undefined) return // unchecked radio etc.
    setByPath(store, path, value)
  })
  return draft
}

function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let handle: number | undefined
  return (...args: A) => {
    if (handle !== undefined) window.clearTimeout(handle)
    handle = window.setTimeout(() => fn(...args), ms)
  }
}

function init(): void {
  const form = document.getElementById('pricing-calculator-form')
  const panel = document.getElementById('pricing-summary-panel')
  if (!(form instanceof HTMLFormElement) || !panel) return

  const refs = resolveRefs(panel)
  if (!refs) return

  let currentResult: CalcResult | null = null
  const paymentLink = initPaymentLink(panel)

  const recalc = (): void => {
    const input = readInputs(form)
    if (!isPricingInputSane(input)) {
      currentResult = null
      paymentLink?.disable('One or more calculator values is too high.')
      return
    }
    currentResult = calculatePrice(input)
    renderResult(refs, currentResult)
    paymentLink?.sync(input, currentResult)
  }

  const debounced = debounce(recalc, 150)
  const handleFormUpdate = (): void => {
    currentResult = null
    paymentLink?.disable('Quote changed. Recalculating...')
    debounced()
  }
  form.addEventListener('input', handleFormUpdate)
  form.addEventListener('change', handleFormUpdate)
  panel.addEventListener('click', (event) => {
    const trigger = (event.target as Element | null)?.closest('[data-calc-consultation-trigger]')
    if (!trigger || !currentResult) return
    document.dispatchEvent(
      new CustomEvent('calc:open-consultation', {
        detail: {
          breakdownText: formatBreakdown(currentResult),
          showBreakdown: currentResult.hasAnySelection && !currentResult.isEnterprise,
        },
      })
    )
  })

  recalc()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
