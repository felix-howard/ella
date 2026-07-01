import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AgreementConfirmationPanel } from './agreement-confirmation-panel'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, options?: { orgName?: string; documentLabel?: string }) => {
      if (key === 'nda.confirmedMessage') {
        return `${options?.documentLabel ?? ''} signed for ${options?.orgName ?? ''}`
      }
      return key
    },
  }),
}))

vi.mock('@ella/ui', () => ({
  buttonVariants: (options?: { variant?: string }) => `button-${options?.variant ?? 'default'}`,
  cn: (...inputs: Array<string | false | null | undefined>) => inputs.filter(Boolean).join(' '),
}))

const baseProps = {
  signedAt: '2026-06-30T12:00:00.000Z',
  downloadUrl: 'https://portal.test/download/agreement.pdf',
  orgName: 'Ella Tax',
  documentLabel: 'Engagement Letter',
}

describe('AgreementConfirmationPanel', () => {
  it('shows payment continuation when the signing response includes a pay URL', () => {
    const markup = renderToStaticMarkup(
      <AgreementConfirmationPanel
        {...baseProps}
        paymentPortalUrl="https://portal.test/quote/pay_123"
      />,
    )

    expect(markup).toContain('nda.continueToPayment')
    expect(markup).toContain('href="https://portal.test/quote/pay_123"')
    expect(markup).toContain('nda.downloadCopy')
    expect(markup).toContain('href="https://portal.test/download/agreement.pdf"')
    expect(markup).toContain('button-outline')
  })

  it('keeps manual-review and legacy confirmations free of payment CTA', () => {
    const markup = renderToStaticMarkup(<AgreementConfirmationPanel {...baseProps} />)

    expect(markup).not.toContain('nda.continueToPayment')
    expect(markup).toContain('nda.downloadCopy')
    expect(markup).not.toContain('button-outline')
  })
})
