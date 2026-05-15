import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { TeamMember } from '../../../lib/api-client'
import { TeamMemberTable } from '../team-member-table'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}))

vi.mock('@ella/ui', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}))

vi.mock('../../../lib/formatters', () => ({
  getAvatarColor: () => ({ bg: 'bg-muted', text: 'text-muted-foreground' }),
  getInitials: () => 'AO',
}))

function member(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 'staff-1',
    clerkId: 'clerk-1',
    name: 'Agent One',
    email: 'agent@test.com',
    role: 'STAFF',
    avatarUrl: null,
    lastLoginAt: null,
    isActive: true,
    isContractorAgent: false,
    formSlug: null,
    _count: { managedClients: 0 },
    ...overrides,
  }
}

describe('TeamMemberTable', () => {
  it('renders Contractor Agent badge for contractor-agent staff', () => {
    const markup = renderToStaticMarkup(
      <TeamMemberTable members={[member({ isContractorAgent: true })]} />,
    )

    expect(markup).toContain('Contractor Agent')
  })

  it('does not render Contractor Agent badge for regular staff', () => {
    const markup = renderToStaticMarkup(
      <TeamMemberTable members={[member({ isContractorAgent: false })]} />,
    )

    expect(markup).not.toContain('Contractor Agent')
  })
})
