/**
 * Organization Settings API routes
 * Manage org-level settings (e.g., SMS language preference)
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { ActivityRiskLevel, Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { clerkClient } from '../../lib/clerk-client'
import { UPLOAD_LINK_TEMPLATE_IDS } from '../../services/sms/upload-link-template-resolver'
import type { AuthVariables } from '../../middleware/auth'
import { getAuditRequestContext, getChangedFieldNames, logStaffActivity } from '../../services/activity-log'
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, ACTIVITY_TARGET_TYPES } from '../../services/activity-actions'

const orgSettingsRoute = new Hono<{ Variables: AuthVariables }>()

const updateOrgSettingsSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  smsLanguage: z.enum(['VI', 'EN']).optional(),
  missedCallTextBack: z.boolean().optional(),
  autoSendFormClientUploadLink: z.boolean().optional(),
  defaultUploadLinkTemplateId: z.enum(UPLOAD_LINK_TEMPLATE_IDS).nullable().optional(),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/).optional().nullable(),
  // Firm address + governing law (NDA header)
  address: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().length(2).nullable().optional(),
  zip: z.string().max(20).nullable().optional(),
  governingState: z.string().max(50).nullable().optional(),
  governingCounty: z.string().max(100).nullable().optional(),
  firmPhone: z.string().max(30).nullable().optional(),
  firmEmail: z.string().email().max(254).nullable().optional(),
  firmWebsite: z
    .string()
    .max(200)
    .url()
    .refine((value) => value.startsWith('http://') || value.startsWith('https://'), {
      message: 'firmWebsite must be an http(s) URL',
    })
    .nullable()
    .optional(),
})

// GET /org-settings - Get org settings
orgSettingsRoute.get('/', async (c) => {
  const user = c.get('user')
  if (!user?.organizationId) {
    return c.json({ error: 'No organization' }, 403)
  }

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      name: true,
      smsLanguage: true,
      missedCallTextBack: true,
      autoSendFormClientUploadLink: true,
      defaultUploadLinkTemplateId: true,
      slug: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      governingState: true,
      governingCounty: true,
      firmPhone: true,
      firmEmail: true,
      firmWebsite: true,
    },
  })

  if (!org) {
    return c.json({ error: 'Organization not found' }, 404)
  }

  return c.json({
    name: org.name,
    smsLanguage: org.smsLanguage,
    missedCallTextBack: org.missedCallTextBack,
    autoSendFormClientUploadLink: org.autoSendFormClientUploadLink,
    defaultUploadLinkTemplateId: org.defaultUploadLinkTemplateId,
    slug: org.slug,
    address: org.address,
    city: org.city,
    state: org.state,
    zip: org.zip,
    governingState: org.governingState,
    governingCounty: org.governingCounty,
    firmPhone: org.firmPhone,
    firmEmail: org.firmEmail,
    firmWebsite: org.firmWebsite,
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

    const data = c.req.valid('json')

    // Only admins can update org settings
    if (user.orgRole !== 'org:admin' && user.role !== 'ADMIN') {
      if (user.staffId) {
        await logStaffActivity({
          organizationId: user.organizationId,
          actorStaffId: user.staffId,
          category: ACTIVITY_CATEGORIES.SETTINGS,
          targetType: ACTIVITY_TARGET_TYPES.ORGANIZATION,
          targetId: user.organizationId,
          summary: 'Denied organization settings update attempt',
          action: ACTIVITY_ACTIONS.SETTINGS.ORGANIZATION_UPDATED,
          riskLevel: ActivityRiskLevel.HIGH,
          metadata: {
            result: 'denied',
            reason: 'non_admin_org_settings_update',
            changedFields: getChangedFieldNames(data),
          },
          request: getAuditRequestContext(c),
        })
      }
      return c.json({ error: 'Admin access required' }, 403)
    }

    const changedFields = getChangedFieldNames(data)

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
        select: {
          name: true,
          smsLanguage: true,
          missedCallTextBack: true,
          autoSendFormClientUploadLink: true,
          defaultUploadLinkTemplateId: true,
          slug: true,
          clerkOrgId: true,
          address: true,
          city: true,
          state: true,
          zip: true,
          governingState: true,
          governingCounty: true,
          firmPhone: true,
          firmEmail: true,
          firmWebsite: true,
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return c.json({ error: 'SLUG_TAKEN' }, 409)
      }
      throw error
    }

    // Sync display metadata to Clerk if it changed
    if ((data.name !== undefined || data.slug !== undefined) && updated.clerkOrgId) {
      try {
        const clerkUpdate: { name?: string; slug?: string } = {}
        if (data.name !== undefined) clerkUpdate.name = data.name
        if (data.slug !== undefined) clerkUpdate.slug = data.slug ?? undefined

        await clerkClient.organizations.updateOrganization(updated.clerkOrgId, {
          ...clerkUpdate,
        })
      } catch (err) {
        console.error('[OrgSettings] Failed to sync organization metadata to Clerk:', err)
      }
    }

    if (user.staffId) {
      await logStaffActivity({
        organizationId: user.organizationId,
        actorStaffId: user.staffId,
        category: ACTIVITY_CATEGORIES.SETTINGS,
        targetType: ACTIVITY_TARGET_TYPES.ORGANIZATION,
        targetId: user.organizationId,
        summary: 'Updated organization settings',
        action: ACTIVITY_ACTIONS.SETTINGS.ORGANIZATION_UPDATED,
        riskLevel: ActivityRiskLevel.MEDIUM,
        metadata: { changedFields },
        request: getAuditRequestContext(c),
      })
    }

    return c.json({
      name: updated.name,
      smsLanguage: updated.smsLanguage,
      missedCallTextBack: updated.missedCallTextBack,
      autoSendFormClientUploadLink: updated.autoSendFormClientUploadLink,
      defaultUploadLinkTemplateId: updated.defaultUploadLinkTemplateId,
      slug: updated.slug,
      address: updated.address,
      city: updated.city,
      state: updated.state,
      zip: updated.zip,
      governingState: updated.governingState,
      governingCounty: updated.governingCounty,
      firmPhone: updated.firmPhone,
      firmEmail: updated.firmEmail,
      firmWebsite: updated.firmWebsite,
    })
  }
)

export { orgSettingsRoute }
