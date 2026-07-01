import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgreementPaymentPortalSendMode } from '../../../lib/api-client'
import { CalculatorPaymentAfterSignatureCard } from '../calculator-payment-after-signature-card'

interface CapturedModeControlProps {
  value: AgreementPaymentPortalSendMode
  disabled?: boolean
  onChange: (value: AgreementPaymentPortalSendMode) => void
}

const mocks = vi.hoisted(() => ({
  canManageOrganizationSettings: true,
  isPending: false,
  setQueryData: vi.fn(),
  update: vi.fn((data: { calculatorAgreementPaymentMode: AgreementPaymentPortalSendMode }) => ({
    name: 'Ella Tax',
    calculatorAgreementPaymentMode: data.calculatorAgreementPaymentMode,
  })),
  controls: [] as CapturedModeControlProps[],
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: mocks.setQueryData,
  }),
  useQuery: () => ({
    isLoading: false,
    isError: false,
    data: {
      name: 'Ella Tax',
      calculatorAgreementPaymentMode: 'AUTO_SEND',
    },
  }),
  useMutation: (options: {
    mutationFn: (mode: AgreementPaymentPortalSendMode) => unknown
    onSuccess: (result: unknown) => void
  }) => ({
    isPending: mocks.isPending,
    mutate: (mode: AgreementPaymentPortalSendMode) => {
      const result = options.mutationFn(mode)
      options.onSuccess(result)
    },
  }),
}))

vi.mock('../../../hooks/use-org-role', () => ({
  useOrgRole: () => ({
    canManageOrganizationSettings: mocks.canManageOrganizationSettings,
  }),
}))

vi.mock('../../../lib/api-client', () => ({
  api: {
    orgSettings: {
      get: vi.fn(),
      update: mocks.update,
    },
  },
}))

vi.mock('../../../stores/toast-store', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../agreements/calculator-payment-mode-control', () => ({
  CalculatorPaymentModeControl: (props: CapturedModeControlProps) => {
    mocks.controls.push(props)
    return <div>calculator-payment-mode-control</div>
  },
}))

describe('CalculatorPaymentAfterSignatureCard', () => {
  beforeEach(() => {
    mocks.canManageOrganizationSettings = true
    mocks.isPending = false
    mocks.controls = []
    mocks.setQueryData.mockClear()
    mocks.update.mockClear()
  })

  it('updates the org default payment mode and refreshes org-settings cache', () => {
    renderToStaticMarkup(<CalculatorPaymentAfterSignatureCard />)

    expect(mocks.controls[0]).toMatchObject({
      value: 'AUTO_SEND',
      disabled: false,
    })

    mocks.controls[0].onChange('STAFF_REVIEW')

    expect(mocks.update).toHaveBeenCalledWith({
      calculatorAgreementPaymentMode: 'STAFF_REVIEW',
    })
    expect(mocks.setQueryData).toHaveBeenCalledWith(
      ['org-settings'],
      expect.objectContaining({ calculatorAgreementPaymentMode: 'STAFF_REVIEW' }),
    )
  })

  it('disables the mode control while the setting update is pending', () => {
    mocks.isPending = true

    renderToStaticMarkup(<CalculatorPaymentAfterSignatureCard />)

    expect(mocks.controls[0]).toMatchObject({ disabled: true })
  })
})
