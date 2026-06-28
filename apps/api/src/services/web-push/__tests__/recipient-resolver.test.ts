import { StaffRole } from '@ella/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    conversation: {
      findUnique: vi.fn(),
    },
    lead: {
      findUnique: vi.fn(),
    },
    staff: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../../../lib/db', () => ({
  prisma: mocks.prisma,
}))

import { prisma } from '../../../lib/db'
import {
  resolveClientMessagePushRecipients,
  resolveLeadMessagePushRecipients,
} from '../recipient-resolver'

describe('resolveClientMessagePushRecipients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads active staff with enabled push subscriptions by client visibility', async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValueOnce({
      id: 'conv_1',
      caseId: 'case_1',
      taxCase: {
        clientId: 'client_1',
        client: { organizationId: 'org_1' },
      },
    } as never)
    vi.mocked(prisma.staff.findMany).mockResolvedValueOnce([
      { id: 'admin_1' },
      { id: 'manager_1' },
      { id: 'staff_assigned' },
      { id: 'cpa_assigned' },
    ] as never)

    const result = await resolveClientMessagePushRecipients('conv_1')

    expect(result).toEqual({
      conversationId: 'conv_1',
      caseId: 'case_1',
      clientId: 'client_1',
      organizationId: 'org_1',
      staffIds: ['admin_1', 'manager_1', 'staff_assigned', 'cpa_assigned'],
    })
    expect(prisma.staff.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org_1',
        isActive: true,
        webPushSubscriptions: { some: { enabled: true } },
        OR: [
          { role: { in: [StaffRole.ADMIN, StaffRole.MANAGER] } },
          {
            managedClientLinks: {
              some: { clientId: 'client_1', organizationId: 'org_1' },
            },
          },
        ],
      },
      select: { id: true },
    })
  })

  it('returns an empty recipient list when no visible staff has a subscription', async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValueOnce({
      id: 'conv_1',
      caseId: 'case_1',
      taxCase: {
        clientId: 'client_1',
        client: { organizationId: 'org_1' },
      },
    } as never)
    vi.mocked(prisma.staff.findMany).mockResolvedValueOnce([] as never)

    await expect(resolveClientMessagePushRecipients('conv_1')).resolves.toMatchObject({
      staffIds: [],
    })
  })

  it('returns null when the conversation cannot resolve to an org client case', async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValueOnce(null)

    await expect(resolveClientMessagePushRecipients('missing_conv')).resolves.toBeNull()
    expect(prisma.staff.findMany).not.toHaveBeenCalled()
  })
})

describe('resolveLeadMessagePushRecipients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads active admin and manager staff with enabled push subscriptions', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({
      id: 'lead_1',
      organizationId: 'org_1',
    } as never)
    vi.mocked(prisma.staff.findMany).mockResolvedValueOnce([
      { id: 'admin_1' },
      { id: 'manager_1' },
    ] as never)

    const result = await resolveLeadMessagePushRecipients('lead_1')

    expect(result).toEqual({
      leadId: 'lead_1',
      organizationId: 'org_1',
      staffIds: ['admin_1', 'manager_1'],
    })
    expect(prisma.staff.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org_1',
        isActive: true,
        role: { in: [StaffRole.ADMIN, StaffRole.MANAGER] },
        webPushSubscriptions: { some: { enabled: true } },
      },
      select: { id: true },
    })
  })

  it('returns null when the lead does not exist', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(null)

    await expect(resolveLeadMessagePushRecipients('missing_lead')).resolves.toBeNull()
    expect(prisma.staff.findMany).not.toHaveBeenCalled()
  })
})
