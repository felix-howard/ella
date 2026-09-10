// @vitest-environment happy-dom
import { act, StrictMode, useEffect, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultPricingInput } from '@ella/shared/pricing'
import {
  usePricingQuoteDraftAutosave,
  type PricingQuoteDraftAutosaveState,
} from '../use-pricing-quote-draft-autosave'

const mocks = vi.hoisted(() => ({ update: vi.fn() }))

vi.mock('@clerk/clerk-react', () => ({ useAuth: () => ({ orgId: 'org_1' }) }))
vi.mock('../../../../lib/api-client', () => {
  class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message)
    }
  }
  return {
    ApiError,
    api: { billing: { updatePricingQuoteDraft: mocks.update } },
  }
})

type HookProps = ComponentProps<typeof Harness>
type HookResult = ReturnType<typeof usePricingQuoteDraftAutosave>

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let queryClient: QueryClient
let current: HookResult
let props: HookProps
let rootMounted: boolean
let strictMode: boolean

function Harness(nextProps: Parameters<typeof usePricingQuoteDraftAutosave>[0]) {
  const result = usePricingQuoteDraftAutosave(nextProps)
  useEffect(() => {
    current = result
  }, [result])
  return <span>{result.state}</span>
}

function detail(pricingInput = props.pricingInput, updatedAt = '2026-09-08T10:00:01.000Z') {
  return {
    id: 'draft_1',
    name: 'Draft',
    pricingInput,
    monthlyTotalCents: 0,
    setupTotalCents: 0,
    createdAt: '2026-09-08T10:00:00.000Z',
    updatedAt,
  }
}

async function render(overrides: Partial<HookProps> = {}) {
  props = { ...props, ...overrides }
  const harness = <Harness {...props} />
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        {strictMode ? <StrictMode>{harness}</StrictMode> : harness}
      </QueryClientProvider>
    )
  })
}

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds)
  })
}

async function unmountRoot() {
  if (!rootMounted) return
  await act(async () => root.unmount())
  rootMounted = false
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  rootMounted = true
  strictMode = false
  props = {
    draftId: 'draft_1',
    pricingInput: createDefaultPricingInput(),
    updatedAt: '2026-09-08T10:00:00.000Z',
    enabled: true,
    onSaved: vi.fn(),
    onConflict: vi.fn(),
  }
  mocks.update.mockImplementation(async (_id, payload) =>
    detail(payload.pricingInput, '2026-09-08T10:00:01.000Z')
  )
  await render()
})

afterEach(async () => {
  await unmountRoot()
  queryClient.clear()
  container.remove()
  vi.useRealTimers()
})

