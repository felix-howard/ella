/**
 * Staff API routes
 * Language preference management for authenticated staff
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { ActivityRiskLevel, Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { isAdminOrManager } from '../../lib/org-scope'
import { requireAdminOrManager, requireOrg } from '../../middleware/auth'
import { resolveAvatarUrl } from '../../services/storage'
import { UPLOAD_LINK_TEMPLATE_IDS } from '../../services/sms/upload-link-template-resolver'
import type { AuthVariables } from '../../middleware/auth'
import { signatureRoute } from './signature'
import { ndaReadinessRoute } from './nda-readiness'
import { getAuditRequestContext, getChangedFieldNames, logStaffActivity } from '../../services/activity-log'
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, ACTIVITY_TARGET_TYPES } from '../../services/activity-actions'

const staffRoute = new Hono<{ Variables: AuthVariables }>()

const updateLanguageSchema = z.object({
  language: z.enum(['VI', 'EN']),
})

const updateFormSlugSchema = z.object({
  formSlug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .nullable(),
})

const updateAutoSendUploadLinkSchema = z.object({
  autoSendUploadLink: z.boolean().optional(),
  defaultUploadLinkTemplateId: z.enum(UPLOAD_LINK_TEMPLATE_IDS).nullable().optional(),
  defaultUploadLinkLanguage: z.enum(['VI', 'EN']).nullable().optional(),
})

const updateIntakeLinkSchema = z.object({
  formSlug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .nullable()
    .optional(),
  useOrgUploadLinkDefaults: z.boolean().optional(),
  autoSendUploadLink: z.boolean().optional(),
  defaultUploadLinkTemplateId: z.enum(UPLOAD_LINK_TEMPLATE_IDS).nullable().optional(),
  defaultUploadLinkLanguage: z.enum(['VI', 'EN']).nullable().optional(),
})

// GET /staff/me - Get current staff profile (including language and orgRole)
staffRoute.get('/me', async (c) => {
  const user = c.get('user')
  if (!user?.staffId) {
    return c.json({ error: 'Staff record not found' }, 404)
  }

  const staff = await prisma.staff.findUnique({
    where: { id: user.staffId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      language: true,
      avatarUrl: true,
      formSlug: true,
      autoSendUploadLink: true,
      defaultUploadLinkTemplateId: true,
      useOrgUploadLinkDefaults: true,
      defaultUploadLinkLanguage: true,
    },
  })

  if (!staff) {
    return c.json({ error: 'Staff record not found' }, 404)
  }

  return c.json({ ...staff, avatarUrl: await resolveAvatarUrl(staff.avatarUrl), orgRole: user.orgRole })
})

// GET /staff/assignable - Active staff options for admin/manager assignment workflows
staffRoute.get('/assignable', requireOrg, requireAdminOrManager, async (c) => {
  const user = c.get('user')

  const staff = await prisma.staff.findMany({
    where: {
      organizationId: user.organizationId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      formSlug: true,
    },
    orderBy: { name: 'asc' },
  })

  const data = await Promise.all(
    staff.map(async (member) => ({
      ...member,
      avatarUrl: await resolveAvatarUrl(member.avatarUrl),
    }))
  )

  return c.json({ data })
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

    await logStaffActivity({
      organizationId: user.organizationId,
      actorStaffId: user.staffId,
      category: ACTIVITY_CATEGORIES.SETTINGS,
      targetType: ACTIVITY_TARGET_TYPES.STAFF,
      targetId: user.staffId,
      summary: 'Updated staff language preference',
      action: ACTIVITY_ACTIONS.SETTINGS.STAFF_UPDATED,
      riskLevel: ActivityRiskLevel.LOW,
      metadata: { changedFields: ['language'] },
      request: getAuditRequestContext(c),
    })

    return c.json(updated)
  }
)

// Legacy compatibility route. Settings Client Intake is the canonical staff link editor.
staffRoute.patch(
  '/:staffId/form-slug',
  zValidator('json', updateFormSlugSchema),
  async (c) => {
    const user = c.get('user')
    if (!user?.staffId) {
      return c.json({ error: 'Staff record not found' }, 404)
    }
    if (!isAdminOrManager(user)) {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const targetStaffId = c.req.param('staffId')

    // Resolve 'me' to current user's staffId
    const resolvedStaffId = targetStaffId === 'me' ? user.staffId : targetStaffId

    // Verify target staff belongs to same org
    if (resolvedStaffId !== user.staffId) {
      const targetStaff = await prisma.staff.findFirst({
        where: { id: resolvedStaffId, organizationId: user.organizationId },
        select: { id: true },
      })
      if (!targetStaff) {
        return c.json({ error: 'Staff member not found' }, 404)
      }
    }

    const { formSlug } = c.req.valid('json')

    // Check uniqueness within org if setting a non-null slug
    if (formSlug) {
      const existing = await prisma.staff.findFirst({
        where: {
          organizationId: user.organizationId,
          formSlug,
          id: { not: resolvedStaffId },
        },
        select: { id: true },
      })

      if (existing) {
        return c.json(
          { error: 'SLUG_TAKEN', message: 'This form slug is already in use by another staff member.' },
          409
        )
      }
    }

    try {
      const updated = await prisma.staff.update({
        where: { id: resolvedStaffId },
        data: { formSlug },
        select: { id: true, formSlug: true },
      })

      await logStaffActivity({
        organizationId: user.organizationId,
        actorStaffId: user.staffId,
        category: ACTIVITY_CATEGORIES.SETTINGS,
        targetType: ACTIVITY_TARGET_TYPES.STAFF,
        targetId: resolvedStaffId,
        summary: 'Updated staff form link slug',
        action: ACTIVITY_ACTIONS.SETTINGS.STAFF_UPDATED,
        riskLevel: ActivityRiskLevel.MEDIUM,
        metadata: {
          changedFields: ['formSlug'],
          editedSelf: resolvedStaffId === user.staffId,
        },
        request: getAuditRequestContext(c),
      })

      return c.json(updated)
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return c.json(
          { error: 'SLUG_TAKEN', message: 'This form slug is already in use by another staff member.' },
          409
        )
      }
      throw error
    }
  }
)

// PATCH /staff/me/auto-send-upload-link - Toggle auto-send upload link
staffRoute.patch(
  '/me/auto-send-upload-link',
  zValidator('json', updateAutoSendUploadLinkSchema),
  async (c) => {
    const user = c.get('user')
    if (!user?.staffId) {
      return c.json({ error: 'Staff record not found' }, 404)
    }
    if (!isAdminOrManager(user)) {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const { autoSendUploadLink, defaultUploadLinkTemplateId, defaultUploadLinkLanguage } = c.req.valid('json')

    const updated = await prisma.staff.update({
      where: { id: user.staffId },
      data: {
        useOrgUploadLinkDefaults: false,
        ...(autoSendUploadLink !== undefined && { autoSendUploadLink }),
        ...(defaultUploadLinkTemplateId !== undefined && { defaultUploadLinkTemplateId }),
        ...(defaultUploadLinkLanguage !== undefined && { defaultUploadLinkLanguage }),
      },
      select: {
        id: true,
        useOrgUploadLinkDefaults: true,
        autoSendUploadLink: true,
        defaultUploadLinkTemplateId: true,
        defaultUploadLinkLanguage: true,
      },
    })

    await logStaffActivity({
      organizationId: user.organizationId,
      actorStaffId: user.staffId,
      category: ACTIVITY_CATEGORIES.SETTINGS,
      targetType: ACTIVITY_TARGET_TYPES.STAFF,
      targetId: user.staffId,
      summary: 'Updated staff upload link automation settings',
      action: ACTIVITY_ACTIONS.SETTINGS.STAFF_UPDATED,
      riskLevel: ActivityRiskLevel.LOW,
      metadata: {
        changedFields: getChangedFieldNames({ autoSendUploadLink, defaultUploadLinkTemplateId, defaultUploadLinkLanguage }),
      },
      request: getAuditRequestContext(c),
    })

    return c.json(updated)
  }
)

// PATCH /staff/:staffId/intake-link - Settings-owned staff intake link update
staffRoute.patch(
  '/:staffId/intake-link',
  zValidator('json', updateIntakeLinkSchema),
  async (c) => {
    const user = c.get('user')
    if (!user?.organizationId || !user.staffId) {
      return c.json({ error: 'Staff record not found' }, 404)
    }
    if (!isAdminOrManager(user)) {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const targetStaffId = c.req.param('staffId')
    const data = c.req.valid('json')

    const targetStaff = await prisma.staff.findFirst({
      where: { id: targetStaffId, organizationId: user.organizationId, isActive: true },
      select: { id: true },
    })
    if (!targetStaff) {
      return c.json({ error: 'Staff member not found' }, 404)
    }

    if (data.formSlug) {
      const existing = await prisma.staff.findFirst({
        where: {
          organizationId: user.organizationId,
          formSlug: data.formSlug,
          id: { not: targetStaffId },
        },
        select: { id: true },
      })

      if (existing) {
        return c.json(
          { error: 'SLUG_TAKEN', message: 'This form slug is already in use by another staff member.' },
          409
        )
      }
    }

    const updateData = {
      ...(data.formSlug !== undefined && { formSlug: data.formSlug }),
      ...(data.useOrgUploadLinkDefaults !== undefined && {
        useOrgUploadLinkDefaults: data.useOrgUploadLinkDefaults,
      }),
      ...(data.autoSendUploadLink !== undefined && { autoSendUploadLink: data.autoSendUploadLink }),
      ...(data.defaultUploadLinkTemplateId !== undefined && {
        defaultUploadLinkTemplateId: data.defaultUploadLinkTemplateId,
      }),
      ...(data.defaultUploadLinkLanguage !== undefined && {
        defaultUploadLinkLanguage: data.defaultUploadLinkLanguage,
      }),
    }

    try {
      const updateResult = await prisma.staff.updateMany({
        where: { id: targetStaffId, organizationId: user.organizationId, isActive: true },
        data: updateData,
      })
      if (updateResult.count === 0) {
        return c.json({ error: 'Staff member not found' }, 404)
      }

      const updated = await prisma.staff.findFirst({
        where: { id: targetStaffId, organizationId: user.organizationId, isActive: true },
        select: {
          id: true,
          formSlug: true,
          useOrgUploadLinkDefaults: true,
          autoSendUploadLink: true,
          defaultUploadLinkTemplateId: true,
          defaultUploadLinkLanguage: true,
        },
      })
      if (!updated) {
        return c.json({ error: 'Staff member not found' }, 404)
      }

      await logStaffActivity({
        organizationId: user.organizationId,
        actorStaffId: user.staffId,
        category: ACTIVITY_CATEGORIES.SETTINGS,
        targetType: ACTIVITY_TARGET_TYPES.STAFF,
        targetId: targetStaffId,
        summary: 'Updated staff intake link settings',
        action: ACTIVITY_ACTIONS.SETTINGS.STAFF_UPDATED,
        riskLevel: ActivityRiskLevel.MEDIUM,
        metadata: {
          changedFields: getChangedFieldNames(data),
          editedSelf: targetStaffId === user.staffId,
        },
        request: getAuditRequestContext(c),
      })

      return c.json(updated)
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return c.json(
          { error: 'SLUG_TAKEN', message: 'This form slug is already in use by another staff member.' },
          409
        )
      }
      throw error
    }
  }
)

// Mount signature sub-routes at /staff/me/signature
staffRoute.route('/me/signature', signatureRoute)

// Mount NDA readiness check at /staff/me/nda-readiness
staffRoute.route('/me/nda-readiness', ndaReadinessRoute)

export { staffRoute }
