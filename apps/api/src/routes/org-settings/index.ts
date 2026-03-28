/**
 * Organization Settings API routes
 * Manage org-level settings (e.g., SMS language preference)
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { clerkClient } from '../../lib/clerk-client'
import type { AuthVariables } from '../../middleware/auth'

const orgSettingsRoute = new Hono<{ Variables: AuthVariables }>()

const updateOrgSettingsSchema = z.object({
  smsLanguage: z.enum(['VI', 'EN']).optional(),
  missedCallTextBack: z.boolean().optional(),
  autoSendFormClientUploadLink: z.boolean().optional(),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/).optional().nullable(),
})

// GET /org-settings - Get org settings
orgSettingsRoute.get('/', async (c) => {
  const user = c.get('user')
  if (!user?.organizationId) {
    return c.json({ error: 'No organization' }, 403)
  }

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { smsLanguage: true, missedCallTextBack: true, autoSendFormClientUploadLink: true, slug: true },
  })

  if (!org) {
    return c.json({ error: 'Organization not found' }, 404)
  }

  return c.json({
    smsLanguage: org.smsLanguage,
    missedCallTextBack: org.missedCallTextBack,
    autoSendFormClientUploadLink: org.autoSendFormClientUploadLink,
    slug: org.slug,
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

    // Validate slug uniqueness if provided
    if (data.slug) {
      const existing = await prisma.organization.findFirst({
        where: { slug: data.slug, id: { not: user.organizationId } },
      })
      if (existing) {
        return c.json({ error: 'SLUG_TAKEN' }, 409)
      }
    }

    let updated
    try {
      updated = await prisma.organization.update({
        where: { id: user.organizationId },
        data,
        select: { smsLanguage: true, missedCallTextBack: true, autoSendFormClientUploadLink: true, slug: true, clerkOrgId: true },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return c.json({ error: 'SLUG_TAKEN' }, 409)
      }
      throw error
    }

    // Sync slug to Clerk if it changed
    if (data.slug !== undefined && updated.clerkOrgId) {
      try {
        await clerkClient.organizations.updateOrganization(updated.clerkOrgId, {
          slug: data.slug ?? undefined,
        })
      } catch (err) {
        console.error('[OrgSettings] Failed to sync slug to Clerk:', err)
      }
    }

    return c.json({
      smsLanguage: updated.smsLanguage,
      missedCallTextBack: updated.missedCallTextBack,
      autoSendFormClientUploadLink: updated.autoSendFormClientUploadLink,
      slug: updated.slug,
    })
  }
)

export { orgSettingsRoute }
