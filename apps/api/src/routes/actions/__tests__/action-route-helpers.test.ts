import { describe, expect, it } from 'vitest'
import { serializeAction } from '../action-route-helpers'
import type { AuthVariables } from '../../../middleware/auth'

const user = {
  organizationId: 'org_1',
  role: 'ORG_ADMIN',
  orgRole: 'org:admin',
} as AuthVariables['user']

const baseAction = {
  id: 'action_1',
  caseId: null,
  leadId: 'lead_1',
  priority: 'HIGH',
  title: 'Lead replied',
  description: 'New lead reply',
  isCompleted: false,
  assignedToId: null,
  taxCase: null,
  lead: {
    id: 'lead_1',
    firstName: 'Andy',
    lastName: 'Nguyen',
    businessName: null,
    status: 'NEW',
  },
  createdAt: new Date('2026-06-28T00:00:00.000Z'),
  updatedAt: new Date('2026-06-28T00:00:00.000Z'),
}

describe('serializeAction', () => {
  it('strips LEAD_REPLIED body previews from action metadata', () => {
    const action = serializeAction(user, {
      ...baseAction,
      type: 'LEAD_REPLIED' as const,
      metadata: {
        messageId: 'msg_1',
        preview: 'private lead reply body',
        mediaCount: 1,
      },
    })

    expect(action.metadata).toEqual({
      messageId: 'msg_1',
      mediaCount: 1,
    })
  })

  it('keeps CLIENT_REPLIED previews for the client inbox workflow', () => {
    const action = serializeAction(user, {
      ...baseAction,
      type: 'CLIENT_REPLIED' as const,
      leadId: null,
      metadata: {
        messageId: 'msg_2',
        preview: 'client reply preview',
        mediaCount: 0,
      },
    })

    expect(action.metadata).toEqual({
      messageId: 'msg_2',
      preview: 'client reply preview',
      mediaCount: 0,
    })
  })
})
