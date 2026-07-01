/**
 * Organization Settings API routes
 * Manage org-level settings (e.g., SMS language preference)
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { ActivityRiskLevel, Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { sanitizeTextInput } from '../../lib/validation'
import { isOrgAdmin } from '../../lib/org-scope'
import { clerkClient } from '../../lib/clerk-client'
import { config } from '../../lib/config'
import { getEffectiveFirmPhone } from '../../lib/firm-contact'
import { formatPhoneToE164, isValidPhoneNumber } from '../../services/sms'
import { UPLOAD_LINK_TEMPLATE_IDS } from '../../services/sms/upload-link-template-resolver'
import type { AuthVariables } from '../../middleware/auth'
import { getAuditRequestContext, getChangedFieldNames, logStaffActivity } from '../../services/activity-log'
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, ACTIVITY_TARGET_TYPES } from '../../services/activity-actions'

const orgSettingsRoute = new Hono<{ Variables: AuthVariables }>()
type RegistrationHeaderMode = 'DEFAULT' | 'CUSTOM' | 'HIDDEN'

async function getDeniedRequestChangedFields(request: Request) {
  try {
    const body = await request.clone().json()
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      return getChangedFieldNames(body as Record<string, unknown>)
    }
  } catch {
    // Invalid JSON still follows the authorization denial path.
  }
  return []
}

const updateOrgSettingsSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  registrationHeaderMode: z.enum(['DEFAULT', 'CUSTOM', 'HIDDEN']).optional(),
  registrationTitle: z.string().max(120).nullable().optional(),
  registrationSubtitle: z.string().max(240).nullable().optional(),
  smsLanguage: z.enum(['VI', 'EN']).optional(),
  missedCallTextBack: z.boolean().optional(),
  autoSendFormClientUploadLink: z.boolean().optional(),
  calculatorAgreementPaymentMode: z.enum(['AUTO_SEND', 'STAFF_REVIEW']).optional(),
  defaultUploadLinkTemplateId: z.enum(UPLOAD_LINK_TEMPLATE_IDS).nullable().optional(),
  defaultUploadLinkLanguage: z.enum(['VI', 'EN']).optional(),
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
      registrationHeaderMode: true,
      registrationTitle: true,
      registrationSubtitle: true,
      smsLanguage: true,
      missedCallTextBack: true,
      autoSendFormClientUploadLink: true,
      calculatorAgreementPaymentMode: true,
      defaultUploadLinkTemplateId: true,
      defaultUploadLinkLanguage: true,
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
    registrationHeaderMode: org.registrationHeaderMode,
    registrationTitle: org.registrationTitle,
    registrationSubtitle: org.registrationSubtitle,
    smsLanguage: org.smsLanguage,
    missedCallTextBack: org.missedCallTextBack,
    autoSendFormClientUploadLink: org.autoSendFormClientUploadLink,
    calculatorAgreementPaymentMode: org.calculatorAgreementPaymentMode,
    defaultUploadLinkTemplateId: org.defaultUploadLinkTemplateId,
    defaultUploadLinkLanguage: org.defaultUploadLinkLanguage,
    slug: org.slug,
    address: org.address,
    city: org.city,
    state: org.state,
    zip: org.zip,
    governingState: org.governingState,
    governingCounty: org.governingCounty,
    firmPhone: org.firmPhone,
    twilioInboundNumber: getEffectiveFirmPhone(org.firmPhone),
    firmEmail: org.firmEmail,
    firmWebsite: org.firmWebsite,
  })
})

// GET /org-settings/intake-links - List org and staff intake link settings
orgSettingsRoute.get('/intake-links', async (c) => {
  const user = c.get('user')
  if (!user?.organizationId) {
    return c.json({ error: 'No organization' }, 403)
  }
  const isAdmin = isOrgAdmin(user)
  const currentStaffId = user.staffId
  const staffWhere: Prisma.StaffWhereInput = { isActive: true }
  if (!isAdmin) {
    if (!currentStaffId) {
      return c.json({ error: 'Staff record not found' }, 404)
    }
    staffWhere.id = currentStaffId
  }

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      autoSendFormClientUploadLink: true,
      defaultUploadLinkTemplateId: true,
      defaultUploadLinkLanguage: true,
      staff: {
        where: staffWhere,
        select: {
          id: true,
          name: true,
          role: true,
          formSlug: true,
          useOrgUploadLinkDefaults: true,
          autoSendUploadLink: true,
          defaultUploadLinkTemplateId: true,
          defaultUploadLinkLanguage: true,
        },
        orderBy: { name: 'asc' },
      },
    },
  })

  if (!org) {
    return c.json({ error: 'Organization not found' }, 404)
  }

  const orgDefaults = {
    autoSendUploadLink: org.autoSendFormClientUploadLink,
    defaultUploadLinkTemplateId: org.defaultUploadLinkTemplateId,
    defaultUploadLinkLanguage: org.defaultUploadLinkLanguage,
  }

  return c.json({
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      ...orgDefaults,
    },
    generalLink: {
      urlPath: org.slug ? `/form/${org.slug}` : null,
      ...orgDefaults,
    },
    staffLinks: org.staff.map((staff) => {
      const effectiveSettings = staff.useOrgUploadLinkDefaults
        ? orgDefaults
        : {
            autoSendUploadLink: staff.autoSendUploadLink,
            defaultUploadLinkTemplateId: staff.defaultUploadLinkTemplateId,
            defaultUploadLinkLanguage: staff.defaultUploadLinkLanguage ?? org.defaultUploadLinkLanguage,
          }

      return {
        ...staff,
        urlPath: org.slug && staff.formSlug ? `/form/${org.slug}/${staff.formSlug}` : null,
        effectiveAutoSendUploadLink: effectiveSettings.autoSendUploadLink,
        effectiveDefaultUploadLinkTemplateId: effectiveSettings.defaultUploadLinkTemplateId,
        effectiveDefaultUploadLinkLanguage: effectiveSettings.defaultUploadLinkLanguage,
      }
    }),
  })
})

// PATCH /org-settings - Update org settings (admin only)
orgSettingsRoute.patch(
  '/',
  async (c, next) => {
    const user = c.get('user')
    if (!user?.organizationId) {
      return c.json({ error: 'No organization' }, 403)
    }

    if (!isOrgAdmin(user)) {
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
            changedFields: await getDeniedRequestChangedFields(c.req.raw),
          },
          request: getAuditRequestContext(c),
        })
      }
      return c.json({ error: 'Admin access required' }, 403)
    }

    await next()
  },
  zValidator('json', updateOrgSettingsSchema),
  async (c) => {
    const user = c.get('user')
    if (!user?.organizationId) {
      return c.json({ error: 'No organization' }, 403)
    }

    const data = c.req.valid('json')

    const changedFields = getChangedFieldNames(data)
    const registrationHeaderMode = data.registrationHeaderMode
    const shouldClearRegistrationCopy =
      registrationHeaderMode !== undefined && registrationHeaderMode !== 'CUSTOM'
    const updateData = {
      ...data,
      ...(shouldClearRegistrationCopy
        ? { registrationTitle: null }
        : data.registrationTitle !== undefined
        ? { registrationTitle: data.registrationTitle ? sanitizeTextInput(data.registrationTitle, 120) : null }
        : {}),
      ...(shouldClearRegistrationCopy
        ? { registrationSubtitle: null }
        : data.registrationSubtitle !== undefined
        ? { registrationSubtitle: data.registrationSubtitle ? sanitizeTextInput(data.registrationSubtitle, 240) : null }
        : {}),
      ...(data.firmPhone !== undefined
        ? { firmPhone: data.firmPhone?.trim() ? formatPhoneToE164(data.firmPhone) : null }
        : {}),
    } satisfies Partial<{
      registrationHeaderMode: RegistrationHeaderMode
      registrationTitle: string | null
      registrationSubtitle: string | null
      firmPhone: string | null
    }> & Record<string, unknown>

    // Validate slug uniqueness if provided
    if (data.slug) {
      const existing = await prisma.organization.findFirst({
        where: { slug: data.slug, id: { not: user.organizationId } },
      })
      if (existing) {
        return c.json({ error: 'SLUG_TAKEN' }, 409)
      }
    }

    if (updateData.firmPhone && !isValidPhoneNumber(updateData.firmPhone)) {
      return c.json({ error: 'INVALID_FIRM_PHONE' }, 400)
    }

    if (data.firmPhone !== undefined && config.twilio.phoneNumber) {
      if (updateData.firmPhone !== config.twilio.phoneNumber) {
        return c.json({ error: 'FIRM_PHONE_LOCKED_TO_TWILIO_NUMBER' }, 400)
      }
    }

    if (updateData.firmPhone) {
      const existing = await prisma.organization.findFirst({
        where: {
          isActive: true,
          firmPhone: updateData.firmPhone,
          id: { not: user.organizationId },
        },
        select: { id: true },
      })
      if (existing) {
        return c.json({ error: 'FIRM_PHONE_TAKEN' }, 409)
      }
    }

    let updated
    try {
      updated = await prisma.organization.update({
        where: { id: user.organizationId },
        data: updateData,
        select: {
          name: true,
          registrationHeaderMode: true,
          registrationTitle: true,
          registrationSubtitle: true,
          smsLanguage: true,
          missedCallTextBack: true,
          autoSendFormClientUploadLink: true,
          calculatorAgreementPaymentMode: true,
          defaultUploadLinkTemplateId: true,
          defaultUploadLinkLanguage: true,
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
        const target = error.meta?.target
        const targetText = Array.isArray(target) ? target.join(',') : String(target ?? '')
        if (targetText.includes('firmPhone') || targetText.includes('Organization_active_firmPhone_key')) {
          return c.json({ error: 'FIRM_PHONE_TAKEN' }, 409)
        }
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
      registrationHeaderMode: updated.registrationHeaderMode,
      registrationTitle: updated.registrationTitle,
      registrationSubtitle: updated.registrationSubtitle,
      smsLanguage: updated.smsLanguage,
      missedCallTextBack: updated.missedCallTextBack,
      autoSendFormClientUploadLink: updated.autoSendFormClientUploadLink,
      calculatorAgreementPaymentMode: updated.calculatorAgreementPaymentMode,
      defaultUploadLinkTemplateId: updated.defaultUploadLinkTemplateId,
      defaultUploadLinkLanguage: updated.defaultUploadLinkLanguage,
      slug: updated.slug,
      address: updated.address,
      city: updated.city,
      state: updated.state,
      zip: updated.zip,
      governingState: updated.governingState,
      governingCounty: updated.governingCounty,
      firmPhone: updated.firmPhone,
      twilioInboundNumber: getEffectiveFirmPhone(updated.firmPhone),
      firmEmail: updated.firmEmail,
      firmWebsite: updated.firmWebsite,
    })
  }
)

export { orgSettingsRoute }
