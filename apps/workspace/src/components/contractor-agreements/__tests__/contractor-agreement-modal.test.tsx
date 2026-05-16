import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ContractorAgreementModal } from '../contractor-agreement-modal'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, vars?: Record<string, string>) =>
      vars?.name ? fallback.replace('{{name}}', vars.name) : fallback,
  }),
}))

vi.mock('../use-contractor-agreements', () => ({
  useAcceptContractorAgreement: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}))

vi.mock('../../terms/signature-pad', () => ({
  SignaturePad: () => <div data-testid="signature-pad" />,
}))

vi.mock('../../../stores/toast-store', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe('ContractorAgreementModal', () => {
  it('renders the full contractor agreement text before the signature form', () => {
    const markup = renderToStaticMarkup(
      <ContractorAgreementModal
        staffName="Amber Tran"
        version="2026.05.15"
        onStatusRefresh={vi.fn()}
      />
    )

    expect(markup).toContain('Independent Contractor Agreement for Obamacare Contractor Agents')
    expect(markup).toContain('1. Purpose of Agreement')
    expect(markup).toContain('29. Acknowledgment')
    expect(markup).toContain('Review the agreement before signing.')
    expect(markup).toContain('Your Signature')

    const signButtonTag = markup.match(/<button[^>]*>/)
    expect(signButtonTag?.[0]).not.toMatch(/\sdisabled(=|>|\s)/)
  })
})
