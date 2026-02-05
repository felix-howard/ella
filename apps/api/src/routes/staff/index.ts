/**
 * Staff API routes
 * Language preference management for authenticated staff
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../../lib/db'
import type { AuthVariables } from '../../middleware/auth'

const staffRoute = new Hono<{ Variables: AuthVariables }>()

const updateLanguageSchema = z.object({
  language: z.enum(['VI', 'EN']),
})

// GET /staff/me - Get current staff profile (including language and orgRole)
staffRoute.get('/me', async (c) => {
  const user = c.get('user')
  if (!user?.staffId) {
    return c.json({ error: 'Staff record not found' }, 404)
  }

  const staff = await prisma.staff.findUnique({
    where: { id: user.staffId },
    select: { id: true, name: true, email: true, role: true, language: true },
  })

  if (!staff) {
    return c.json({ error: 'Staff record not found' }, 404)
  }

  return c.json({ ...staff, orgRole: user.orgRole })
})

// PATCH /staff/me/language - Update language preference
staffRoute.patch(
  '/me/language',
  zValidator('json', updateLanguageSchema),
  async (c) => {
    const user = c.get('user')
    if (!user?.staffId) {
      return c.json({ error: 'Staff record not found' }, 404)
    }

    const { language } = c.req.valid('json')

    const updated = await prisma.staff.update({
      where: { id: user.staffId },
      data: { language },
      select: { id: true, language: true },
    })

    return c.json(updated)
  }
)

export { staffRoute }
