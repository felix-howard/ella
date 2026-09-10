// @vitest-environment happy-dom
import { act, useState, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { calculatePricing, createDefaultPricingInput } from '@ella/shared/pricing'
import type { PricingCalculatorInput } from '@ella/shared/pricing'
import type { PricingQuoteDraftDetail } from '../../../lib/api-client'
import type { PricingQuoteDraftPanel } from '../quote-drafts/pricing-quote-draft-panel'
import { PricingCalculatorPage } from '../pricing-calculator-page'

const state = vi.hoisted(() => ({
  draft: null as PricingQuoteDraftDetail | null,
  panel: null as ComponentProps<typeof PricingQuoteDraftPanel> | null,
  createCheckout: vi.fn(),
  deleteDraft: vi.fn(),
  autosaveSaveNow: vi.fn(),
  autosavePause: vi.fn(),
  autosaveResume: vi.fn(),
  autosaveReset: vi.fn(),
  sendQuote: vi.fn(),
  orgId: 'org-test',
}))
vi.mock('@clerk/clerk-react', () => ({ useAuth: () => ({ orgId: state.orgId }) }))
vi.mock('../../../lib/api-client', () => ({ api: { billing: { createCheckoutSession: state.createCheckout, deletePricingQuoteDraft: state.deleteDraft, getPricingQuoteDraft: vi.fn() } } }))
vi.mock('../../../stores/toast-store', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))
vi.mock('../quote-drafts/pricing-quote-draft-panel', () => ({
  PricingQuoteDraftPanel: (props: ComponentProps<typeof PricingQuoteDraftPanel>) => {
    state.panel = props
    return <div>Draft controls<button onClick={() => props.onLoad(state.draft!)}>Load fixture</button><button onClick={props.onNewQuote}>New fixture</button><button onClick={() => props.onDeleted(state.draft!.id)}>Delete fixture</button></div>
  },
}))
vi.mock('../quote-drafts/use-pricing-quote-draft-autosave', () => ({
  usePricingQuoteDraftAutosave: () => ({ state: 'saved', saveNow: state.autosaveSaveNow, pause: state.autosavePause, resume: state.autosaveResume, resetSavedBaseline: state.autosaveReset }),
}))
vi.mock('../pricing-calculator-form', () => ({
  PricingCalculatorForm: ({ input, disabled, onInputChange }: { input: PricingCalculatorInput; disabled: boolean; onInputChange: (input: PricingCalculatorInput) => void }) => <><output data-testid="input">{JSON.stringify(input)}</output><button disabled={disabled} onClick={() => onInputChange({ ...input, nec1099Count: input.nec1099Count + 1 })}>Edit quote</button></>,
}))
vi.mock('../pricing-summary-panel', () => ({ PricingSummaryPanel: ({ result }: { result: ReturnType<typeof calculatePricing> }) => <output data-testid="total">{result.monthlyTotal + result.setupTotal}</output> }))
vi.mock('../pricing-engagement-letter-panel', () => ({ PricingEngagementLetterPanel: () => null }))
vi.mock('../pricing-print-panel', () => ({ PricingPrintPanel: () => null }))
vi.mock('../custom-link/custom-link-builder', () => ({ CustomLinkBuilder: () => <div>Custom builder</div> }))
vi.mock('../pricing-payment-link-panel', () => ({
  PricingPaymentLinkPanel: ({ checkout, onCreate }: { checkout: { url: string } | null; onCreate: () => Promise<void> }) => <><button onClick={() => { void onCreate().catch(() => undefined) }}>Create test link</button><output data-testid="checkout">{checkout?.url}</output></>,
}))
vi.mock('../pricing-send-quote-panel', () => ({
  PricingSendQuotePanel: ({ onPendingChange }: { onPendingChange?: (pending: boolean) => void }) => {
    const [sent, setSent] = useState(false)
    const send = async () => {
      onPendingChange?.(true)
      try {
        await state.sendQuote()
        setSent(true)
      } finally {
        onPendingChange?.(false)
      }
    }
    return <><button onClick={() => { void send() }}>Send test quote</button>{sent && <span>Old sent result</span>}</>
  },
}))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: ReturnType<typeof createRoot>
let client: QueryClient
let container: HTMLDivElement
async function click(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((node) => node.textContent === label)
  expect(button, label).toBeDefined()
  await act(async () => { button!.click() })
}
function currentInput() { return JSON.parse(container.querySelector('[data-testid="input"]')!.textContent!) }

