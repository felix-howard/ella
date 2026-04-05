/**
 * Campaigns API routes
 * CRUD operations for campaign management (admin-only)
 */
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import { sanitizeTextInput } from '../../lib/validation'
import { authMiddleware, requireOrgAdmin } from '../../middleware/auth'
import type { AuthVariables } from '../../middleware/auth'
import type { AuthUser } from '../../services/auth'
import {
  createCampaignSchema,
  updateCampaignSchema,
  campaignIdParamSchema,
} from './schemas'

const campaignsRoute = new Hono<{ Variables: AuthVariables }>()

/** Extract verified orgId and staffId from auth user */
function getVerifiedAuth(user: AuthUser): { orgId: string; staffId: string } {
  if (!user.organizationId) {
    throw new HTTPException(403, { message: 'Organization required' })
  }
  if (!user.staffId) {
    throw new HTTPException(403, { message: 'Staff record required' })
  }
  return { orgId: user.organizationId, staffId: user.staffId }
}

// ============================================
// List Campaigns (with lead count)
// ============================================
campaignsRoute.get(
  '/',
  authMiddleware,
  requireOrgAdmin,
  async (c) => {
    const { orgId } = getVerifiedAuth(c.get('user'))

    const campaigns = await prisma.campaign.findMany({
      where: { organizationId: orgId },
      orderBy: [
        { status: 'asc' }, // ACTIVE before ARCHIVED
        { createdAt: 'desc' },
      ],
      include: {
        createdBy: {
          select: { name: true },
        },
      },
    })

    // Compute lead counts per campaign tag
    const tags = campaigns.map((c) => c.tag)
    const leadCounts = tags.length > 0
      ? await prisma.lead.groupBy({
          by: ['campaignTag'],
          where: {
            organizationId: orgId,
            campaignTag: { in: tags },
          },
          _count: { id: true },
        })
      : []

    const countMap = new Map(
      leadCounts.map((lc) => [lc.campaignTag, lc._count.id])
    )

    const data = campaigns.map((campaign) => ({
      ...campaign,
      _count: { leads: countMap.get(campaign.tag) || 0 },
    }))

    return c.json({ success: true, data })
  }
)

// ============================================
// Create Campaign
// ============================================
campaignsRoute.post(
  '/',
  authMiddleware,
  requireOrgAdmin,
  zValidator('json', createCampaignSchema),
  async (c) => {
    const { orgId, staffId } = getVerifiedAuth(c.get('user'))
    const { name, slug, tag, description } = c.req.valid('json')

    try {
      const campaign = await prisma.campaign.create({
        data: {
          name: sanitizeTextInput(name),
          slug,
          tag: sanitizeTextInput(tag),
          description: description ? sanitizeTextInput(description, 500) : null,
          organizationId: orgId,
          createdById: staffId,
        },
        include: {
          createdBy: {
            select: { name: true },
          },
        },
      })

      return c.json({ success: true, data: { ...campaign, _count: { leads: 0 } } }, 201)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
        return c.json({ success: false, error: 'Campaign slug already exists' }, 409)
      }
      throw err
    }
  }
)

// ============================================
// Update Campaign
// ============================================
campaignsRoute.patch(
  '/:id',
  authMiddleware,
  requireOrgAdmin,
  zValidator('param', campaignIdParamSchema),
  zValidator('json', updateCampaignSchema),
  async (c) => {
    const { orgId } = getVerifiedAuth(c.get('user'))
    const { id } = c.req.valid('param')
    const updates = c.req.valid('json')

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: orgId },
    })

    if (!campaign) {
      return c.json({ success: false, error: 'Campaign not found' }, 404)
    }

    const data: Record<string, unknown> = {}
    if (updates.name) data.name = sanitizeTextInput(updates.name)
    if (updates.description !== undefined) {
      data.description = updates.description ? sanitizeTextInput(updates.description, 500) : null
    }
    if (updates.status) data.status = updates.status

    const updated = await prisma.campaign.update({
      where: { id },
      data,
      include: {
        createdBy: {
          select: { name: true },
        },
      },
    })

    return c.json({ success: true, data: updated })
  }
)

// ============================================
// Delete Campaign (only if 0 leads)
// ============================================
campaignsRoute.delete(
  '/:id',
  authMiddleware,
  requireOrgAdmin,
  zValidator('param', campaignIdParamSchema),
  async (c) => {
    const { orgId } = getVerifiedAuth(c.get('user'))
    const { id } = c.req.valid('param')

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: orgId },
    })

    if (!campaign) {
      return c.json({ success: false, error: 'Campaign not found' }, 404)
    }

    // Transaction to prevent race between count check and delete
    const result = await prisma.$transaction(async (tx) => {
      const leadCount = await tx.lead.count({
        where: { organizationId: orgId, campaignTag: campaign.tag },
      })

      if (leadCount > 0) {
        return { blocked: true as const, leadCount }
      }

      await tx.campaign.delete({ where: { id } })
      return { blocked: false as const }
    })

    if (result.blocked) {
      return c.json({
        success: false,
        error: `Cannot delete campaign with ${result.leadCount} lead(s). Archive it instead.`,
      }, 409)
    }

    return c.json({ success: true })
  }
)

export { campaignsRoute }
