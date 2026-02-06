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

const updateSmsLanguageSchema = z.object({
  smsLanguage: z.enum(['VI', 'EN']),
})

// GET /org-settings - Get org settings
orgSettingsRoute.get('/', async (c) => {
  const user = c.get('user')
  if (!user?.organizationId) {
    return c.json({ error: 'No organization' }, 403)
  }

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { smsLanguage: true },
  })

  if (!org) {
    return c.json({ error: 'Organization not found' }, 404)
  }

  return c.json({ smsLanguage: org.smsLanguage })
})

// PATCH /org-settings - Update org settings (admin only)
orgSettingsRoute.patch(
  '/',
  zValidator('json', updateSmsLanguageSchema),
  async (c) => {
    const user = c.get('user')
    if (!user?.organizationId) {
      return c.json({ error: 'No organization' }, 403)
    }

    // Only admins can update org settings
    if (user.orgRole !== 'org:admin' && user.role !== 'ADMIN') {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const { smsLanguage } = c.req.valid('json')

    const updated = await prisma.organization.update({
      where: { id: user.organizationId },
      data: { smsLanguage },
      select: { smsLanguage: true },
    })

    return c.json({ smsLanguage: updated.smsLanguage })
  }
)

export { orgSettingsRoute }