beforeEach(async () => {
  vi.clearAllMocks()
  state.orgId = 'org-test'
  const input = createDefaultPricingInput()
  input.nec1099Count = 14
  input.payrollEmployees = 7
  input.payrollMode = 'ella-staff'
  input.cashPlan = { enabled: true, employees: 3, owners: 2 }
  input.auditProtection = true
  input.salesTaxShops = 4
  input.oneTime = { startLlc: 1, holdingLlcNew: 2, holdingLlcModify: 3, personalTaxReturn: 4, businessTaxReturn: 5 }
  input.customItems = [{ id: 'custom-month', label: 'Monthly advisory', amount: 41, quantity: 2, billingInterval: 'month' }, { id: 'custom-once', label: 'Cleanup', amount: 72, quantity: 3, billingInterval: 'one_time' }]
  // Give every rate a distinct nondefault value to detect partial restoration.
  for (const [key, value] of Object.entries(input.rates)) {
    if (typeof value === 'number') input.rates[key as 'salesTaxMonitoringMonthly'] = value + 11
    else for (const field of Object.keys(value)) (value as Record<string, number>)[field] += 11
  }
  state.draft = { id: 'draft-1', name: 'Complete quote', pricingInput: input, monthlyTotalCents: 10000, setupTotalCents: 5000, createdAt: '2026-09-08T10:00:00.000Z', updatedAt: '2026-09-08T10:00:00.000Z' }
  state.createCheckout.mockResolvedValue({ url: 'https://checkout.example/old' })
  state.deleteDraft.mockResolvedValue({ id: 'draft-1', deleted: true })
  state.autosaveSaveNow.mockResolvedValue('2026-09-08T10:00:00.000Z')
  state.sendQuote.mockResolvedValue(undefined)
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => { root.render(<QueryClientProvider client={client}><PricingCalculatorPage /></QueryClientProvider>) })
})
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove() })

