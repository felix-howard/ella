import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AgreementErrorPanel } from './agreement-error-panel'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { documentLabel?: string }) =>
      options?.documentLabel ? `${key}:${options.documentLabel}` : key,
  }),
}))

vi.mock('@ella/ui', () => ({
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

describe('AgreementErrorPanel', () => {
  it('shows revoked copy without retry affordance', () => {
    const markup = renderToStaticMarkup(
      <AgreementErrorPanel code="voided" onRetry={() => undefined} />,
    )

    expect(markup).toContain('nda.error.voided.title')
    expect(markup).toContain('nda.error.voided.message')
    expect(markup).not.toContain('common.tryAgain')
  })

  it('keeps retry affordance for transient errors', () => {
    const markup = renderToStaticMarkup(
      <AgreementErrorPanel code="server" onRetry={() => undefined} />,
    )

    expect(markup).toContain('common.tryAgain')
  })

  it('uses the supplied document label for already-signed copy', () => {
    const markup = renderToStaticMarkup(
      <AgreementErrorPanel code="signed" documentLabel="Engagement Letter" />,
    )

    expect(markup).toContain('nda.error.signed.message:Engagement Letter')
    expect(markup).not.toContain('NDA')
  })
})
