// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import type * as EllaUi from '@ella/ui'
import { createDefaultPricingInput } from '@ella/shared/pricing'
import { PricingSendQuotePanel } from '../pricing-send-quote-panel'

const mocks = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('../../../lib/api-client', () => ({ api: { billing: { sendQuote: mocks.send } } }))
vi.mock('../../../stores/toast-store', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))
vi.mock('../../../lib/clipboard', () => ({ copyToClipboard: vi.fn() }))
vi.mock('../use-recipient-search', () => ({ useRecipientSearch: () => ({ items: [], loading: false }), decodeRecipientId: () => ({ type: 'client', id: 'client-1' }) }))
vi.mock('@ella/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof EllaUi>()
  return { ...actual, Combobox: ({ onSelect }: { onSelect: (item: { id: string; label: string }) => void }) => <button onClick={() => onSelect({ id: 'client:client-1', label: 'Test client' })}>Select test client</button> }
})
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it('keeps the recipient selected and pending replacement lock until send resolves', async () => {
  let resolveSend!: (response: unknown) => void
  mocks.send.mockReturnValue(new Promise((resolve) => { resolveSend = resolve }))
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  const onPendingChange = vi.fn()
  const click = async (label: string) => { await act(async () => { Array.from(container.querySelectorAll('button')).find((node) => node.textContent === label)!.click() }); await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)) }) }
  try {
    await act(async () => { root.render(<QueryClientProvider client={client}><PricingSendQuotePanel pricingInput={createDefaultPricingInput()} disabledReason={null} onPendingChange={onPendingChange} /></QueryClientProvider>) })
    await click('Select test client'); await click('Send Payment Link')
    const clear = container.querySelector<HTMLButtonElement>('[aria-label="Clear selected recipient"]')!
    expect(clear.disabled).toBe(true)
    await act(async () => { clear.click() })
    expect(container.textContent).toContain('Test client')
    expect(onPendingChange).toHaveBeenLastCalledWith(true)
    await act(async () => { resolveSend({ quoteId: 'quote-1', payUrl: 'https://example.test/pay', smsSent: true }); await new Promise((resolve) => setTimeout(resolve, 15)) })
    expect(onPendingChange).toHaveBeenLastCalledWith(false)
    expect(clear.disabled).toBe(false)
    expect(container.textContent).toContain('Sent — quote quote-1')
  } finally {
    await act(async () => root.unmount()); client.clear(); container.remove()
  }
})

it('flushes before send, includes the draft id, and reports durable success', async () => {
  const events: string[] = []
  mocks.send.mockImplementation(async () => {
    events.push('send')
    return { quoteId: 'quote-1', payUrl: 'https://example.test/pay', smsSent: false }
  })
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  const onSendSuccess = vi.fn(async () => { events.push('success') })
  const beforeSend = vi.fn(async () => {
    events.push('flush')
    return '2026-09-08T10:00:00.000Z'
  })
  try {
    await act(async () => { root.render(<QueryClientProvider client={client}><PricingSendQuotePanel pricingInput={createDefaultPricingInput()} draftId="draft-1" disabledReason={null} beforeSend={beforeSend} onSendSuccess={onSendSuccess} /></QueryClientProvider>) })
    const click = async (label: string) => { await act(async () => { Array.from(container.querySelectorAll('button')).find((node) => node.textContent === label)!.click() }); await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)) }) }
    await click('Select test client'); await click('Send Payment Link')

    expect(events).toEqual(['flush', 'send', 'success'])
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      draftId: 'draft-1',
      draftUpdatedAt: '2026-09-08T10:00:00.000Z',
    }))
    expect(onSendSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ quoteId: 'quote-1' }),
      '2026-09-08T10:00:00.000Z'
    )
  } finally {
    await act(async () => root.unmount()); client.clear(); container.remove()
  }
})
