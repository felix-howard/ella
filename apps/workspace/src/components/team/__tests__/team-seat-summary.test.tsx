import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { TeamReconciliationResponse } from '../../../lib/api-client'
import { TeamSeatSummary } from '../team-seat-summary'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown> | string) => {
      if (typeof options === 'string') return options
      if (key === 'team.staffRecordsSummary') {
        return `${options?.activeCount} active / ${options?.staffCount} total`
      }
      if (key === 'team.archivedStaffCount') return `${options?.count} archived`
      if (key === 'team.clerkSeatsUsed') return `${options?.count} used`
      if (key === 'team.pendingInvitationCount') return `${options?.count} pending invites`
      return typeof options?.defaultValue === 'string' ? options.defaultValue : key
    },
  }),
}))

const reconciliation: TeamReconciliationResponse = {
  seatsUsed: 20,
  staffCount: 22,
  pendingInvitationCount: 2,
  members: [
    {
      status: 'ACTIVE_MATCH',
      staffId: 'staff-active',
      clerkUserId: 'clerk-active',
      invitationId: null,
      email: 'active@test.com',
      name: 'Active Staff',
      appRole: 'ADMIN',
      clerkRole: 'org:admin',
      isActive: true,
      managedClientCount: 0,
    },
    {
      status: 'ARCHIVED_STILL_IN_CLERK',
      staffId: 'staff-archived',
      clerkUserId: 'clerk-archived',
      invitationId: null,
      email: 'archived@test.com',
      name: 'Archived Staff',
      appRole: 'STAFF',
      clerkRole: 'org:member',
      isActive: false,
      managedClientCount: 0,
    },
  ],
}

describe('TeamSeatSummary', () => {
  it('renders staff counts, Clerk seats used, and pending invites', () => {
    const markup = renderToStaticMarkup(
      <TeamSeatSummary reconciliation={reconciliation} fallbackActiveCount={1} />,
    )

    expect(markup).toContain('1 active / 22 total')
    expect(markup).toContain('21 archived')
    expect(markup).toContain('20 used')
    expect(markup).toContain('2 pending invites')
  })
})
