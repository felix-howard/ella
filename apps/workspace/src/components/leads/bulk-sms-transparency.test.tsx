import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { LeadSmsStatusIndicator } from './lead-sms-status-indicator'
import { SelectAllFilteredBanner } from './select-all-filtered-banner'

vi.mock('@ella/ui', () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}))

vi.mock('../../lib/formatters', () => ({
  formatShortRelativeTime: () => '2h ago',
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, values?: Record<string, string | number>) => {
      const labels: Record<string, string> = {
        'leads.allFilteredSelected': `${values?.count} selected`,
        'leads.bulkSmsLimitHint': `Up to ${values?.limit} recipients`,
        'leads.bulkSmsOverLimit': `${values?.count} leads match. Narrow to ${values?.limit} or fewer.`,
        'leads.selectedOnPage': `${values?.count} selected on this page`,
        'leads.selectAllFiltered': `Select all ${values?.count}`,
        'leads.selectingTargets': 'Selecting...',
        'leads.smsStatus.DELIVERED': 'Delivered',
        'leads.smsStatus.FAILED': 'Failed',
        'leads.smsStatus.SENT': 'Queued',
        'leads.smsStatus.UNDELIVERED': 'Undelivered',
        'leads.smsStatus.help': `${values?.status} ${values?.time}`,
        'leads.smsStatus.helpWithError': `${values?.status} ${values?.time}: ${values?.error}`,
        'leads.smsStatus.none': 'No SMS',
        'leads.smsStatus.noneHelp': 'No SMS yet',
        'leads.smsStatus.withTime': `${values?.status} ${values?.time}`,
      }
      return labels[key] ?? key
    },
  }),
}))

describe('bulk SMS transparency UI', () => {
  it('renders latest SMS failure reason for lead rows and detail surfaces', () => {
    const markup = renderToStaticMarkup(
      <LeadSmsStatusIndicator
        sms={{
          status: 'UNDELIVERED',
          error: 'SMS provider error 30007',
          sentAt: '2026-06-09T12:00:00.000Z',
        }}
      />,
    )

    expect(markup).toContain('Undelivered 2h ago')
    expect(markup).toContain('SMS provider error 30007')
  })

  it('shows over-limit filtered selection guidance without select-all action', () => {
    const markup = renderToStaticMarkup(
      <SelectAllFilteredBanner
        pageSelectedCount={50}
        selectedCount={50}
        selectableTotal={250}
        bulkSmsLimit={200}
        allFilteredSelected={false}
        isFetchingTargets={false}
        onSelectAllFiltered={vi.fn()}
      />,
    )

    expect(markup).toContain('50 selected on this page')
    expect(markup).toContain('250 leads match. Narrow to 200 or fewer.')
    expect(markup).not.toContain('Select all 250')
  })

  it('shows select-all action when filtered target count is within the bulk limit', () => {
    const markup = renderToStaticMarkup(
      <SelectAllFilteredBanner
        pageSelectedCount={50}
        selectedCount={50}
        selectableTotal={120}
        bulkSmsLimit={200}
        allFilteredSelected={false}
        isFetchingTargets={false}
        onSelectAllFiltered={vi.fn()}
      />,
    )

    expect(markup).toContain('50 selected on this page')
    expect(markup).toContain('Up to 200 recipients')
    expect(markup).toContain('Select all 120')
  })
})