describe('pricing quote draft autosave', () => {
  it('waits for one idle second, then saves with the current concurrency token', async () => {
    const changed = { ...props.pricingInput, nec1099Count: 3 }
    await render({ pricingInput: changed })

    expect(current.state).toBe<PricingQuoteDraftAutosaveState>('unsaved')
    await advance(999)
    expect(mocks.update).not.toHaveBeenCalled()
    await advance(1)

    expect(mocks.update).toHaveBeenCalledWith('draft_1', {
      pricingInput: changed,
      expectedUpdatedAt: '2026-09-08T10:00:00.000Z',
    })
    expect(current.state).toBe('saved')
  })

  it('serializes a newer save behind an in-flight request and chains exact updatedAt values', async () => {
    const first = deferred<ReturnType<typeof detail>>()
    const second = deferred<ReturnType<typeof detail>>()
    mocks.update.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const editOne = { ...props.pricingInput, nec1099Count: 1 }
    await render({ pricingInput: editOne })
    await advance(1000)

    const editTwo = { ...editOne, nec1099Count: 2 }
    await render({ pricingInput: editTwo })
    let flush!: Promise<string>
    await act(async () => {
      flush = current.saveNow()
    })
    expect(mocks.update).toHaveBeenCalledTimes(1)

    await act(async () => {
      first.resolve(detail(editOne, '2026-09-08T10:00:01.000Z'))
      await first.promise
    })
    expect(mocks.update).toHaveBeenNthCalledWith(2, 'draft_1', {
      pricingInput: editTwo,
      expectedUpdatedAt: '2026-09-08T10:00:01.000Z',
    })

    await act(async () => {
      second.resolve(detail(editTwo, '2026-09-08T10:00:02.000Z'))
      await flush
    })
    expect(current.state).toBe('saved')
  })

  it('stops on conflict until the draft is reloaded', async () => {
    const { ApiError } = await import('../../../../lib/api-client')
    mocks.update.mockRejectedValue(
      new ApiError(409, 'PRICING_QUOTE_DRAFT_CONFLICT', 'Changed elsewhere')
    )
    await render({ pricingInput: { ...props.pricingInput, payrollEmployees: 4 } })
    await advance(1000)

    expect(current.state).toBe('conflict')
    expect(props.onConflict).toHaveBeenCalledTimes(1)
    await advance(5000)
    expect(mocks.update).toHaveBeenCalledTimes(1)
    await expect(current.saveNow()).rejects.toThrow('changed elsewhere')
  })

  it('keeps failed edits and retries only when requested', async () => {
    mocks.update.mockRejectedValueOnce(new Error('offline'))
    const changed = { ...props.pricingInput, salesTaxShops: 2 }
    await render({ pricingInput: changed })
    await advance(1000)
    expect(current.state).toBe('failed')

    mocks.update.mockResolvedValue(detail(changed))
    await act(async () => {
      await current.saveNow()
    })
    expect(mocks.update).toHaveBeenCalledTimes(2)
    expect(current.state).toBe('saved')
  })

  it('does not queue newer work or invoke callbacks after unmounting during a save', async () => {
    const pending = deferred<ReturnType<typeof detail>>()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    mocks.update.mockReturnValue(pending.promise)
    const editOne = { ...props.pricingInput, nec1099Count: 1 }
    await render({ pricingInput: editOne })
    await advance(1000)

    await render({ pricingInput: { ...editOne, nec1099Count: 2 } })
    expect(mocks.update).toHaveBeenCalledTimes(1)
    await unmountRoot()

    pending.resolve(detail(editOne, '2026-09-08T10:00:01.000Z'))
    await pending.promise
    await Promise.resolve()

    expect(mocks.update).toHaveBeenCalledTimes(1)
    expect(props.onSaved).not.toHaveBeenCalled()
    expect(props.onConflict).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('completes callbacks and a queued newer save after StrictMode effect replay', async () => {
    await unmountRoot()
    root = createRoot(container)
    rootMounted = true
    strictMode = true
    await render()

    const first = deferred<ReturnType<typeof detail>>()
    const second = deferred<ReturnType<typeof detail>>()
    mocks.update.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const editOne = { ...props.pricingInput, payrollEmployees: 1 }
    await render({ pricingInput: editOne })
    await advance(1000)

    const editTwo = { ...editOne, payrollEmployees: 2 }
    await render({ pricingInput: editTwo })
    let flush!: Promise<string>
    await act(async () => {
      flush = current.saveNow()
    })

    await act(async () => {
      first.resolve(detail(editOne, '2026-09-08T10:00:01.000Z'))
      await first.promise
    })
    expect(props.onSaved).toHaveBeenCalledTimes(1)
    expect(mocks.update).toHaveBeenNthCalledWith(2, 'draft_1', {
      pricingInput: editTwo,
      expectedUpdatedAt: '2026-09-08T10:00:01.000Z',
    })

    await act(async () => {
      second.resolve(detail(editTwo, '2026-09-08T10:00:02.000Z'))
      await flush
    })
    expect(props.onSaved).toHaveBeenCalledTimes(2)
    expect(current.state).toBe('saved')
  })
})
