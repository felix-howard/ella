import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { StaffPaymentInfoSummary } from '../../../lib/api-client'
import { StaffDocumentsTab } from '../staff-documents-tab'
import { StaffPaymentInfoCard } from '../staff-payment-info-card'
import { getDefaultPaymentCountry } from '../staff-payment-info-utils'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      if (key === 'profile.paymentInfo.countryAccount') return `${values?.country} payout account`
      return key
    },
  }),
}))

vi.mock('../../../stores/toast-store', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../staff-file-upload-button', () => ({
  StaffFileUploadButton: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}))

vi.mock('../staff-file-list', () => ({
  StaffFileList: () => <div>staff-file-list</div>,
}))

vi.mock('../staff-file-viewer', () => ({
  StaffFileViewer: () => null,
}))

vi.mock('../upload-links/upload-link-confirm-modal', () => ({
  UploadLinkConfirmModal: () => null,
}))

function paymentInfo(overrides: Partial<StaffPaymentInfoSummary> = {}): StaffPaymentInfoSummary {
  return {
    country: 'PH',
    nameOnAccount: 'Mila Santos',
    bankName: 'BDO',
    accountNumberLast4: '6275',
    routingNumberLast4: null,
    updatedAt: '2026-06-15T00:00:00.000Z',
    ...overrides,
  }
}

function renderWithQueryClient(node: ReactElement) {
  const queryClient = new QueryClient()
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      {node}
    </QueryClientProvider>
  )
}

describe('staff payment info', () => {
  it('defaults to PH when PH is the only saved payment info', () => {
    const markup = renderWithQueryClient(
      <StaffPaymentInfoCard staffId="staff-1" paymentInfos={[paymentInfo()]} canEdit />
    )

    expect(getDefaultPaymentCountry([paymentInfo()])).toBe('PH')
    expect(markup).toContain('Philippines payout account')
    expect(markup).toContain('Saved ending in 6275')
    expect(markup).not.toContain('profile.paymentInfo.routingNumber')
  })

  it('defaults to US when no payment info exists', () => {
    const markup = renderWithQueryClient(
      <StaffPaymentInfoCard staffId="staff-1" paymentInfos={[]} canEdit />
    )

    expect(getDefaultPaymentCountry([])).toBe('US')
    expect(markup).toContain('United States payout account')
    expect(markup).toContain('profile.paymentInfo.emptyCountry')
    expect(markup).toContain('profile.paymentInfo.add')
    expect(markup).not.toContain('profile.paymentInfo.save')
  })

  it('renders VN and PH without routing fields', () => {
    const markup = renderWithQueryClient(
      <StaffPaymentInfoCard staffId="staff-1" paymentInfos={[paymentInfo({ country: 'VN', bankName: 'VCB' })]} canEdit />
    )

    expect(markup).toContain('Vietnam payout account')
    expect(markup).not.toContain('profile.paymentInfo.routingNumber')
  })

  it('keeps the personal documents list below payment info', () => {
    const markup = renderWithQueryClient(
      <StaffDocumentsTab staffId="staff-1" paymentInfos={[paymentInfo()]} canEdit />
    )

    expect(markup.indexOf('profile.paymentInfo.title')).toBeLessThan(markup.indexOf('staff-file-list'))
    expect(markup).toContain('profile.staffFiles.addDocument')
  })
})
