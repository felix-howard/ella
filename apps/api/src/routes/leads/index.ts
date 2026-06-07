/**
 * Leads API routes
 * CRUD operations for lead management + bulk SMS + convert-to-client
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { ActivityRiskLevel } from '@ella/db'
import { prisma } from '../../lib/db'
import { getPaginationParams, buildPaginationResponse } from '../../lib/constants'
import { sanitizeSearchInput, sanitizeTextInput } from '../../lib/validation'
import { formatPhoneToE164, sendSmsOnly, isTwilioConfigured } from '../../services/sms'
import { createMagicLink } from '../../services/magic-link'
import { sendWelcomeMessage } from '../../services/sms'
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
} from './schemas'
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

    const where: Record<string, unknown> = { organizationId: orgId }

    if (status) {
      where.status = status
    } else if (!includeConverted) {
      where.status = { not: 'CONVERTED' }
    }

    if (tag) {
      where.tags = { has: tag }
    }

    if (search) {
      const sanitized = sanitizeSearchInput(search)
      where.OR = [
        { firstName: { contains: sanitized, mode: 'insensitive' } },
        { lastName: { contains: sanitized, mode: 'insensitive' } },
        { phone: { contains: sanitized } },
        { businessName: { contains: sanitized, mode: 'insensitive' } },
      ]
    }

    const [leads, total] = await Promise.all([
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
        },
      }),
      prisma.lead.count({ where }),
    ])

    return c.json({
      success: true,
      data: leads.map((lead) => ({ ...lead, phone: serializePhone(user, lead.phone) })),
      pagination: buildPaginationResponse(page, limit, total),
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
            message: true,
            status: true,
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

    return c.json({ success: true, data: { ...lead, phone: serializePhone(user, lead.phone), campaignName } })
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

      // Duplicate check inside transaction to prevent race conditions
      const existingClient = await tx.client.findFirst({
        where: { phone: lead.phone, clientType: 'INDIVIDUAL', organizationId: orgId },
        select: { id: true, firstName: true, lastName: true },
      })

      if (existingClient) {
        return { duplicate: true as const, existingClient }
      }

      const staffValid = await validateActiveOrgStaff(tx, orgId, managerIds)
      if (!staffValid) {
        return { duplicate: false as const, staffNotFound: true as const }
      }

      const client = await tx.client.create({
        data: {
          firstName: finalFirstName,
          lastName: finalLastName,
          name: `${finalFirstName} ${finalLastName}`,
          phone: lead.phone,
          email: finalEmail,
          language,
          source: 'CONVERTED',
          tags: lead.tags || [],
          notes: lead.notes,
          organizationId: orgId,
          managedById: managerIds[0] || null,
          createdById: staffId,
        },
      })
      await syncClientManagers(tx, { clientIds: [client.id], organizationId: orgId, staffIds: managerIds })

      const engagement = await tx.taxEngagement.create({
        data: {
          clientId: client.id,
          taxYear,
          status: 'DRAFT',
        },
      })

      const taxCase = await tx.taxCase.create({
        data: {
          clientId: client.id,
          engagementId: engagement.id,
          taxYear,
          taxTypes: ['FORM_1040'],
          status: 'INTAKE',
        },
      })

      // Lead → Client conversion always produces a standalone INDIVIDUAL client,
      // so we always create a conversation to host reassigned lead messages.
      const conversation = await tx.conversation.create({
        data: { caseId: taxCase.id, lastMessageAt: new Date() },
      })

      // Reassign pre-conversion lead messages to the new conversation.
      // UPDATE (not copy) preserves message IDs and createdAt for continuous thread history.
      const migrated = await tx.message.updateMany({
        where: { leadId: id },
        data: { conversationId: conversation.id, leadId: null },
      })

      // Link all agreements from this lead to the new client. organizationId
      // filter is defense-in-depth (leadId is already org-scoped). Pending SENT
      // agreements remain signable via their token; once signed they auto-
      // surface on the Client.
      const agreementMigrated = await tx.agreement.updateMany({
        where: { leadId: id, organizationId: orgId },
        data: { clientId: client.id },
      })

      await tx.lead.update({
        where: { id },
        data: {
          status: 'CONVERTED',
          convertedToId: client.id,
          convertedAt: new Date(),
          ...(sanitizedFirstName && { firstName: sanitizedFirstName }),
          ...(sanitizedLastName && { lastName: sanitizedLastName }),
          ...(sanitizedEmail !== undefined && { email: sanitizedEmail }),
        },
      })

      return {
        duplicate: false as const,
        client,
        engagement,
        taxCase,
        conversation,
        migratedCount: migrated.count,
        agreementMigratedCount: agreementMigrated.count,
      }
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

    // Early check: Twilio must be configured
    if (!isTwilioConfigured()) {
      return c.json({ success: false, error: 'SMS not configured' }, 503)
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
      select: { id: true, firstName: true, phone: true },
    })

    if (leads.length !== leadIds.length) {
      return c.json({ success: false, error: 'Some leads not found or not in organization' }, 400)
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

    // Process SMS in batches of 10 for concurrency control
    const BATCH_SIZE = 10
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map(async (lead) => {
          const personalizedMessage = message
            .replace(/\{\{firstName\}\}/g, lead.firstName)
            .replace(/\{\{formLink\}\}/g, formUrl)

          const smsResult = await sendSmsOnly(lead.phone, personalizedMessage)
          const twilioStatus = smsResult.success
            ? (smsResult.status || 'queued')
            : `ERROR: ${smsResult.error ?? 'unknown'}`

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
                error: smsResult.error ?? null,
                sentById: staffId,
                organizationId: orgId,
              },
            }),
          ])
          createdMessages.push({ id: messageRecord.id, leadId: lead.id })

          if (smsResult.success) {
            return { success: true, leadName: lead.firstName }
          }
          return { success: false, leadName: lead.firstName }
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          sent++
        } else {
          failed++
          const name = result.status === 'fulfilled' ? result.value.leadName : 'Unknown'
          errors.push(`${name}: SMS delivery failed`)
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

    // Update all targeted leads to SENT status (regardless of delivery outcome)
    if (leads.length > 0) {
      await prisma.lead.updateMany({
        where: {
          id: { in: leads.map((l) => l.id) },
          organizationId: orgId,
          status: 'NEW',
        },
        data: { status: 'SENT' },
      })
    }

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

    return c.json({
      success: true,
      sent,
      failed,
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
