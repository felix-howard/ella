/**
 * Leads API routes
 * CRUD operations for lead management + bulk SMS + convert-to-client
 */
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import { getPaginationParams, buildPaginationResponse } from '../../lib/constants'
import { sanitizeSearchInput, sanitizeTextInput } from '../../lib/validation'
import { formatPhoneToE164, sendSmsOnly, isTwilioConfigured } from '../../services/sms'
import { createMagicLink } from '../../services/magic-link'
import { sendWelcomeMessage } from '../../services/sms'
import { rateLimiter } from '../../middleware/rate-limiter'
import { authMiddleware, requireOrgAdmin } from '../../middleware/auth'
import type { AuthVariables } from '../../middleware/auth'
import type { AuthUser } from '../../services/auth'
import {
  createLeadSchema,
  leadIdParamSchema,
  listLeadsQuerySchema,
  updateLeadSchema,
  convertLeadSchema,
  bulkSmsSchema,
} from './schemas'

const leadsRoute = new Hono<{ Variables: AuthVariables }>()

/** Extract verified orgId and staffId from auth user (requireOrgAdmin guarantees these) */
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
      select: { id: true, isActive: true },
    })

    if (!org || !org.isActive) {
      return c.json({ success: false, error: 'Organization not found' }, 404)
    }

    const normalizedPhone = formatPhoneToE164(phone)

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
          campaignTag,
          tags: campaignTag ? [campaignTag] : [],
          status: 'NEW',
          organizationId: org.id,
        },
      })

      return c.json({ success: true, leadId: lead.id })
    } catch (err: unknown) {
      // Handle duplicate phone+org unique constraint violation
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
        return c.json({ success: true, message: 'Registration received' })
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
  requireOrgAdmin,
  zValidator('query', listLeadsQuerySchema),
  async (c) => {
    const { orgId } = getVerifiedAuth(c.get('user'))
    const { page, limit, status, search, tag } = c.req.valid('query')
    const { skip } = getPaginationParams(page, limit)

    const where: Record<string, unknown> = { organizationId: orgId }

    if (status) {
      where.status = status
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
      data: leads,
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
  requireOrgAdmin,
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
// PROTECTED+ADMIN: Get Lead Detail
// ============================================
leadsRoute.get(
  '/:id',
  authMiddleware,
  requireOrgAdmin,
  zValidator('param', leadIdParamSchema),
  async (c) => {
    const { orgId } = getVerifiedAuth(c.get('user'))
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

    return c.json({ success: true, data: { ...lead, campaignName } })
  }
)

// ============================================
// PROTECTED+ADMIN: Update Lead
// ============================================
leadsRoute.patch(
  '/:id',
  authMiddleware,
  requireOrgAdmin,
  zValidator('param', leadIdParamSchema),
  zValidator('json', updateLeadSchema),
  async (c) => {
    const { orgId } = getVerifiedAuth(c.get('user'))
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

    return c.json({ success: true, data: updated })
  }
)

// ============================================
// PROTECTED+ADMIN: Check Duplicate Phone Before Convert
// ============================================
leadsRoute.get(
  '/:id/convert-check',
  authMiddleware,
  requireOrgAdmin,
  zValidator('param', leadIdParamSchema),
  async (c) => {
    const { orgId } = getVerifiedAuth(c.get('user'))
    const { id } = c.req.valid('param')

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: orgId },
      select: { phone: true },
    })

    if (!lead) {
      return c.json({ success: false, error: 'Lead not found' }, 404)
    }

    const existingClient = await prisma.client.findFirst({
      where: { phone: lead.phone, organizationId: orgId },
      select: { id: true, firstName: true, lastName: true, phone: true },
    })

    return c.json({
      success: true,
      hasDuplicate: !!existingClient,
      existingClient: existingClient || undefined,
    })
  }
)

// ============================================
// PROTECTED+ADMIN: Convert Lead to Client
// ============================================
leadsRoute.post(
  '/:id/convert',
  authMiddleware,
  requireOrgAdmin,
  zValidator('param', leadIdParamSchema),
  zValidator('json', convertLeadSchema),
  async (c) => {
    const { orgId, staffId } = getVerifiedAuth(c.get('user'))
    const { id } = c.req.valid('param')
    const { managedById, language, taxYear, sendWelcomeSms, customMessage } = c.req.valid('json')

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: orgId },
    })

    if (!lead) {
      return c.json({ success: false, error: 'Lead not found' }, 404)
    }

    if (lead.status === 'CONVERTED') {
      return c.json({ success: false, error: 'Lead already converted' }, 400)
    }

    const result = await prisma.$transaction(async (tx) => {
      // Duplicate check inside transaction to prevent race conditions
      const existingClient = await tx.client.findFirst({
        where: { phone: lead.phone, organizationId: orgId },
        select: { id: true, firstName: true, lastName: true },
      })

      if (existingClient) {
        return { duplicate: true as const, existingClient }
      }

      const client = await tx.client.create({
        data: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          name: `${lead.firstName} ${lead.lastName}`,
          phone: lead.phone,
          email: lead.email,
          language,
          source: 'CONVERTED',
          tags: lead.tags || [],
          organizationId: orgId,
          managedById: managedById || null,
          createdById: staffId,
        },
      })

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

      await tx.lead.update({
        where: { id },
        data: {
          status: 'CONVERTED',
          convertedToId: client.id,
          convertedAt: new Date(),
        },
      })

      return { duplicate: false as const, client, engagement, taxCase }
    })

    if (result.duplicate) {
      return c.json({
        success: false,
        error: 'Client with this phone already exists',
        existingClient: result.existingClient,
      }, 409)
    }

    // Send welcome SMS if requested (outside transaction)
    if (sendWelcomeSms && isTwilioConfigured()) {
      try {
        const magicLink = await createMagicLink(result.taxCase.id)
        await sendWelcomeMessage(
          result.taxCase.id,
          `${result.client.firstName} ${result.client.lastName}`,
          result.client.phone,
          magicLink,
          taxYear,
          language,
          customMessage
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
  requireOrgAdmin,
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
      select: { slug: true },
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

          await prisma.smsSendLog.create({
            data: {
              leadId: lead.id,
              message: personalizedMessage,
              status: smsResult.success ? 'SENT' : 'FAILED',
              twilioSid: smsResult.sid ?? null,
              error: smsResult.error ?? null,
              sentById: staffId,
              organizationId: orgId,
            },
          })

          if (smsResult.success) {
            await prisma.lead.updateMany({
              where: { id: lead.id, status: 'NEW' },
              data: { status: 'CONTACTED' },
            })
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
  requireOrgAdmin,
  zValidator('param', leadIdParamSchema),
  async (c) => {
    const { orgId } = getVerifiedAuth(c.get('user'))
    const { id } = c.req.valid('param')

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: orgId },
    })

    if (!lead) {
      return c.json({ success: false, error: 'Lead not found' }, 404)
    }

    await prisma.lead.delete({ where: { id } })

    return c.json({ success: true })
  }
)

export { leadsRoute }
