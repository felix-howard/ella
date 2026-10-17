import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../lib/db', () => ({
  prisma: {
    staff: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '../../../lib/db'
import { agreementFirmSignersRoute } from '../agreement-firm-signers'

function createApp(staffId: string | null = 'staff-1') {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: 'clerk-user-1',
      staffId,
      organizationId: 'org-1',
      email: 'staff@example.com',
      name: 'Staff User',
      role: 'ADMIN',
      clerkOrgId: 'clerk-org-1',
      orgRole: 'org:admin',
    } as AuthVariables['user'])
    await next()
  })
  app.route('/staff/agreement-firm-signers', agreementFirmSignersRoute)
  return app
}

describe('GET /staff/agreement-firm-signers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists active org staff with a title and saved signature', async () => {
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      { id: 'staff-andy', name: 'Andy Nguyen', title: 'Managing Partner' },
      { id: 'staff-tuyet', name: 'Tuyet Duong', title: ' Senior Account Advisor ' },
      { id: 'staff-blank', name: 'No Title', title: '   ' },
    ] as never)

    const res = await createApp().request('/staff/agreement-firm-signers')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: [
        { id: 'staff-andy', name: 'Andy Nguyen', title: 'Managing Partner' },
        { id: 'staff-tuyet', name: 'Tuyet Duong', title: 'Senior Account Advisor' },
      ],
    })
    expect(prisma.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          isActive: true,
          signaturePngKey: { not: null },
          title: { not: null },
        },
      }),
    )
  })

  it('returns 404 without a staff record', async () => {
    const res = await createApp(null).request('/staff/agreement-firm-signers')

    expect(res.status).toBe(404)
    expect(prisma.staff.findMany).not.toHaveBeenCalled()
  })
})
