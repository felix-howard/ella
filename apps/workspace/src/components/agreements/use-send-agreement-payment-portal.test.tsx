import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSendAgreementPaymentPortal } from './use-send-agreement-payment-portal'
import type { EntityRef } from './types'

const mocks = vi.hoisted(() => ({
  clientSendPaymentPortal: vi.fn(),
  invalidateQueries: vi.fn(),
  leadSendPaymentPortal: vi.fn(),
  mutationOptions: undefined as unknown,
  toastError: vi.fn(),
  toastInfo: vi.fn(),
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
        sendPaymentPortal: mocks.clientSendPaymentPortal,
      },
    },
    leads: {
      agreements: {
        sendPaymentPortal: mocks.leadSendPaymentPortal,
      },
    },
  },
}))

vi.mock('../../stores/toast-store', () => ({
  toast: {
    error: mocks.toastError,
    info: mocks.toastInfo,
    success: mocks.toastSuccess,
  },
}))

interface CapturedMutationOptions {
  mutationFn: (agreementId: string) => Promise<unknown>
  onError: (error: Error) => void
  onSuccess: (result: {
    quoteId: string
    payUrl: string
    smsSent: boolean
    smsSkippedReason?: 'no_phone' | 'send_failed' | 'already_sent'
  }) => void
}

function HookProbe({ entity }: { entity: EntityRef }) {
  useSendAgreementPaymentPortal(entity)
  return null
}

function renderHookProbe(entity: EntityRef): CapturedMutationOptions {
  renderToStaticMarkup(<HookProbe entity={entity} />)
  return mocks.mutationOptions as CapturedMutationOptions
}

describe('useSendAgreementPaymentPortal', () => {
  beforeEach(() => {
    mocks.clientSendPaymentPortal.mockReset()
    mocks.invalidateQueries.mockReset()
    mocks.leadSendPaymentPortal.mockReset()
    mocks.mutationOptions = undefined
    mocks.toastError.mockReset()
    mocks.toastInfo.mockReset()
    mocks.toastSuccess.mockReset()
  })

  it('posts the client send request and invalidates agreement plus payment caches', async () => {
    const options = renderHookProbe({ type: 'client', id: 'client_1' })
    mocks.clientSendPaymentPortal.mockResolvedValue({
      quoteId: 'quote_1',
      payUrl: 'https://portal.test/quote/tok_pay',
      smsSent: true,
    })

    await options.mutationFn('agreement_1')
    options.onSuccess({
      quoteId: 'quote_1',
      payUrl: 'https://portal.test/quote/tok_pay',
      smsSent: true,
    })

    expect(mocks.clientSendPaymentPortal).toHaveBeenCalledWith('client_1', 'agreement_1')
    expect(mocks.toastSuccess).toHaveBeenCalledWith('agreements.paymentPortal.sent')
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['nda', 'client', 'client_1', 'list'],
    })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['client', 'client_1'],
    })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['messages'] })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['client-payments', 'client_1'],
    })
  })

  it('posts the lead send request and keeps client payment caches conservatively fresh', async () => {
    const options = renderHookProbe({ type: 'lead', id: 'lead_1' })
    mocks.leadSendPaymentPortal.mockResolvedValue({
      quoteId: 'quote_1',
      payUrl: 'https://portal.test/quote/tok_pay',
      smsSent: false,
      smsSkippedReason: 'already_sent',
    })

    await options.mutationFn('agreement_1')
    options.onSuccess({
      quoteId: 'quote_1',
      payUrl: 'https://portal.test/quote/tok_pay',
      smsSent: false,
      smsSkippedReason: 'already_sent',
    })

    expect(mocks.leadSendPaymentPortal).toHaveBeenCalledWith('lead_1', 'agreement_1')
    expect(mocks.toastInfo).toHaveBeenCalledWith('agreements.paymentPortal.alreadySent')
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
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['client-payments'] })
  })

  it('surfaces API errors through the payment portal toast', () => {
    const options = renderHookProbe({ type: 'client', id: 'client_1' })

    options.onError(new Error('Agreement payment portal is not pending staff review'))

    expect(mocks.toastError).toHaveBeenCalledWith(
      'Agreement payment portal is not pending staff review',
    )
  })
})
