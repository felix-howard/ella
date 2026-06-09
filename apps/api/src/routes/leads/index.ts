/**
 * Leads API routes
 * CRUD operations for lead management + bulk SMS + convert-to-client
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { ActivityRiskLevel } from '@ella/db'
import { BULK_SMS_MAX_RECIPIENTS } from '@ella/shared/constants'
import { prisma } from '../../lib/db'
import { getPaginationParams, buildPaginationResponse } from '../../lib/constants'
import { sanitizeTextInput } from '../../lib/validation'
import { formatPhoneToE164, sendSmsOnly, isTwilioConfigured } from '../../services/sms'
import { createMagicLink } from '../../services/magic-link'
import { sendWelcomeMessage } from '../../services/sms'
import { convertLeadToClientCore } from '../../services/leads/lead-conversion-service'
import {
  normalizeManagerIds,
  syncClientManagers,
  validateActiveOrgStaff,
} from '../../services/clients/client-managers'
import { publishMessageEvent } from '../../services/realtime/message-publisher'
import { rateLimiter } from '../../middleware/rate-limiter'
import { authMiddleware, requireAdminOrManager } from '../../middleware/auth'
import type { AuthVariables } from '../../middleware/auth'
import {
  createLeadSchema,
  adminCreateLeadSchema,
  leadIdParamSchema,
  listLeadsQuerySchema,
  updateLeadSchema,
  convertLeadSchema,
  bulkSmsSchema,
  bulkSmsPreviewTargetsSchema,
} from './schemas'
import { buildLeadWhere, buildSelectableLeadWhere } from './lead-filter-helpers'
import { getVerifiedAuth } from './auth-helpers'
import { serializePhone } from '../../lib/phone-privacy'
import {
  getAuditRequestContext,
  getChangedFieldNames,
  logStaffActivity,
  logSystemActivity,
} from '../../services/activity-log'
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, ACTIVITY_TARGET_TYPES } from '../../services/activity-actions'

const leadsRoute = new Hono<{ Variables: AuthVariables }>()

function buildSmsConsentText(orgName: string): string {
  return `I agree to receive automated texts from ${orgName} about my tax consultation.`
}

function toSafeSmsError(error: string | null | undefined): string | null {
  if (!error) return null
  if (error === 'Message sent; delivery record unavailable') return error
  const twilioCode = error.match(/TWILIO_ERROR_(\d+)/)?.[1] ?? error.match(/\b(\d{5})\b/)?.[1]
  if (twilioCode) return `SMS provider error ${twilioCode}`
  return 'SMS delivery failed'
}

// ============================================
// PUBLIC: Create Lead (from registration form)
// ============================================
leadsRoute.post(
  '/',
  rateLimiter({ keyPrefix: 'leads-create', maxRequests: 5 }),
  zValidator('json', createLeadSchema),
  async (c) => {
    const { firstName, lastName, phone, email, businessName, orgSlug, eventSlug } = c.req.valid('json')

    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
      select: { id: true, name: true, isActive: true },
    })

    if (!org || !org.isActive) {
      return c.json({ success: false, error: 'Organization not found' }, 404)
    }

    const normalizedPhone = formatPhoneToE164(phone)
    const smsConsentText = buildSmsConsentText(org.name)

    // Look up campaign tag from slug — reject if campaign doesn't exist or is archived
    let campaignTag: string | null = null
    if (eventSlug) {
      const campaign = await prisma.campaign.findUnique({
        where: { slug_organizationId: { slug: eventSlug, organizationId: org.id } },
        select: { tag: true, status: true },
      })
      if (!campaign || campaign.status !== 'ACTIVE') {
        return c.json({ success: false, error: 'Campaign not found or inactive' }, 404)
      }
      campaignTag = campaign.tag || eventSlug
    }

    try {
      const lead = await prisma.lead.create({
        data: {
          firstName: sanitizeTextInput(firstName),
          lastName: sanitizeTextInput(lastName),
          phone: normalizedPhone,
          email: email ? sanitizeTextInput(email) : null,
          businessName: businessName ? sanitizeTextInput(businessName) : null,
          smsConsentAccepted: true,
          smsConsentAcceptedAt: new Date(),
          smsConsentText,
          campaignTag,
          tags: campaignTag ? [campaignTag] : [],
          status: 'NEW',
          organizationId: org.id,
        },
      })

      await logSystemActivity({
        organizationId: org.id,
        category: ACTIVITY_CATEGORIES.LEAD,
        targetType: ACTIVITY_TARGET_TYPES.LEAD,
        targetId: lead.id,
        summary: 'Created lead from public form',
        action: ACTIVITY_ACTIONS.LEAD.CREATED,
        riskLevel: ActivityRiskLevel.LOW,
        metadata: {
          source: 'public_form',
          campaignTag,
          hasEmail: Boolean(email),
          hasBusinessName: Boolean(businessName),
          smsConsentAccepted: true,
        },
        request: getAuditRequestContext(c),
      })

      return c.json({ success: true, leadId: lead.id })
    } catch (err: unknown) {
      // Handle duplicate phone+org unique constraint violation
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
        await prisma.lead.update({
          where: { phone_organizationId: { phone: normalizedPhone, organizationId: org.id } },
          data: {
            smsConsentAccepted: true,
            smsConsentAcceptedAt: new Date(),
            smsConsentText,
          },
        })
        return c.json({ success: true, message: 'Registration received' })
      }
      throw err
    }
  }
)

// ============================================
// PROTECTED+ADMIN: Create Lead (from workspace)
// ============================================
leadsRoute.post(
  '/admin',
  authMiddleware,
  requireAdminOrManager,
  zValidator('json', adminCreateLeadSchema),
  async (c) => {
    const user = c.get('user')
    const { orgId, staffId } = getVerifiedAuth(user)
    const { firstName, lastName, phone, email, notes } = c.req.valid('json')

    const normalizedPhone = formatPhoneToE164(phone)

    try {
      const lead = await prisma.lead.create({
        data: {
          firstName: sanitizeTextInput(firstName),
          lastName: sanitizeTextInput(lastName),
          phone: normalizedPhone,
          email: email ? sanitizeTextInput(email) : null,
          notes: notes ? sanitizeTextInput(notes, 5000) : null,
          status: 'NEW',
          organizationId: orgId,
        },
      })

      await logStaffActivity({
        organizationId: orgId,
        actorStaffId: staffId,
        category: ACTIVITY_CATEGORIES.LEAD,
        targetType: ACTIVITY_TARGET_TYPES.LEAD,
        targetId: lead.id,
        summary: 'Created lead',
        action: ACTIVITY_ACTIONS.LEAD.CREATED,
        riskLevel: ActivityRiskLevel.LOW,
        metadata: {
          source: 'workspace_admin',
          hasEmail: Boolean(email),
          hasNotes: Boolean(notes),
        },
        request: getAuditRequestContext(c),
      })

      return c.json({ success: true, data: { ...lead, phone: serializePhone(user, lead.phone) } })
    } catch (err: unknown) {
      // Handle duplicate phone+org unique constraint violation
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
        return c.json({ success: false, error: 'A lead with this phone already exists' }, 409)
      }
      throw err
    }
  }
)

// ============================================
// PROTECTED+ADMIN: List Leads (org-scoped)
// ============================================
leadsRoute.get(
  '/',
  authMiddleware,
  requireAdminOrManager,
  zValidator('query', listLeadsQuerySchema),
  async (c) => {
    const user = c.get('user')
    const { orgId } = getVerifiedAuth(user)
    const { page, limit, status, search, tag, includeConverted } = c.req.valid('query')
    const { skip } = getPaginationParams(page, limit)

    const where = buildLeadWhere({ organizationId: orgId, status, search, tag, includeConverted })
    const selectableWhere = buildSelectableLeadWhere({ organizationId: orgId, status, search, tag, includeConverted })

    const [leads, total, selectableTotal] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          businessName: true,
          status: true,
          campaignTag: true,
          tags: true,
          notes: true,
          createdAt: true,
          convertedToId: true,
          smsSendLogs: {
            orderBy: { sentAt: 'desc' },
            take: 1,
            select: {
              status: true,
              error: true,
              sentAt: true,
            },
          },
        },
      }),
      prisma.lead.count({ where }),
      prisma.lead.count({ where: selectableWhere }),
    ])

    return c.json({
      success: true,
      data: leads.map((lead) => {
        const { smsSendLogs, ...rest } = lead
        return {
          ...rest,
          phone: serializePhone(user, lead.phone),
          latestSms: smsSendLogs?.[0]
            ? {
                ...smsSendLogs[0],
                error: toSafeSmsError(smsSendLogs[0].error),
              }
            : null,
        }
      }),
      pagination: buildPaginationResponse(page, limit, total),
      selectableTotal,
      bulkSmsMaxRecipients: BULK_SMS_MAX_RECIPIENTS,
    })
  }
)

// ============================================
// PROTECTED+ADMIN: Preview Bulk SMS Targets
// ============================================
leadsRoute.post(
  '/bulk-sms/preview-targets',
  authMiddleware,
  requireAdminOrManager,
  zValidator('json', bulkSmsPreviewTargetsSchema),
  async (c) => {
    const { orgId } = getVerifiedAuth(c.get('user'))
    const { status, search, tag, includeConverted, limit } = c.req.valid('json')
    const where = buildSelectableLeadWhere({ organizationId: orgId, status, search, tag, includeConverted })

    const [selectableTotal, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true },
      }),
    ])

    return c.json({
      success: true,
      data: {
        total: selectableTotal,
        selectableTotal,
        returnedIds: leads.map((lead) => lead.id),
        limit: BULK_SMS_MAX_RECIPIENTS,
        truncated: selectableTotal > leads.length,
      },
    })
  }
)

// ============================================
// PROTECTED+ADMIN: Get Distinct Tags
// ============================================
leadsRoute.get(
  '/tags',
  authMiddleware,
  requireAdminOrManager,
  async (c) => {
    const { orgId } = getVerifiedAuth(c.get('user'))
    const result = await prisma.$queryRaw<Array<{ tag: string }>>`
      SELECT DISTINCT unnest(tags) as tag
      FROM "Lead"
      WHERE "organizationId" = ${orgId}
      ORDER BY tag
    `
    return c.json({ success: true, data: result.map((r) => r.tag) })
  }
)

// ============================================
// PROTECTED+ADMIN: Aggregate Stats (KPI bar)
// ============================================
leadsRoute.get(
  '/stats',
  authMiddleware,
  requireAdminOrManager,
  async (c) => {
    const { orgId } = getVerifiedAuth(c.get('user'))
    const grouped = await prisma.lead.groupBy({
      by: ['status'],
      where: { organizationId: orgId },
      _count: { _all: true },
    })

    const counts: Record<string, number> = { NEW: 0, SENT: 0, CONTACTED: 0, CONVERTED: 0, LOST: 0 }
    let total = 0
    for (const g of grouped) {
      counts[g.status] = g._count._all
      total += g._count._all
    }

    const conversionRate = total > 0 ? Math.round((counts.CONVERTED / total) * 100) : 0

    return c.json({
      success: true,
      data: {
        total,
        new: counts.NEW,
        sent: counts.SENT,
        contacted: counts.CONTACTED,
        converted: counts.CONVERTED,
        lost: counts.LOST,
        conversionRate,
      },
    })
  }
)

// ============================================
// PROTECTED+ADMIN: Get Lead Detail
// ============================================
leadsRoute.get(
  '/:id',
  authMiddleware,
  requireAdminOrManager,
  zValidator('param', leadIdParamSchema),
  async (c) => {
    const user = c.get('user')
    const { orgId } = getVerifiedAuth(user)
    const { id } = c.req.valid('param')

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: orgId },
      include: {
        smsSendLogs: {
          orderBy: { sentAt: 'desc' },
          take: 20,
          select: {
            id: true,
            status: true,
            error: true,
            sentAt: true,
          },
        },
      },
    })

    if (!lead) {
      return c.json({ success: false, error: 'Lead not found' }, 404)
    }

    // Enrich with campaign name if campaign tag exists
    let campaignName: string | null = null
    if (lead.campaignTag) {
      const campaign = await prisma.campaign.findUnique({
        where: { tag_organizationId: { tag: lead.campaignTag, organizationId: orgId } },
        select: { name: true },
      })
      campaignName = campaign?.name || null
    }

    return c.json({
      success: true,
      data: {
        ...lead,
        phone: serializePhone(user, lead.phone),
        campaignName,
        smsSendLogs: lead.smsSendLogs.map((log) => ({
          ...log,
          error: toSafeSmsError(log.error),
        })),
        latestSms: lead.smsSendLogs?.[0]
          ? {
              status: lead.smsSendLogs[0].status,
              error: toSafeSmsError(lead.smsSendLogs[0].error),
              sentAt: lead.smsSendLogs[0].sentAt,
            }
          : null,
      },
    })
  }
)

// ============================================
// PROTECTED+ADMIN: Update Lead
// ============================================
leadsRoute.patch(
  '/:id',
  authMiddleware,
  requireAdminOrManager,
  zValidator('param', leadIdParamSchema),
  zValidator('json', updateLeadSchema),
  async (c) => {
    const user = c.get('user')
    const { orgId, staffId } = getVerifiedAuth(user)
    const { id } = c.req.valid('param')
    const updates = c.req.valid('json')

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: orgId },
    })

    if (!lead) {
      return c.json({ success: false, error: 'Lead not found' }, 404)
    }

    const sanitized: Record<string, unknown> = {}
    if (updates.status) sanitized.status = updates.status
    if (updates.notes !== undefined) sanitized.notes = updates.notes ? sanitizeTextInput(updates.notes, 5000) : null
    if (updates.firstName) sanitized.firstName = sanitizeTextInput(updates.firstName)
    if (updates.lastName) sanitized.lastName = sanitizeTextInput(updates.lastName)
    if (updates.email !== undefined) sanitized.email = updates.email ? sanitizeTextInput(updates.email) : null
    if (updates.businessName !== undefined) sanitized.businessName = updates.businessName ? sanitizeTextInput(updates.businessName) : null
    if (updates.tags !== undefined) sanitized.tags = updates.tags.map(t => t.trim().toLowerCase())

    const updated = await prisma.lead.update({
      where: { id },
      data: sanitized,
    })

    await logStaffActivity({
      organizationId: orgId,
      actorStaffId: staffId,
      category: ACTIVITY_CATEGORIES.LEAD,
      targetType: ACTIVITY_TARGET_TYPES.LEAD,
      targetId: id,
      summary: 'Updated lead',
      action: ACTIVITY_ACTIONS.LEAD.UPDATED,
      riskLevel: ActivityRiskLevel.LOW,
      metadata: {
        changedFields: getChangedFieldNames(sanitized),
      },
      request: getAuditRequestContext(c),
    })

    return c.json({ success: true, data: { ...updated, phone: serializePhone(user, updated.phone) } })
  }
)

// ============================================
// PROTECTED+ADMIN: Check Duplicate Phone Before Convert
// ============================================
leadsRoute.get(
  '/:id/convert-check',
  authMiddleware,
  requireAdminOrManager,
  zValidator('param', leadIdParamSchema),
  async (c) => {
    const user = c.get('user')
    const { orgId } = getVerifiedAuth(user)
    const { id } = c.req.valid('param')

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: orgId },
      select: { phone: true },
    })

    if (!lead) {
      return c.json({ success: false, error: 'Lead not found' }, 404)
    }

    const existingClient = await prisma.client.findFirst({
      where: { phone: lead.phone, clientType: 'INDIVIDUAL', organizationId: orgId },
      select: { id: true, firstName: true, lastName: true, phone: true },
    })

    return c.json({
      success: true,
      hasDuplicate: !!existingClient,
      existingClient: existingClient
        ? { ...existingClient, phone: serializePhone(user, existingClient.phone) }
        : undefined,
    })
  }
)

// ============================================
// PROTECTED+ADMIN: Convert Lead to Client
// ============================================
leadsRoute.post(
  '/:id/convert',
  authMiddleware,
  requireAdminOrManager,
  zValidator('param', leadIdParamSchema),
  zValidator('json', convertLeadSchema),
  async (c) => {
    const { orgId, staffId } = getVerifiedAuth(c.get('user'))
    const { id } = c.req.valid('param')
    const { managedById, staffIds, language, taxYear, sendWelcomeSms, customMessage, firstName, lastName, email } = c.req.valid('json')
    const managerIds = normalizeManagerIds({ staffId: managedById ?? null, staffIds })

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: orgId },
    })

    if (!lead) {
      return c.json({ success: false, error: 'Lead not found' }, 404)
    }

    if (lead.status === 'CONVERTED') {
      return c.json({ success: false, error: 'Lead already converted' }, 400)
    }

    // Sanitize and resolve edited fields
    const sanitizedFirstName = firstName ? sanitizeTextInput(firstName) : undefined
    const sanitizedLastName = lastName ? sanitizeTextInput(lastName) : undefined
    const sanitizedEmail = email !== undefined ? (email ? sanitizeTextInput(email) : null) : undefined
    const sanitizedCustomMessage = customMessage ? sanitizeTextInput(customMessage, 500) : undefined

    const finalFirstName = sanitizedFirstName || lead.firstName
    const finalLastName = sanitizedLastName || lead.lastName
    const finalEmail = sanitizedEmail !== undefined ? sanitizedEmail : lead.email

    const result = await prisma.$transaction(async (tx) => {
      // Manager validation gates client creation — keep it in the route (the
      // webhook auto-convert path has no managers to validate).
      const staffValid = await validateActiveOrgStaff(tx, orgId, managerIds)
      if (!staffValid) {
        return { duplicate: false as const, staffNotFound: true as const }
      }

      const converted = await convertLeadToClientCore(tx, {
        lead,
        organizationId: orgId,
        firstName: finalFirstName,
        lastName: finalLastName,
        email: finalEmail,
        language,
        taxYear,
        createdByStaffId: staffId,
        managedById: managerIds[0] || null,
        leadUpdateOverrides: {
          ...(sanitizedFirstName ? { firstName: sanitizedFirstName } : {}),
          ...(sanitizedLastName ? { lastName: sanitizedLastName } : {}),
          ...(sanitizedEmail !== undefined ? { email: sanitizedEmail } : {}),
        },
      })
      if (converted.duplicate) {
        return { duplicate: true as const, existingClient: converted.existingClient }
      }

      await syncClientManagers(tx, {
        clientIds: [converted.client.id],
        organizationId: orgId,
        staffIds: managerIds,
      })

      return converted
    })

    if (result.duplicate) {
      return c.json({
        success: false,
        error: 'Client with this phone already exists',
        existingClient: result.existingClient,
      }, 409)
    }

    if ('staffNotFound' in result) {
      return c.json({ success: false, error: 'Staff not found' }, 404)
    }

    console.info('[LeadConvert] migration counts', {
      leadId: id,
      messages: result.migratedCount,
      agreements: result.agreementMigratedCount,
      conversationId: result.conversation.id,
    })

    await logStaffActivity({
      organizationId: orgId,
      actorStaffId: staffId,
      category: ACTIVITY_CATEGORIES.LEAD,
      targetType: ACTIVITY_TARGET_TYPES.LEAD,
      targetId: id,
      summary: 'Converted lead to client',
      action: ACTIVITY_ACTIONS.LEAD.CONVERTED,
      riskLevel: ActivityRiskLevel.MEDIUM,
      metadata: {
        clientId: result.client.id,
        caseId: result.taxCase.id,
        conversationId: result.conversation.id,
        migratedMessages: result.migratedCount,
        migratedAgreements: result.agreementMigratedCount,
        welcomeSmsRequested: sendWelcomeSms,
      },
      request: getAuditRequestContext(c),
    })

    // Send welcome SMS if requested (outside transaction)
    if (sendWelcomeSms && isTwilioConfigured()) {
      try {
        const clientFullName = `${result.client.firstName} ${result.client.lastName}`
        const magicLink = await createMagicLink(result.taxCase.id, { clientName: clientFullName })
        await sendWelcomeMessage(
          result.taxCase.id,
          clientFullName,
          result.client.phone,
          magicLink,
          taxYear,
          language,
          sanitizedCustomMessage,
          staffId
        )
      } catch (err) {
        console.error('[Leads] Welcome SMS failed:', err)
      }
    }

    return c.json({
      success: true,
      clientId: result.client.id,
      engagementId: result.engagement.id,
    })
  }
)

// ============================================
// PROTECTED+ADMIN: Bulk SMS
// ============================================
leadsRoute.post(
  '/bulk-sms',
  authMiddleware,
  requireAdminOrManager,
  zValidator('json', bulkSmsSchema),
  async (c) => {
    const { orgId, staffId } = getVerifiedAuth(c.get('user'))
    const { leadIds, message, formLinkType, staffSlug } = c.req.valid('json')

    if (leadIds.length > BULK_SMS_MAX_RECIPIENTS) {
      return c.json({
        success: false,
        error: 'Bulk SMS recipient limit exceeded',
        code: 'BULK_SMS_LIMIT_EXCEEDED',
        count: leadIds.length,
        limit: BULK_SMS_MAX_RECIPIENTS,
      }, 400)
    }

    // Early check: Twilio must be configured
    if (!isTwilioConfigured()) {
      return c.json({
        success: false,
        error: 'SMS not configured',
        code: 'SMS_NOT_CONFIGURED',
        limit: BULK_SMS_MAX_RECIPIENTS,
      }, 503)
    }

    // Validate staff formSlug if staff form link requested
    let staffFormSlug: string | null = null
    if (formLinkType === 'staff') {
      if (!staffSlug) {
        return c.json({ success: false, error: 'staffSlug required for staff form link' }, 400)
      }
      const staff = await prisma.staff.findFirst({
        where: { formSlug: staffSlug, organizationId: orgId },
        select: { formSlug: true },
      })
      if (!staff || !staff.formSlug) {
        return c.json({ success: false, error: 'Staff not found' }, 404)
      }
      staffFormSlug = staff.formSlug
    }

    // Get org slug for form URL
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { slug: true, clerkOrgId: true },
    })

    if (!org) {
      return c.json({ success: false, error: 'Organization not found' }, 404)
    }

    // Validate all leads belong to org
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        organizationId: orgId,
      },
      select: { id: true, firstName: true, phone: true, status: true },
    })

    if (leads.length !== leadIds.length) {
      return c.json({ success: false, error: 'Some leads not found or not in organization' }, 400)
    }

    const convertedLeadIds = leads.filter((lead) => lead.status === 'CONVERTED').map((lead) => lead.id)
    if (convertedLeadIds.length > 0) {
      return c.json({
        success: false,
        error: 'Converted leads cannot receive bulk SMS',
        code: 'BULK_SMS_CONVERTED_LEADS',
        leadIds: convertedLeadIds,
      }, 400)
    }

    // Build form URL
    const portalBaseUrl = process.env.PORTAL_URL || 'https://portal.ellatax.com'
    const formUrl = staffFormSlug
      ? `${portalBaseUrl}/form/${org.slug}/${staffFormSlug}`
      : `${portalBaseUrl}/form/${org.slug}`

    let sent = 0
    let failed = 0
    const errors: string[] = []
    const createdMessages: Array<{ id: string; leadId: string }> = []
    const successfulLeadIds: string[] = []
    const recipientResults: Array<{ leadId: string; name: string; status: 'sent' | 'failed'; error?: string }> = []

    // Process SMS in batches of 10 for concurrency control
    const BATCH_SIZE = 10
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map(async (lead) => {
          const personalizedMessage = message
            .replace(/\{\{firstName\}\}/g, lead.firstName)
            .replace(/\{\{formLink\}\}/g, formUrl)

          const smsResult = await sendSmsOnly(lead.phone, personalizedMessage).catch(() => null)
          if (!smsResult) {
            return {
              leadId: lead.id,
              name: lead.firstName,
              status: 'failed' as const,
              error: 'SMS delivery failed',
            }
          }

          const safeSmsError = toSafeSmsError(smsResult.error)
          const twilioStatus = smsResult.success
            ? (smsResult.status || 'queued')
            : `ERROR: ${safeSmsError ?? 'SMS delivery failed'}`

          try {
            const [messageRecord] = await prisma.$transaction([
              prisma.message.create({
                data: {
                  leadId: lead.id,
                  channel: 'SMS',
                  direction: 'OUTBOUND',
                  content: personalizedMessage,
                  twilioSid: smsResult.sid ?? null,
                  twilioStatus,
                  sentById: staffId,
                },
              }),
              prisma.smsSendLog.create({
                data: {
                  leadId: lead.id,
                  message: personalizedMessage,
                  status: smsResult.success ? 'SENT' : 'FAILED',
                  twilioSid: smsResult.sid ?? null,
                  error: safeSmsError,
                  sentById: staffId,
                  organizationId: orgId,
                },
              }),
            ])
            createdMessages.push({ id: messageRecord.id, leadId: lead.id })

            if (smsResult.success) {
              return { leadId: lead.id, name: lead.firstName, status: 'sent' as const }
            }
            return {
              leadId: lead.id,
              name: lead.firstName,
              status: 'failed' as const,
              error: safeSmsError ?? 'SMS delivery failed',
            }
          } catch (err) {
            console.error('[Leads] Bulk SMS persistence failed:', err)
            if (smsResult.success) {
              return {
                leadId: lead.id,
                name: lead.firstName,
                status: 'sent' as const,
                error: 'Message sent; delivery record unavailable',
              }
            }
            return {
              leadId: lead.id,
              name: lead.firstName,
              status: 'failed' as const,
              error: safeSmsError ?? 'SMS delivery failed',
            }
          }
        })
      )

      for (const result of results) {
        recipientResults.push(result)
        if (result.status === 'sent') {
          sent++
          if (!result.error) successfulLeadIds.push(result.leadId)
        } else {
          failed++
          errors.push(`${result.name}: ${result.error ?? 'SMS delivery failed'}`)
        }
      }
    }

    for (const messageRecord of createdMessages) {
      publishMessageEvent(org.clerkOrgId, {
        leadId: messageRecord.leadId,
        messageId: messageRecord.id,
        direction: 'OUTBOUND',
        channel: 'SMS',
        timestamp: new Date().toISOString(),
      }).catch(() => {})
    }

    // Only immediate Twilio successes move NEW leads to SENT. Failed attempts
    // stay in their current lifecycle state; SmsSendLog carries delivery detail.
    if (successfulLeadIds.length > 0) {
      try {
        await prisma.lead.updateMany({
          where: {
            id: { in: successfulLeadIds },
            organizationId: orgId,
            status: 'NEW',
          },
          data: { status: 'SENT' },
        })
      } catch (err) {
        console.error('[Leads] Bulk SMS lead status update failed:', err)
      }
    }

    try {
      await logStaffActivity({
        organizationId: orgId,
        actorStaffId: staffId,
        category: ACTIVITY_CATEGORIES.LEAD,
        targetType: ACTIVITY_TARGET_TYPES.ORGANIZATION,
        targetId: orgId,
        summary: 'Sent bulk SMS to leads',
        action: ACTIVITY_ACTIONS.LEAD.MESSAGE_SENT,
        riskLevel: ActivityRiskLevel.MEDIUM,
        metadata: {
          channel: 'SMS',
          count: leads.length,
          sent,
          failed,
          messageIds: createdMessages.map((m) => m.id),
          formLinkType,
          usedStaffFormSlug: Boolean(staffFormSlug),
        },
        request: getAuditRequestContext(c),
      })
    } catch (err) {
      console.error('[Leads] Bulk SMS activity log failed:', err)
    }

    return c.json({
      success: true,
      sent,
      failed,
      limit: BULK_SMS_MAX_RECIPIENTS,
      results: recipientResults,
      errors: errors.length > 0 ? errors : undefined,
    })
  }
)

// ============================================
// PROTECTED+ADMIN: Delete Lead
// ============================================
leadsRoute.delete(
  '/:id',
  authMiddleware,
  requireAdminOrManager,
  zValidator('param', leadIdParamSchema),
  async (c) => {
    const { orgId, staffId } = getVerifiedAuth(c.get('user'))
    const { id } = c.req.valid('param')

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: orgId },
    })

    if (!lead) {
      return c.json({ success: false, error: 'Lead not found' }, 404)
    }

    await prisma.lead.delete({ where: { id } })

    await logStaffActivity({
      organizationId: orgId,
      actorStaffId: staffId,
      category: ACTIVITY_CATEGORIES.LEAD,
      targetType: ACTIVITY_TARGET_TYPES.LEAD,
      targetId: id,
      summary: 'Deleted lead',
      action: ACTIVITY_ACTIONS.LEAD.DELETED,
      riskLevel: ActivityRiskLevel.HIGH,
      metadata: {
        previousStatus: lead.status,
        convertedToId: lead.convertedToId,
      },
      request: getAuditRequestContext(c),
    })

    return c.json({ success: true })
  }
)

export { leadsRoute }
