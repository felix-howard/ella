import { describe, expect, it } from 'vitest'
import { getCompletedInvitationRedirectTarget } from '../accept-invitation-status'

describe('getCompletedInvitationRedirectTarget', () => {
  it('redirects completed Clerk invitation links back to the workspace', () => {
    expect(getCompletedInvitationRedirectTarget({
      ticket: 'ticket_123',
      accountStatus: 'complete',
    })).toBe('/')
  })

  it('does not redirect incomplete invitation flows', () => {
    expect(getCompletedInvitationRedirectTarget({
      ticket: 'ticket_123',
      accountStatus: 'sign_in',
    })).toBeNull()
    expect(getCompletedInvitationRedirectTarget({
      ticket: 'ticket_123',
      accountStatus: 'sign_up',
    })).toBeNull()
    expect(getCompletedInvitationRedirectTarget({
      ticket: null,
      accountStatus: 'complete',
    })).toBeNull()
  })
})
