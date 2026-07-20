// @vitest-environment happy-dom
import type React from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import en from '../../../locales/en.json'
import viLocale from '../../../locales/vi.json'
import type {
  ClientPaidServiceGroup,
  ClientPaidServiceStatus,
  ClientPaidServicesResponse,
} from '../../../lib/api-client'
import { ClientServicesTab } from './client-services-tab'

const testState = vi.hoisted(() => {
  const refetch = vi.fn()
  return {
    refetch,
    query: {
      isLoading: false,
      isError: false,
      data: {
        success: true,
        data: [],
        meta: { isTruncated: false, limit: 100 },
      } as ClientPaidServicesResponse,
      refetch,
    },
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, search }: { children: React.ReactNode; search: { tab: string } }) => (
    <a href={`/clients/client_1?tab=${search.tab}`} data-tab={search.tab}>
      {children}
    </a>
  ),
}))

vi.mock('@ella/ui', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('./use-client-paid-services', () => ({
  useClientPaidServices: () => testState.query,
}))

function buildGroup(
  id: string,
  statuses: ClientPaidServiceStatus[],
  overrides: Partial<ClientPaidServiceGroup> = {},
): ClientPaidServiceGroup {
  return {
    id,
    source: 'CUSTOM_LINK',
    paidAt: '2026-07-15T10:00:00.000Z',
    agreement: null,
    items: statuses.map((status, index) => ({
      id: `${id}-item-${index}`,
      label: `${id} service ${index}`,
      description: index === 0 ? `${id} description` : null,
      category: status === 'PAID' ? 'ONE_TIME' : 'RECURRING',
      cadence: status === 'PAID' ? 'ONE_TIME' : 'MONTH',
      status,
    })),
    ...overrides,
  }
}

beforeEach(() => {
  testState.refetch.mockReset()
  testState.query = {
    isLoading: false,
    isError: false,
    data: { success: true, data: [], meta: { isTruncated: false, limit: 100 } },
    refetch: testState.refetch,
  }
})

describe('ClientServicesTab', () => {
  it('renders every lifecycle status once in operational section order for staff', () => {
    testState.query.data.data = [
      buildGroup('past', ['PAST_DUE', 'PAID']),
      buildGroup('active', ['ACTIVE']),
      buildGroup('paid', ['PAID']),
      buildGroup('history', ['ENDED', 'REFUNDED']),
    ]

    const markup = renderToStaticMarkup(<ClientServicesTab clientId="client_1" />)

    const headings = [
      'clientServices.section.pastDue',
      'clientServices.section.active',
      'clientServices.section.paid',
      'clientServices.section.history',
    ]
    headings.forEach((heading, index) => {
      expect(markup).toContain(heading)
      if (index > 0) expect(markup.indexOf(heading)).toBeGreaterThan(markup.indexOf(headings[index - 1]))
    })
    const sectionMarkup = headings.map((heading, index) =>
      markup.slice(markup.indexOf(heading), markup.indexOf(headings[index + 1] ?? '') || undefined),
    )
    expect(sectionMarkup[0]).toContain('past service 0')
    expect(sectionMarkup[0]).toContain('past service 1')
    expect(sectionMarkup[2]).not.toContain('past service 1')
    expect(sectionMarkup[3]).toContain('history service 0')
    expect(sectionMarkup[3]).toContain('history service 1')
    ;(['PAST_DUE', 'ACTIVE', 'PAID', 'ENDED', 'REFUNDED'] as const).forEach((status) => {
      expect(markup).toContain(`data-status="${status}"`)
    })
    expect(markup.match(/past service 0/g)).toHaveLength(1)
    expect(markup.match(/past service 1/g)).toHaveLength(1)
    expect(markup).not.toContain('data-tab="payments"')
    expect(markup).not.toContain('<form')
  })

  it('shows safe admin drill-down links and calculator provenance', () => {
    testState.query.data.data = [
      buildGroup('calculator', ['ACTIVE'], {
        source: 'CALCULATOR_AGREEMENT',
        agreement: {
          id: 'agreement_1',
          title: '2026 Engagement Letter',
          signedAt: '2026-07-14T10:00:00.000Z',
        },
      }),
    ]

    const markup = renderToStaticMarkup(
      <ClientServicesTab
        clientId="client_1"
        canManagePayments
        canManageAgreements
      />,
    )

    expect(markup).toContain('2026 Engagement Letter')
    expect(markup).toContain('data-tab="payments"')
    expect(markup).toContain('data-tab="agreements"')
    expect(markup).not.toContain('$')
    expect(markup).not.toContain('Stripe')
  })

  it('renders long custom service text without truncation', () => {
    const longLabel = 'A'.repeat(120)
    testState.query.data.data = [buildGroup('custom', ['PAID'], {
      items: [{
        id: 'long-item',
        label: longLabel,
        description: 'Detailed custom service description',
        category: 'ONE_TIME',
        cadence: 'ONE_TIME',
        status: 'PAID',
      }],
    })]

    const markup = renderToStaticMarkup(<ClientServicesTab clientId="client_1" />)

    expect(markup).toContain(longLabel)
    expect(markup).toContain('[overflow-wrap:anywhere]')
    expect(markup).toContain('clientServices.source.CUSTOM_LINK')
  })

  it('warns when the paid-service history is limited to the newest groups', () => {
    testState.query.data = {
      success: true,
      data: [buildGroup('paid', ['PAID'])],
      meta: { isTruncated: true, limit: 100 },
    }

    const markup = renderToStaticMarkup(<ClientServicesTab clientId="client_1" />)

    expect(markup).toContain('clientServices.truncated')
    expect(markup).toContain('role="status"')
  })

  it.each([
    ['loading', { isLoading: true, isError: false }, 'role="status"', 'clientServices.loading'],
    ['error', { isLoading: false, isError: true }, 'role="alert"', 'clientServices.retry'],
    ['empty', { isLoading: false, isError: false }, 'clientServices.emptyTitle', 'clientServices.emptyDescription'],
  ])('renders the %s state accessibly', (_name, state, first, second) => {
    testState.query = { ...testState.query, ...state }
    const markup = renderToStaticMarkup(<ClientServicesTab clientId="client_1" />)
    expect(markup).toContain(first)
    expect(markup).toContain(second)
  })

  it('retries the paid-services query after a load error', () => {
    testState.query = { ...testState.query, isError: true }
    const container = document.createElement('div')
    const root = createRoot(container)
    flushSync(() => root.render(<ClientServicesTab clientId="client_1" />))

    container.querySelector('button')?.click()

    expect(testState.refetch).toHaveBeenCalledOnce()
    flushSync(() => root.unmount())
  })

  it('keeps all paid-service translations in English and Vietnamese', () => {
    const keys = (locale: Record<string, string>) =>
      Object.keys(locale).filter((key) => key.startsWith('clientServices.')).sort()

    expect(keys(en)).toEqual(keys(viLocale))
    expect(keys(en)).not.toContain('clientServices.placeholderTitle')
  })
})
