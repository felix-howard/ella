import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { LeadConversationListItem } from './lead-conversation-list-item'
import type { LeadConversation } from '../../lib/api-client'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    className,
    children,
  }: {
    to: string
    params: { leadId: string }
    className?: string
    children: React.ReactNode
  }) => (
    <a href={`${to}/${params.leadId}`} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('@ella/ui', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: string) => {
      const labels: Record<string, string> = {
        'leadMessages.leadBadge': 'Lead',
        'leadMessages.unknownLead': 'Unknown lead',
        'messages.you': 'You:',
      }
      return labels[key] ?? fallback ?? key
    },
  }),
}))

vi.mock('../../lib/formatters', () => ({
  formatRelativeTime: () => '2 hours ago',
  getAvatarColor: () => ({ bg: 'bg-avatar', text: 'text-avatar' }),
  getInitials: (name: string) => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
  sanitizeText: (text: string) => text.replace(/<[^>]*>/g, ''),
}))

function leadConversation(overrides: Partial<LeadConversation> = {}): LeadConversation {
  return {
    leadId: 'lead_1',
    unreadCount: 3,
    lastMessageAt: '2026-07-02T12:00:00.000Z',
    lead: {
      id: 'lead_1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      name: 'Ada Lovelace',
      phone: '*** *** 1234',
      status: 'CONTACTED',
      campaignTag: 'tax-2026',
      tags: ['vip'],
    },
    lastMessage: {
      id: 'msg_1',
      leadId: 'lead_1',
      content: 'Please send your W-2.',
      channel: 'SMS',
      direction: 'OUTBOUND',
      createdAt: '2026-07-02T12:00:00.000Z',
    },
    ...overrides,
  }
}

describe('LeadConversationListItem', () => {
  it('renders active lead rows with badge, unread count, and preview', () => {
    const markup = renderToStaticMarkup(
      <LeadConversationListItem conversation={leadConversation()} isActive />
    )

    expect(markup).toContain('Ada Lovelace')
    expect(markup).toContain('Lead')
    expect(markup).toContain('3')
    expect(markup).toContain('Please send your W-2.')
    expect(markup).toContain('2 hours ago')
    expect(markup).toContain('bg-primary/10')
  })

  it('uses the lead unread highlight when the row is not active', () => {
    const markup = renderToStaticMarkup(
      <LeadConversationListItem conversation={leadConversation()} />
    )

    expect(markup).toContain('bg-success/5')
  })
})