describe('Calculator draft page integration', () => {
  it('restores every canonical input field and total, then establishes an unchanged baseline', async () => {
    await click('Load fixture')
    expect(currentInput()).toEqual(state.draft!.pricingInput)
    const total = calculatePricing(state.draft!.pricingInput)
    expect(container.querySelector('[data-testid="total"]')!.textContent).toBe(String(total.monthlyTotal + total.setupTotal))
    expect(state.panel!.activeDraft).toEqual({ id: state.draft!.id, name: state.draft!.name, updatedAt: state.draft!.updatedAt })
    expect(state.panel!.hasUnsavedChanges).toBe(false)
    await click('Edit quote')
    expect(state.panel!.hasUnsavedChanges).toBe(true)
  })

  it('clears prior checkout and send results even when reloading the identical input', async () => {
    await click('Load fixture')
    await click('Create test link')
    await click('Send test quote')
    expect(container.textContent).toContain('https://checkout.example/old')
    expect(container.textContent).toContain('Old sent result')
    await click('Load fixture')
    expect(container.textContent).not.toContain('https://checkout.example/old')
    expect(container.textContent).not.toContain('Old sent result')
  })

  it('preserves values when deleting active draft and clears them on New quote', async () => {
    await click('Load fixture')
    await click('Delete fixture')
    expect(state.panel!.activeDraft).toBeNull()
    expect(currentInput()).toEqual(state.draft!.pricingInput)
    expect(state.panel!.hasUnsavedChanges).toBe(true)
    await click('New fixture')
    expect(currentInput()).toEqual(createDefaultPricingInput())
    expect(state.panel!.activeDraft).toBeNull()
    expect(state.panel!.hasUnsavedChanges).toBe(false)
  })

  it('resets current values and active draft when the authenticated organization changes', async () => {
    await click('Load fixture')
    await click('Send test quote')
    state.orgId = 'another-org'
    await act(async () => { root.render(<QueryClientProvider client={client}><PricingCalculatorPage /></QueryClientProvider>) })
    expect(currentInput()).toEqual(createDefaultPricingInput())
    expect(state.panel!.activeDraft).toBeNull()
    expect(container.textContent).not.toContain('Old sent result')
  })

  it('hides draft controls in Custom link mode and retains Calculator work when returning', async () => {
    await click('Load fixture')
    await click('Custom link')
    expect(container.textContent).toContain('Custom builder')
    expect(container.textContent).not.toContain('Draft controls')
    await click('Calculator')
    expect(currentInput()).toEqual(state.draft!.pricingInput)
  })

  it('flushes the latest active draft before checkout and clears it after success', async () => {
    state.createCheckout.mockResolvedValue({
      url: 'https://checkout.example/new',
      draftConsumed: true,
    })
    await click('Load fixture')
    await click('Edit quote')
    await click('Create test link')

    expect(state.autosavePause).toHaveBeenCalled()
    expect(state.autosaveSaveNow).toHaveBeenCalled()
    expect(state.createCheckout).toHaveBeenCalledWith({
      pricingInput: currentInput(),
      draftId: 'draft-1',
      draftUpdatedAt: '2026-09-08T10:00:00.000Z',
    })
    expect(state.autosaveSaveNow.mock.invocationCallOrder[0]).toBeLessThan(
      state.createCheckout.mock.invocationCallOrder[0]
    )
    expect(state.panel!.activeDraft).toBeNull()
    expect(state.deleteDraft).not.toHaveBeenCalled()
  })

  it('retries only draft deletion when server cleanup fails after checkout success', async () => {
    state.createCheckout.mockResolvedValue({
      url: 'https://checkout.example/new',
      draftConsumed: false,
      draftCleanupStatus: 'failed',
    })
    await click('Load fixture')
    await click('Create test link')

    expect(state.createCheckout).toHaveBeenCalledTimes(1)
    expect(state.deleteDraft).toHaveBeenCalledWith(
      'draft-1',
      '2026-09-08T10:00:00.000Z'
    )
    expect(state.panel!.activeDraft).toBeNull()
  })

  it('preserves a newer conflicting draft without retrying an unversioned delete', async () => {
    state.createCheckout.mockResolvedValue({
      url: 'https://checkout.example/new',
      draftConsumed: false,
      draftCleanupStatus: 'version_conflict',
    })
    await click('Load fixture')
    await click('Create test link')

    expect(state.createCheckout).toHaveBeenCalledTimes(1)
    expect(state.deleteDraft).not.toHaveBeenCalled()
    expect(state.panel!.activeDraft).toBeNull()
  })

  it('retains the active draft and resumes autosave when checkout fails after flushing', async () => {
    state.createCheckout.mockRejectedValue(new Error('provider failed'))
    await click('Load fixture')
    await click('Edit quote')
    await click('Create test link')

    expect(state.autosavePause).toHaveBeenCalled()
    expect(state.autosaveSaveNow).toHaveBeenCalled()
    expect(state.createCheckout).toHaveBeenCalledTimes(1)
    expect(state.panel!.activeDraft).toEqual({
      id: state.draft!.id,
      name: state.draft!.name,
      updatedAt: state.draft!.updatedAt,
    })
    expect(state.autosaveResume).toHaveBeenCalled()
    expect(state.deleteDraft).not.toHaveBeenCalled()
  })

  it('prevents calculator edits until a pending send resolves', async () => {
    const pending = deferred<void>()
    state.sendQuote.mockReturnValue(pending.promise)
    await click('Load fixture')
    const beforeSend = currentInput()

    await click('Send test quote')
    const editButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Edit quote'
    )!
    expect(editButton.disabled).toBe(true)
    await click('Edit quote')
    expect(currentInput()).toEqual(beforeSend)

    await act(async () => {
      pending.resolve()
      await pending.promise
    })
    expect(editButton.disabled).toBe(false)
    await click('Edit quote')
    expect(currentInput()).not.toEqual(beforeSend)
  })
})

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}
