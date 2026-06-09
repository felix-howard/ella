/**
 * Campaigns API routes
 * CRUD operations for campaign management (admin-only)
 */
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'
import { sanitizeTextInput } from '../../lib/validation'
import { sanitizeFormIntroContent } from '../../lib/sanitize-html'
import { authMiddleware, requireAdminOrManager } from '../../middleware/auth'
import type { AuthVariables } from '../../middleware/auth'
import type { AuthUser } from '../../services/auth'
import { getSignedDownloadUrl, uploadFile } from '../../services/storage'
import {
  createCampaignSchema,
  updateCampaignSchema,
  campaignIdParamSchema,
} from './schemas'

const campaignsRoute = new Hono<{ Variables: AuthVariables }>()
const INTRO_IMAGE_PREFIX = 'campaign-intro-images'
const INTRO_IMAGE_MAX_BYTES = 5 * 1024 * 1024
const INTRO_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const INTRO_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

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

function isUploadedFile(value: unknown): value is File {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as File).arrayBuffer === 'function' &&
    typeof (value as File).type === 'string' &&
    typeof (value as File).size === 'number'
  )
}

function encodeAssetKey(key: string): string {
  return Buffer.from(key, 'utf8').toString('base64url')
}

function decodeAssetKey(token: string): string | null {
  try {
    return Buffer.from(token, 'base64url').toString('utf8')
  } catch {
    return null
  }
}

function getApiOrigin(requestUrl: string): string {
  return process.env.API_PUBLIC_URL || new URL(requestUrl).origin
}

// ============================================
// List Campaigns (with lead count)
// ============================================
campaignsRoute.get(
  '/',
  authMiddleware,
  requireAdminOrManager,
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
// Public Campaign Intro Image
// ============================================
campaignsRoute.get('/intro-images/:token', async (c) => {
  const token = c.req.param('token')
  const key = decodeAssetKey(token)

  if (!key || !key.startsWith(`${INTRO_IMAGE_PREFIX}/`)) {
    return c.json({ success: false, error: 'Image not found' }, 404)
  }

  const url = await getSignedDownloadUrl(key, 300)
  if (!url) {
    return c.json({ success: false, error: 'Image not found' }, 404)
  }

  return c.redirect(url, 302)
})

// ============================================
// Upload Campaign Intro Image
// ============================================
campaignsRoute.post(
  '/intro-images',
  authMiddleware,
  requireAdminOrManager,
  async (c) => {
    const { orgId } = getVerifiedAuth(c.get('user'))
    const body = await c.req.parseBody()
    const image = body.image

    if (!isUploadedFile(image) || image.size === 0) {
      return c.json({ success: false, error: 'Image file is required' }, 400)
    }

    if (!INTRO_IMAGE_TYPES.has(image.type)) {
      return c.json({ success: false, error: 'Unsupported image type' }, 400)
    }

    if (image.size > Math.min(INTRO_IMAGE_MAX_BYTES, config.upload.maxFileSize)) {
      return c.json({ success: false, error: 'Image file is too large' }, 413)
    }

    const extension = INTRO_IMAGE_EXTENSIONS[image.type] ?? 'jpg'
    const random = Math.random().toString(36).slice(2, 10)
    const key = `${INTRO_IMAGE_PREFIX}/${orgId}/${Date.now()}-${random}.${extension}`
    const buffer = Buffer.from(await image.arrayBuffer())

    const upload = await uploadFile(key, buffer, image.type)
    if (!upload.url) {
      return c.json({ success: false, error: 'Image storage is not configured' }, 503)
    }

    return c.json({
      success: true,
      url: `${getApiOrigin(c.req.url)}/campaigns/intro-images/${encodeAssetKey(key)}`,
    })
  }
)

// ============================================
// Create Campaign
// ============================================
campaignsRoute.post(
  '/',
  authMiddleware,
  requireAdminOrManager,
  zValidator('json', createCampaignSchema),
  async (c) => {
    const { orgId, staffId } = getVerifiedAuth(c.get('user'))
    const { name, slug, tag, description, formIntroContent } = c.req.valid('json')

    try {
      const campaign = await prisma.campaign.create({
        data: {
          name: sanitizeTextInput(name),
          slug,
          tag: sanitizeTextInput(tag),
          description: description ? sanitizeTextInput(description, 500) : null,
          formIntroContent: formIntroContent ? sanitizeFormIntroContent(formIntroContent) : null,
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
  requireAdminOrManager,
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
    if (updates.formIntroContent !== undefined) {
      data.formIntroContent = updates.formIntroContent
        ? sanitizeFormIntroContent(updates.formIntroContent)
        : null
    }

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
  requireAdminOrManager,
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
