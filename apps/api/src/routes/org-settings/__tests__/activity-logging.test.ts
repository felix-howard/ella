import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../lib/db', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../../../lib/clerk-client', () => ({
  clerkClient: {
    organizations: {
      updateOrganization: vi.fn(),
    },
  },
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    route: '/org-settings',
    method: 'PATCH',
  })),
  getChangedFieldNames: vi.fn((input: Record<string, unknown>) =>
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)
  ),
  logStaffActivity: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { logStaffActivity } from '../../../services/activity-log'
import { orgSettingsRoute } from '../index'

function createApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: 'clerk_user_1',
      organizationId: 'org_1',
      staffId: 'staff_1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
      clerkOrgId: 'clerk_org_1',
      orgRole: 'org:admin',
    })
    await next()
  })
  app.route('/org-settings', orgSettingsRoute)
  return app
}

describe('org settings activity logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.organization.update).mockResolvedValue({
      name: 'Firm',
      smsLanguage: 'EN',
      missedCallTextBack: true,
      autoSendFormClientUploadLink: false,
      defaultUploadLinkTemplateId: null,
      slug: 'firm',
      clerkOrgId: 'clerk_org_1',
      address: null,
      city: null,
      state: null,
      zip: null,
      governingState: null,
      governingCounty: null,
      firmPhone: null,
      firmEmail: 'private@example.com',
      firmWebsite: null,
    } as never)
  })

  it('logs changed field names without raw setting values', async () => {
    const res = await createApp().request('/org-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Firm',
        firmEmail: 'private@example.com',
        smsLanguage: 'EN',
      }),
    })

    expect(res.status).toBe(200)
    expect(logStaffActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        actorStaffId: 'staff_1',
        action: 'settings.organization_updated',
        metadata: {
          changedFields: ['name', 'smsLanguage', 'firmEmail'],
        },
      })
    )
    const metadata = vi.mocked(logStaffActivity).mock.calls[0][0].metadata as Record<string, unknown>
    expect(JSON.stringify(metadata)).not.toContain('private@example.com')
    expect(JSON.stringify(metadata)).not.toContain('Firm')
  })
})
