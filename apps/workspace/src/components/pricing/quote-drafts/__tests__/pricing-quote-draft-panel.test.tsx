// @vitest-environment happy-dom
import { act, useState, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultPricingInput } from '@ella/shared/pricing'
import { PricingQuoteDraftPanel } from '../pricing-quote-draft-panel'

const mocks = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }))
vi.mock('@clerk/clerk-react', () => ({ useAuth: () => ({ orgId: 'org-test' }) }))
vi.mock('../../../../lib/api-client', () => ({ api: { billing: { listPricingQuoteDrafts: mocks.list, getPricingQuoteDraft: mocks.get, createPricingQuoteDraft: mocks.create, updatePricingQuoteDraft: mocks.update, deletePricingQuoteDraft: mocks.remove } } }))
vi.mock('../../../../stores/toast-store', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const input = createDefaultPricingInput()
input.nec1099Count = 3
const draft = { id: 'draft-1', name: 'Monthly quote', monthlyTotalCents: 8500, setupTotalCents: 35000, createdAt: '2026-09-08T10:00:00.000Z', updatedAt: '2026-09-08T10:00:00.000Z', pricingInput: input }
let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
let client: QueryClient
let props: ComponentProps<typeof PricingQuoteDraftPanel>
async function settle() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)) }) }
async function render(overrides: Partial<typeof props> = {}) {
  props = { ...props, ...overrides }
  await act(async () => { root.render(<QueryClientProvider client={client}><PricingQuoteDraftPanel {...props} /></QueryClientProvider>) })
  await settle()
}
function button(label: string) {
  const matches = Array.from(document.querySelectorAll('button')).filter((node) => node.textContent === label)
  expect(matches.length, label).toBeGreaterThan(0)
  return matches[matches.length - 1]
}
async function click(label: string) { await act(async () => { button(label).click() }); await settle() }
async function choose() {
  await act(async () => {
    const select = document.querySelector('select')!
    select.value = draft.id
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await settle()
}
async function name(value: string) {
  await act(async () => {
    const field = document.querySelector('input')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function submit() { await act(async () => { document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await settle() }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.list.mockResolvedValue({ drafts: [draft] })
  mocks.get.mockResolvedValue(draft)
  mocks.create.mockResolvedValue(draft)
  mocks.update.mockResolvedValue({ ...draft, name: 'Renamed' })
  mocks.remove.mockResolvedValue({ id: draft.id, deleted: true })
  props = { input, activeDraft: null, hasUnsavedChanges: false, autosaveState: 'idle', onSaved: vi.fn(), onLoad: vi.fn(), onRenamed: vi.fn(), onDeleted: vi.fn(), onNewQuote: vi.fn(), onRetryAutosave: vi.fn(), onReloadActiveDraft: vi.fn() }
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove() })

describe('Pricing quote draft panel', () => {
  it('offers explicit retry and reload recovery for autosave failures', async () => {
    await render({
      activeDraft: draft,
      autosaveState: 'failed',
    })
    await click('Retry')
    expect(props.onRetryAutosave).toHaveBeenCalled()

    await render({ autosaveState: 'conflict' })
    await click('Reload draft')
    expect(props.onReloadActiveDraft).toHaveBeenCalled()
  })

  it('locks draft management during queued autosave without disabling recovery controls', async () => {
    await render({
      activeDraft: draft,
      autosaveState: 'unsaved',
      managementDisabled: true,
    })
    expect(button('New quote').disabled).toBe(true)
    expect(document.querySelector('select')!.disabled).toBe(true)
    expect(button('Rename').disabled).toBe(true)
    expect(button('Delete').disabled).toBe(true)

    await render({ autosaveState: 'failed', managementDisabled: false })
    expect(button('Retry').disabled).toBe(false)
  })


  it('shows an empty list without automatically creating a draft', async () => {
    mocks.list.mockResolvedValue({ drafts: [] })
    await render()
    expect(container.textContent).toContain('No quote drafts saved yet.')
    expect(document.querySelector('select')!.disabled).toBe(true)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('shows totals and update time, then loads the selected draft without a separate action', async () => {
    await render(); await choose()
    expect(container.textContent).toContain('$435 due today')
    expect(container.textContent).toContain('$85/month')
    expect(container.textContent).toContain('Updated')
    expect(mocks.get).toHaveBeenCalledWith(draft.id)
    expect(props.onLoad).toHaveBeenCalledWith(draft)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain('Load draft')
  })
  it('requires explicit nonempty naming and keeps duplicate-name errors in the dialog', async () => {
    await render(); await click('Save draft'); await submit()
    expect(document.body.textContent).toContain('Draft name is required.')
    expect(mocks.create).not.toHaveBeenCalled()
    mocks.create.mockRejectedValueOnce(new Error('A quote draft with this name already exists.'))
    await name(' Monthly quote '); await submit()
    expect(document.body.textContent).toContain('A quote draft with this name already exists.')
    expect(props.onSaved).not.toHaveBeenCalled()
    await name(' New quote '); await submit()
    expect(mocks.create).toHaveBeenLastCalledWith({ name: 'New quote', pricingInput: input })
    expect(props.onSaved).toHaveBeenCalledWith(draft, input)
    expect(document.querySelector('form')).toBeNull()
    expect(mocks.list.mock.calls.length).toBeGreaterThan(1)
  })
  it('refreshes an initially empty list after first save and reports busy until persistence finishes', async () => {
    mocks.list.mockResolvedValue({ drafts: [] })
    let resolveSave!: (value: typeof draft) => void
    mocks.create.mockReturnValue(new Promise((resolve) => { resolveSave = resolve }))
    const onBusyChange = vi.fn()
    await render({ onBusyChange }); await click('Save draft'); await name('Monthly quote'); await submit()
    expect(onBusyChange).toHaveBeenLastCalledWith(true)
    expect(button('New quote').disabled).toBe(true)
    expect(props.onSaved).not.toHaveBeenCalled()
    mocks.list.mockResolvedValue({ drafts: [draft] })
    await act(async () => { resolveSave(draft) }); await settle()
    expect(props.onSaved).toHaveBeenCalledWith(draft, input)
    expect(onBusyChange).toHaveBeenLastCalledWith(false)
    expect(document.querySelector('select')!.value).toBe(draft.id)
    expect(container.textContent).toContain('Monthly quote')
    expect(container.textContent).not.toContain('No quote drafts saved yet.')
  })
  it('requires discard confirmation for load and New quote and preserves work on cancel', async () => {
    await render({ hasUnsavedChanges: true }); await choose()
    expect(document.body.textContent).toContain('Discard unsaved changes?')
    expect(mocks.get).not.toHaveBeenCalled()
    await click('Cancel'); expect(props.onLoad).not.toHaveBeenCalled()
    expect(document.querySelector('select')!.value).toBe('')
    await choose(); await click('Discard and load')
    expect(props.onLoad).toHaveBeenCalledWith(draft)
    await click('New quote'); expect(props.onNewQuote).not.toHaveBeenCalled()
    await click('Cancel'); expect(props.onNewQuote).not.toHaveBeenCalled()
    await click('New quote'); await click('Discard and start new')
    expect(props.onNewQuote).toHaveBeenCalledOnce()
  })
  it('renames with the active revision and no input overwrite', async () => {
    const updatedAt = '2026-09-08T11:00:00.000Z'
    await render({ activeDraft: { ...draft, updatedAt }, hasUnsavedChanges: true }); await click('Rename')
    await name('Renamed'); await submit()
    expect(mocks.update).toHaveBeenCalledWith(draft.id, { name: 'Renamed', expectedUpdatedAt: updatedAt })
    expect(props.onRenamed).toHaveBeenCalledWith({ ...draft, name: 'Renamed' })
    expect(mocks.create).not.toHaveBeenCalled()
    expect(Array.from(container.querySelectorAll('button')).some((node) => /Save draft|Save changes/.test(node.textContent!))).toBe(false)
  })
  it('deletes only after confirmation and keeps a failed delete retryable', async () => {
    await render(); await choose(); await click('Delete')
    expect(mocks.remove).not.toHaveBeenCalled()
    await click('Cancel'); expect(mocks.remove).not.toHaveBeenCalled()
    await click('Delete'); mocks.remove.mockRejectedValueOnce(new Error('Delete unavailable'))
    await click('Delete draft')
    expect(document.body.textContent).toContain('Delete unavailable')
    expect(props.onDeleted).not.toHaveBeenCalled()
    await click('Delete draft')
    expect(props.onDeleted).toHaveBeenCalledWith(draft.id)
  })
  it('returns focus to an enabled panel control after deleting the selected draft', async () => {
    await render(); await choose()
    button('Delete').focus()
    await click('Delete')
    mocks.list.mockResolvedValue({ drafts: [] })
    await click('Delete draft')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).not.toBe(document.body)
    expect(container.contains(document.activeElement)).toBe(true)
    expect((document.activeElement as HTMLButtonElement).disabled).toBe(false)
  })
  it('returns focus to an enabled panel control when first save removes its trigger', async () => {
    function Harness() {
      const [activeDraft, setActiveDraft] = useState<typeof props.activeDraft>(null)
      return <PricingQuoteDraftPanel {...props} activeDraft={activeDraft} onSaved={(detail) => setActiveDraft(detail)} />
    }
    await act(async () => { root.render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>) }); await settle()
    button('Save draft').focus()
    await click('Save draft'); await name('Monthly quote'); await submit()
    expect(document.querySelector('form')).toBeNull()
    expect(document.activeElement).not.toBe(document.body)
    expect(container.contains(document.activeElement)).toBe(true)
    expect((document.activeElement as HTMLButtonElement).disabled).toBe(false)
  })
  it('shows list and load errors without replacing the current input', async () => {
    mocks.list.mockRejectedValueOnce(new Error('Network unavailable'))
    await render(); expect(container.textContent).toContain('Could not load quote drafts.')
    await click('Retry')
    mocks.get.mockRejectedValueOnce(new Error('Draft was deleted'))
    await choose()
    expect(container.textContent).toContain('Draft was deleted')
    expect(props.onLoad).not.toHaveBeenCalled()
    expect(document.querySelector('select')!.value).toBe('')
  })
})
