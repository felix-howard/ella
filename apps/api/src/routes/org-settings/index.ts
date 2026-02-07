/**
 * Organization Settings API routes
 * Manage org-level settings (e.g., SMS language preference)
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../../lib/db'
import type { AuthVariables } from '../../middleware/auth'

const orgSettingsRoute = new Hono<{ Variables: AuthVariables }>()

const updateOrgSettingsSchema = z.object({
  smsLanguage: z.enum(['VI', 'EN']).optional(),
  missedCallTextBack: z.boolean().optional(),
})

// GET /org-settings - Get org settings
orgSettingsRoute.get('/', async (c) => {
  const user = c.get('user')
  if (!user?.organizationId) {
    return c.json({ error: 'No organization' }, 403)
  }

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { smsLanguage: true, missedCallTextBack: true },
  })

  if (!org) {
    return c.json({ error: 'Organization not found' }, 404)
  }

  return c.json({
    smsLanguage: org.smsLanguage,
    missedCallTextBack: org.missedCallTextBack,
  })
})

// PATCH /org-settings - Update org settings (admin only)
orgSettingsRoute.patch(
  '/',
  zValidator('json', updateOrgSettingsSchema),
  async (c) => {
    const user = c.get('user')
    if (!user?.organizationId) {
      return c.json({ error: 'No organization' }, 403)
    }

    // Only admins can update org settings
    if (user.orgRole !== 'org:admin' && user.role !== 'ADMIN') {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const data = c.req.valid('json')

    const updated = await prisma.organization.update({
      where: { id: user.organizationId },
      data,
      select: { smsLanguage: true, missedCallTextBack: true },
    })

    return c.json({
      smsLanguage: updated.smsLanguage,
      missedCallTextBack: updated.missedCallTextBack,
    })
  }
)

export { orgSettingsRoute }
