import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivityTimelineItem } from '../../lib/api-client'
import { ActivityRow } from './activity-row'
import { ActivityTimeline, ActivityTimelineContent } from './activity-timeline'

const useQueryMock = vi.hoisted(() => vi.fn())
const recentMock = vi.hoisted(() => vi.fn())
const clientMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => useQueryMock(options),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

vi.mock('@ella/ui', () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}))

vi.mock('../../lib/formatters', () => ({
  formatFullDateTime: () => 'Wed, May 20, 12:00 PM',
  formatRelativeTime: () => 'Just now',
  getAvatarColor: () => ({ bg: 'bg-muted', text: 'text-muted-foreground' }),
  getInitials: () => 'AO',
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => {
      const labels: Record<string, string> = {
        'activity.actor.STAFF': 'Staff',
        'activity.category.MESSAGE': 'Messages',
        'activity.empty.recent': 'No recent activity',
        'activity.error': 'Could not load activity',
        'activity.filters.all': 'All',
        'activity.filters.category': 'Activity category',
        'activity.risk.HIGH': 'High risk',
        'clientOverview.recentActivity': 'Recent Activity',
        'dashboard.recentActivity': 'Recent Activity',
      }
      return labels[key] ?? key
    },
  }),
}))

vi.mock('../../lib/api-client', () => ({
  api: {
    activity: {
      recent: recentMock,
      client: clientMock,
    },
  },
}))

function activity(overrides: Partial<ActivityTimelineItem> = {}): ActivityTimelineItem {
  return {
    id: 'activity_1',
    createdAt: '2026-05-20T12:00:00.000Z',
    category: 'MESSAGE',
    action: 'message.sent',
    riskLevel: 'LOW',
    summary: 'Staff sent SMS to Client One',
    actor: { type: 'STAFF', staffId: 'staff_1', name: 'Agent One', avatarUrl: null },
    target: { type: 'CLIENT', id: 'client_1', label: 'Client One' },
    clientId: 'client_1',
    caseId: 'case_1',
    route: null,
    method: null,
    ...overrides,
  }
}

describe('ActivityTimeline', () => {
  beforeEach(() => {
    useQueryMock.mockReset()
    recentMock.mockReset()
    clientMock.mockReset()
    useQueryMock.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
  })

  it('renders an empty state', () => {
    const markup = renderToStaticMarkup(
      <ActivityTimelineContent
        items={[]}
        emptyLabel="No recent activity"
        errorLabel="Could not load activity"
      />,
    )

    expect(markup).toContain('No recent activity')
  })

  it('renders loading and error states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <ActivityTimelineContent
        items={[]}
        isLoading
        emptyLabel="No recent activity"
        errorLabel="Could not load activity"
      />,
    )
    const errorMarkup = renderToStaticMarkup(
      <ActivityTimelineContent
        items={[]}
        isError
        emptyLabel="No recent activity"
        errorLabel="Could not load activity"
      />,
    )

    expect(loadingMarkup).toContain('Loading activity')
    expect(errorMarkup).toContain('Could not load activity')
  })

  it('renders row summary, actor, target, and high-risk badge', () => {
    const markup = renderToStaticMarkup(
      <ActivityRow item={activity({ riskLevel: 'HIGH' })} />,
    )

    expect(markup).toContain('Agent One')
    expect(markup).toContain('Staff sent SMS to Client One')
    expect(markup).toContain('Client One')
    expect(markup).toContain('High risk')
  })

  it('uses recent activity query mode', () => {
    renderToStaticMarkup(<ActivityTimeline scope="recent" />)

    const options = useQueryMock.mock.calls[0][0] as { queryKey: unknown[]; queryFn: () => unknown }
    expect(options.queryKey).toEqual(['activity', 'recent', null, { limit: 20, category: undefined }])
    options.queryFn()
    expect(recentMock).toHaveBeenCalledWith({ limit: 20, category: undefined })
  })

  it('uses client activity query mode', () => {
    renderToStaticMarkup(<ActivityTimeline scope="client" clientId="client_1" />)

    const options = useQueryMock.mock.calls[0][0] as { queryKey: unknown[]; queryFn: () => unknown }
    expect(options.queryKey).toEqual(['activity', 'client', 'client_1', { limit: 20, category: undefined }])
    options.queryFn()
    expect(clientMock).toHaveBeenCalledWith('client_1', { limit: 20, category: undefined })
  })
})
