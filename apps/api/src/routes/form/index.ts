/**
 * Public Form Routes
 * Public endpoints for client self-registration via intake form
 * No authentication required
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { Language, ClientType, BusinessType, ClientSource } from '@ella/db'
import { prisma } from '../../lib/db'
import { findOrCreateEngagement } from '../../services/engagement-helpers'
import { createMagicLink } from '../../services/magic-link'
import { sendWelcomeMessage, isSmsEnabled } from '../../services/sms'
import { encryptSSN } from '../../services/crypto'
import { rateLimiter } from '../../middleware/rate-limiter'
import {
  getFormInfoParamsSchema,
  getStaffFormInfoParamsSchema,
  submitFormSchema,
} from './schemas'

const formRoute = new Hono()

// Rate limits
const formReadRateLimit = rateLimiter({
  keyPrefix: 'form-read',
  maxRequests: 30,
  windowMs: 60000,
})

const submitRateLimit = rateLimiter({
  keyPrefix: 'form-submit',
  maxRequests: 10,
  windowMs: 60000,
})

// GET /form/:orgSlug - Get org info for generic form
formRoute.get(
  '/:orgSlug',
  formReadRateLimit,
  zValidator('param', getFormInfoParamsSchema),
  async (c) => {
    const { orgSlug } = c.req.valid('param')

    const org = await prisma.organization.findFirst({
      where: { slug: orgSlug, isActive: true },
      select: { id: true, name: true, logoUrl: true, slug: true },
    })

    if (!org) return c.json({ error: 'Organization not found' }, 404)

    return c.json({ org })
  }
)

// GET /form/:orgSlug/campaign/:campaignSlug - Validate campaign exists and is active
formRoute.get(
  '/:orgSlug/campaign/:campaignSlug',
  formReadRateLimit,
  async (c) => {
    const orgSlug = c.req.param('orgSlug')
    const campaignSlug = c.req.param('campaignSlug')

    const org = await prisma.organization.findFirst({
      where: { slug: orgSlug, isActive: true },
      select: { id: true },
    })

    if (!org) return c.json({ error: 'Organization not found' }, 404)

    const campaign = await prisma.campaign.findUnique({
      where: {
        slug_organizationId: { slug: campaignSlug, organizationId: org.id },
      },
      select: { id: true, name: true, status: true },
    })

    if (!campaign || campaign.status !== 'ACTIVE') {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    return c.json({ valid: true, campaignName: campaign.name })
  }
)

// GET /form/:orgSlug/:staffSlug - Get org + staff info for personalized form
formRoute.get(
  '/:orgSlug/:staffSlug',
  formReadRateLimit,
  zValidator('param', getStaffFormInfoParamsSchema),
  async (c) => {
    const { orgSlug, staffSlug } = c.req.valid('param')

    const org = await prisma.organization.findFirst({
      where: { slug: orgSlug, isActive: true },
      select: { id: true, name: true, logoUrl: true, slug: true },
    })

    if (!org) return c.json({ error: 'Organization not found' }, 404)

    const staff = await prisma.staff.findFirst({
      where: {
        organizationId: org.id,
        formSlug: staffSlug,
        isActive: true,
      },
      select: { id: true, name: true },
    })

    if (!staff) return c.json({ error: 'Staff member not found' }, 404)

    return c.json({ org, staff })
  }
)

// POST /form/:orgSlug/submit - Submit intake form (create client)
// Supports 3 paths: INDIVIDUAL, BUSINESS, INDIVIDUAL_WITH_BUSINESS
formRoute.post(
  '/:orgSlug/submit',
  submitRateLimit,
  zValidator('param', getFormInfoParamsSchema),
  zValidator('json', submitFormSchema),
  async (c) => {
    const { orgSlug } = c.req.valid('param')
    const input = c.req.valid('json')
    const clientType = input.clientType || 'INDIVIDUAL'

    // 1. Find org
    const org = await prisma.organization.findFirst({
      where: { slug: orgSlug, isActive: true },
      select: { id: true, autoSendFormClientUploadLink: true },
    })
    if (!org) return c.json({ error: 'Organization not found' }, 404)

    // 2. Find staff if staffSlug provided
    let staffId: string | null = null
    let staffAutoSend: boolean | null = null
    if (input.staffSlug) {
      const staff = await prisma.staff.findFirst({
        where: { organizationId: org.id, formSlug: input.staffSlug, isActive: true },
        select: { id: true, autoSendUploadLink: true },
      })
      if (!staff) return c.json({ error: 'Staff member not found' }, 404)
      staffId = staff.id
      staffAutoSend = staff.autoSendUploadLink
    }

    const source: ClientSource = staffId ? 'STAFF_FORM' : 'GENERIC_FORM'
    const shouldAutoSend = staffAutoSend !== null ? staffAutoSend : org.autoSendFormClientUploadLink

    // Check phone uniqueness for individual clients in same org
    const phoneToCheck = clientType === 'BUSINESS' ? input.businessPhone : input.phone
      if (phoneToCheck) {
        const existingClient = await prisma.client.findFirst({
          where: { phone: phoneToCheck, clientType: 'INDIVIDUAL', organizationId: org.id },
        })
        if (existingClient && clientType !== 'BUSINESS') {
          return c.json({
            error: 'PHONE_ALREADY_REGISTERED',
            message: 'This phone number is already registered. Please contact your CPA.',
          }, 409)
        }
      }

      // --- INDIVIDUAL path ---
      if (clientType === 'INDIVIDUAL') {
        const fullName = input.lastName ? `${input.firstName} ${input.lastName}` : input.firstName!

        const result = await prisma.$transaction(async (tx) => {
          const client = await tx.client.create({
            data: {
              firstName: input.firstName!, lastName: input.lastName || null, name: fullName,
              phone: input.phone!, email: input.email || null,
              language: input.language as Language, source, organizationId: org.id, managedById: staffId,
            },
          })
          const { engagementId } = await findOrCreateEngagement(tx, client.id, input.taxYear)
          const taxCase = await tx.taxCase.create({
            data: { clientId: client.id, taxYear: input.taxYear, engagementId, taxTypes: ['FORM_1040'], status: 'INTAKE' },
          })
          await tx.conversation.create({ data: { caseId: taxCase.id, lastMessageAt: new Date() } })
          return { client, taxCase }
        })

        const smsSent = await trySendWelcomeSms(shouldAutoSend, result.taxCase.id, fullName, input.phone!, input.taxYear, input.language, staffId)
        return c.json({ success: true, clientId: result.client.id, smsSent })
      }

      // --- BUSINESS path ---
      if (clientType === 'BUSINESS') {
        const result = await prisma.$transaction(async (tx) => {
          const client = await tx.client.create({
            data: {
              firstName: input.businessName!, name: input.businessName!,
              phone: input.businessPhone!, email: input.businessEmail || null,
              language: input.language as Language,
              clientType: 'BUSINESS' as ClientType,
              businessType: (input.businessType || 'LLC') as BusinessType,
              einEncrypted: input.businessEin ? encryptSSN(input.businessEin) : undefined,
              businessAddress: input.businessAddress || null, businessCity: input.businessCity || null,
              businessState: input.businessState || null, businessZip: input.businessZip || null,
              source, organizationId: org.id, managedById: staffId,
            },
          })
          const { engagementId } = await findOrCreateEngagement(tx, client.id, input.taxYear)
          const taxCase = await tx.taxCase.create({
            data: { clientId: client.id, taxYear: input.taxYear, engagementId, taxTypes: ['FORM_1120S'], status: 'INTAKE' },
          })
          await tx.conversation.create({ data: { caseId: taxCase.id, lastMessageAt: new Date() } })
          return { client, taxCase }
        })

        // No SMS for business-only: no individual name for greeting template
        return c.json({ success: true, clientId: result.client.id, smsSent: false })
      }

      // --- INDIVIDUAL_WITH_BUSINESS path ---
      const fullName = input.lastName ? `${input.firstName} ${input.lastName}` : input.firstName!
      const groupName = `${fullName} Group`

      const result = await prisma.$transaction(async (tx) => {
        const group = await tx.clientGroup.create({ data: { name: groupName, organizationId: org.id } })

        // Individual client
        const individual = await tx.client.create({
          data: {
            firstName: input.firstName!, lastName: input.lastName || null, name: fullName,
            phone: input.phone!, email: input.email || null,
            language: input.language as Language, clientType: 'INDIVIDUAL' as ClientType,
            source, organizationId: org.id, managedById: staffId, clientGroupId: group.id,
          },
        })
        const { engagementId: indEngId } = await findOrCreateEngagement(tx, individual.id, input.taxYear)
        const indCase = await tx.taxCase.create({
          data: { clientId: individual.id, taxYear: input.taxYear, engagementId: indEngId, taxTypes: ['FORM_1040'], status: 'INTAKE' },
        })
        await tx.conversation.create({ data: { caseId: indCase.id, lastMessageAt: new Date() } })

        // Business client (businessPhone required by schema for this path)
        const bizPhone = input.businessPhone!
        const business = await tx.client.create({
          data: {
            firstName: input.businessName!, name: input.businessName!, phone: bizPhone,
            email: input.businessEmail || null, language: input.language as Language,
            clientType: 'BUSINESS' as ClientType,
            businessType: (input.businessType || 'LLC') as BusinessType,
            einEncrypted: input.businessEin ? encryptSSN(input.businessEin) : undefined,
            businessAddress: input.businessAddress || null, businessCity: input.businessCity || null,
            businessState: input.businessState || null, businessZip: input.businessZip || null,
            source, organizationId: org.id, managedById: staffId, clientGroupId: group.id,
          },
        })
        const { engagementId: bizEngId } = await findOrCreateEngagement(tx, business.id, input.taxYear)
        const bizCase = await tx.taxCase.create({
          data: { clientId: business.id, taxYear: input.taxYear, engagementId: bizEngId, taxTypes: ['FORM_1120S'], status: 'INTAKE' },
        })
        await tx.conversation.create({ data: { caseId: bizCase.id, lastMessageAt: new Date() } })

        return { individual, indCase }
      })

      const smsSent = await trySendWelcomeSms(shouldAutoSend, result.indCase.id, fullName, input.phone!, input.taxYear, input.language, staffId)
      return c.json({ success: true, clientId: result.individual.id, smsSent })

    }
  )

/** Try sending welcome SMS if auto-send is enabled */
async function trySendWelcomeSms(
  shouldAutoSend: boolean, caseId: string, clientName: string,
  phone: string, taxYear: number, language: string, staffId: string | null,
): Promise<boolean> {
  if (!shouldAutoSend || !isSmsEnabled()) return false
  try {
    const magicLink = await createMagicLink(caseId)
    const result = await sendWelcomeMessage(
      caseId, clientName, phone, magicLink, taxYear,
      language as 'VI' | 'EN', undefined, staffId,
    )
    return result.smsSent
  } catch (error) {
    console.error('[Form] Failed to send welcome SMS:', error)
    return false
  }
}

export { formRoute }
