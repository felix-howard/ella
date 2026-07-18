import type React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientPaidServiceGroup } from '../../../lib/api-client'
import { PaidServiceGroup } from './paid-service-group'

const localeState = vi.hoisted(() => ({ language: 'en' }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { source?: string; title?: string }) =>
      [key, values?.source, values?.title].filter(Boolean).join(':'),
    i18n: {
      language: localeState.language,
      resolvedLanguage: localeState.language,
    },
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    search,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode
    search: { tab: string }
    'aria-label'?: string
  }) => (
    <a href={`/clients/client_1?tab=${search.tab}`} data-tab={search.tab} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}))

vi.mock('@ella/ui', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

const calculatorGroup: ClientPaidServiceGroup = {
  id: 'quote_1',
  source: 'CALCULATOR_AGREEMENT',
  paidAt: '2026-07-15T10:00:00.000Z',
  agreement: {
    id: 'agreement_1',
    title: '2026 Engagement Letter',
    signedAt: '2026-07-14T10:00:00.000Z',
  },
  items: [{
    id: 'monthly-1',
    label: 'Monthly bookkeeping',
    description: null,
    category: 'RECURRING',
    cadence: 'MONTH',
    status: 'ACTIVE',
  }],
}

beforeEach(() => {
  localeState.language = 'en'
})

describe('PaidServiceGroup', () => {
  it('keeps calculator provenance as plain text for staff', () => {
    const markup = renderToStaticMarkup(
      <PaidServiceGroup
        clientId="client_1"
        group={calculatorGroup}
        canManagePayments={false}
        canManageAgreements={false}
      />,
    )

    expect(markup).toContain('clientServices.source.CALCULATOR_AGREEMENT')
    expect(markup).toContain('2026 Engagement Letter')
    expect(markup).toContain('dateTime="2026-07-15T10:00:00.000Z"')
    expect(markup).not.toContain('<a ')
  })

  it('shows only the available admin destination for each source', () => {
    const customMarkup = renderToStaticMarkup(
      <PaidServiceGroup
        clientId="client_1"
        group={{ ...calculatorGroup, source: 'CUSTOM_LINK', agreement: null }}
        canManagePayments
        canManageAgreements
      />,
    )
    const agreementMarkup = renderToStaticMarkup(
      <PaidServiceGroup
        clientId="client_1"
        group={calculatorGroup}
        canManagePayments={false}
        canManageAgreements
      />,
    )

    expect(customMarkup).toContain('data-tab="payments"')
    expect(customMarkup).not.toContain('data-tab="agreements"')
    expect(agreementMarkup).not.toContain('data-tab="payments"')
    expect(agreementMarkup).toContain('data-tab="agreements"')
  })

  it('uses non-landmark link groups with source-specific accessible names', () => {
    const markup = renderToStaticMarkup(
      <>
        <PaidServiceGroup
          clientId="client_1"
          group={calculatorGroup}
          canManagePayments
          canManageAgreements
        />
        <PaidServiceGroup
          clientId="client_1"
          group={{ ...calculatorGroup, id: 'quote_2', source: 'CUSTOM_LINK', agreement: null }}
          canManagePayments
          canManageAgreements
        />
      </>,
    )

    expect(markup).not.toContain('<nav')
    expect(markup).toContain(
      'aria-label="clientServices.viewPaymentsForService:clientServices.source.CALCULATOR_AGREEMENT"',
    )
    expect(markup).toContain(
      'aria-label="clientServices.viewPaymentsForService:clientServices.source.CUSTOM_LINK"',
    )
    expect(markup).toContain(
      'aria-label="clientServices.viewAgreementByTitle:2026 Engagement Letter"',
    )
  })

  it('formats the first-paid date for English and Vietnamese', () => {
    const renderDate = () => renderToStaticMarkup(
      <PaidServiceGroup
        clientId="client_1"
        group={calculatorGroup}
        canManagePayments={false}
        canManageAgreements={false}
      />,
    )
    const date = new Date(calculatorGroup.paidAt)
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }

    expect(renderDate()).toContain(new Intl.DateTimeFormat('en-US', options).format(date))
    localeState.language = 'vi'
    expect(renderDate()).toContain(new Intl.DateTimeFormat('vi-VN', options).format(date))
  })
})
