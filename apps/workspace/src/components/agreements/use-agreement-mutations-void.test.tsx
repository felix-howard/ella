import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useVoidAgreement } from './use-agreement-mutations'
import type { VoidAgreementMutationPayload } from './use-agreement-mutations'
import type { EntityRef } from './types'

const mocks = vi.hoisted(() => ({
  clientVoid: vi.fn(),
  invalidateQueries: vi.fn(),
  leadVoid: vi.fn(),
  mutationOptions: undefined as unknown,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: unknown) => {
    mocks.mutationOptions = options
    return { isPending: false, mutate: vi.fn() }
  },
  useQuery: vi.fn(),
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../../lib/api-client', () => ({
  api: {
    clients: {
      agreements: {
        void: mocks.clientVoid,
      },
    },
    leads: {
      agreements: {
        void: mocks.leadVoid,
      },
    },
  },
}))

vi.mock('../../stores/toast-store', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}))

interface CapturedMutationOptions {
  mutationFn: (payload: VoidAgreementMutationPayload) => Promise<unknown>
  onError: (error: Error) => void
  onSuccess: () => void
}

function HookProbe({ entity }: { entity: EntityRef }) {
  useVoidAgreement(entity)
  return null
}

function renderHookProbe(entity: EntityRef): CapturedMutationOptions {
  renderToStaticMarkup(<HookProbe entity={entity} />)
  return mocks.mutationOptions as CapturedMutationOptions
}

describe('useVoidAgreement', () => {
  beforeEach(() => {
    mocks.clientVoid.mockReset()
    mocks.invalidateQueries.mockReset()
    mocks.leadVoid.mockReset()
    mocks.mutationOptions = undefined
    mocks.toastError.mockReset()
    mocks.toastSuccess.mockReset()
  })

  it('posts the client void request and invalidates related client caches', async () => {
    const options = renderHookProbe({ type: 'client', id: 'client_1' })
    mocks.clientVoid.mockResolvedValue({ success: true, data: { id: 'agreement_1' } })

    await options.mutationFn({ agreementId: 'agreement_1', reason: 'Wrong recipient' })
    options.onSuccess()

    expect(mocks.clientVoid).toHaveBeenCalledWith(
      'client_1',
      'agreement_1',
      { reason: 'Wrong recipient' },
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith('agreements.toast.revoked')
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['nda', 'client', 'client_1', 'list'],
    })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['client', 'client_1'],
    })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['messages'] })
  })

  it('posts the lead void request and invalidates lead/client agreement caches', async () => {
    const options = renderHookProbe({ type: 'lead', id: 'lead_1' })
    mocks.leadVoid.mockResolvedValue({ success: true, data: { id: 'agreement_1' } })

    await options.mutationFn({ agreementId: 'agreement_1', reason: 'Expired engagement' })
    options.onSuccess()

    expect(mocks.leadVoid).toHaveBeenCalledWith(
      'lead_1',
      'agreement_1',
      { reason: 'Expired engagement' },
    )
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['nda', 'lead', 'lead_1', 'list'],
    })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['lead', 'lead_1'],
    })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['messages', 'lead', 'lead_1'],
    })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['nda', 'client'] })
  })

  it('surfaces API errors through the agreement revoke toast', () => {
    const options = renderHookProbe({ type: 'client', id: 'client_1' })

    options.onError(new Error('Already signed'))

    expect(mocks.toastError).toHaveBeenCalledWith('Already signed')
  })
})
