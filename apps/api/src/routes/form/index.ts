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
import { resolveUploadLinkTemplateMessage } from '../../services/sms/upload-link-template-resolver'
import { encryptSSN } from '../../services/crypto'
import { syncClientManagers } from '../../services/clients/client-managers'
import { rateLimiter } from '../../middleware/rate-limiter'
import {
  getFormInfoParamsSchema,
  getStaffFormInfoParamsSchema,
  submitFormSchema,
  type BusinessInput,
} from './schemas'

/**
 * zValidator error hook: convert Zod validation failures into a friendly
 * { error, message } JSON body. Without this, Hono returns the raw ZodError
 * which the client stringifies to "[object Object]".
 */
function zodErrorHook(result: { success: boolean; error?: { issues?: Array<{ path: (string | number)[]; message: string }> } }, c: { json: (body: unknown, status: number) => Response }) {
  if (!result.success) {
    const first = result.error?.issues?.[0]
    const field = first?.path?.join('.') || 'input'
    const msg = first?.message || 'Invalid request'
    return c.json({ error: 'VALIDATION_ERROR', message: `${field}: ${msg}` }, 400)
  }
}

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
      select: { id: true, name: true, status: true, formIntroContent: true },
    })

    if (!campaign || campaign.status !== 'ACTIVE') {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    return c.json({
      valid: true,
      campaignName: campaign.name,
      formIntroContent: campaign.formIntroContent,
    })
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
  zValidator('json', submitFormSchema, zodErrorHook),
  async (c) => {
    const { orgSlug } = c.req.valid('param')
    const input = c.req.valid('json')
    const clientType = input.clientType || 'INDIVIDUAL'

    // 1. Find org
    const org = await prisma.organization.findFirst({
      where: { slug: orgSlug, isActive: true },
      select: { id: true, autoSendFormClientUploadLink: true, defaultUploadLinkTemplateId: true },
    })
    if (!org) return c.json({ error: 'Organization not found' }, 404)

    // 2. Find staff if staffSlug provided
    let staffId: string | null = null
    let staffAutoSend: boolean | null = null
    let staffDefaultUploadLinkTemplateId: string | null = null
    if (input.staffSlug) {
      const staff = await prisma.staff.findFirst({
        where: { organizationId: org.id, formSlug: input.staffSlug, isActive: true },
        select: { id: true, autoSendUploadLink: true, defaultUploadLinkTemplateId: true },
      })
      if (!staff) return c.json({ error: 'Staff member not found' }, 404)
      staffId = staff.id
      staffAutoSend = staff.autoSendUploadLink
      staffDefaultUploadLinkTemplateId = staff.defaultUploadLinkTemplateId
    }

    const source: ClientSource = staffId ? 'STAFF_FORM' : 'GENERIC_FORM'
    const shouldAutoSend = staffAutoSend !== null ? staffAutoSend : org.autoSendFormClientUploadLink
    const defaultUploadLinkTemplateId = staffDefaultUploadLinkTemplateId ?? org.defaultUploadLinkTemplateId
    const defaultUploadLinkTemplateMessage = defaultUploadLinkTemplateId
      ? resolveUploadLinkTemplateMessage(defaultUploadLinkTemplateId, input.language as 'VI' | 'EN')
      : undefined

    // Normalize: prefer the new `businesses[]` array, fall back to legacy flat fields.
    const businesses: BusinessInput[] = normalizeBusinesses(input)

    // Check phone uniqueness for individual clients in same org
    const phoneToCheck = clientType === 'BUSINESS' ? businesses[0]?.phone : input.phone
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
          await syncClientManagers(tx, { clientIds: [client.id], organizationId: org.id, staffIds: staffId ? [staffId] : [] })
          const { engagementId } = await findOrCreateEngagement(tx, client.id, input.taxYear)
          const taxCase = await tx.taxCase.create({
            data: { clientId: client.id, taxYear: input.taxYear, engagementId, taxTypes: ['FORM_1040'], status: 'INTAKE' },
          })
          await tx.conversation.create({ data: { caseId: taxCase.id, lastMessageAt: new Date() } })
          return { client, taxCase }
        })

        const smsSent = await trySendWelcomeSms(
          shouldAutoSend,
          result.taxCase.id,
          fullName,
          input.phone!,
          input.taxYear,
          input.language,
          staffId,
          undefined,
          defaultUploadLinkTemplateMessage
        )
        return c.json({ success: true, clientId: result.client.id, smsSent })
      }

      // --- BUSINESS path (single business, no individual) ---
      if (clientType === 'BUSINESS') {
        const biz = businesses[0]! // schema guarantees existence + phone
        const result = await prisma.$transaction(async (tx) => {
          const client = await tx.client.create({
            data: {
              firstName: biz.name, name: biz.name,
              phone: biz.phone!, email: biz.email || null,
              language: input.language as Language,
              clientType: 'BUSINESS' as ClientType,
              businessType: (biz.businessType || 'LLC') as BusinessType,
              einEncrypted: biz.ein ? encryptSSN(biz.ein) : undefined,
              businessAddress: biz.address || null, businessCity: biz.city || null,
              businessState: biz.state || null, businessZip: biz.zip || null,
              source, organizationId: org.id, managedById: staffId,
            },
          })
          await syncClientManagers(tx, { clientIds: [client.id], organizationId: org.id, staffIds: staffId ? [staffId] : [] })
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

      // --- INDIVIDUAL_WITH_BUSINESS path (one individual + N businesses, all in one ClientGroup) ---
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
        await syncClientManagers(tx, { clientIds: [individual.id], organizationId: org.id, staffIds: staffId ? [staffId] : [] })
        const { engagementId: indEngId } = await findOrCreateEngagement(tx, individual.id, input.taxYear)
        const indCase = await tx.taxCase.create({
          data: { clientId: individual.id, taxYear: input.taxYear, engagementId: indEngId, taxTypes: ['FORM_1040'], status: 'INTAKE' },
        })
        await tx.conversation.create({ data: { caseId: indCase.id, lastMessageAt: new Date() } })

        // One business client per `businesses[]` entry. Phone falls back to the
        // individual's phone when the business phone is not provided
        // (uniqueness check at line above only targets INDIVIDUAL clientType).
        for (const biz of businesses) {
          const business = await tx.client.create({
            data: {
              firstName: biz.name, name: biz.name,
              phone: biz.phone || input.phone!,
              email: biz.email || null, language: input.language as Language,
              clientType: 'BUSINESS' as ClientType,
              businessType: (biz.businessType || 'LLC') as BusinessType,
              einEncrypted: biz.ein ? encryptSSN(biz.ein) : undefined,
              businessAddress: biz.address || null, businessCity: biz.city || null,
              businessState: biz.state || null, businessZip: biz.zip || null,
              source, organizationId: org.id, managedById: staffId, clientGroupId: group.id,
            },
          })
          await syncClientManagers(tx, { clientIds: [business.id], organizationId: org.id, staffIds: staffId ? [staffId] : [] })
          const { engagementId: bizEngId } = await findOrCreateEngagement(tx, business.id, input.taxYear)
          await tx.taxCase.create({
            data: { clientId: business.id, taxYear: input.taxYear, engagementId: bizEngId, taxTypes: ['FORM_1120S'], status: 'INTAKE' },
          })
          // Skip conversation for business — individual already has one
        }

        return { individual, indCase, group }
      })

      const smsSent = await trySendWelcomeSms(
        shouldAutoSend,
        result.indCase.id,
        fullName,
        input.phone!,
        input.taxYear,
        input.language,
        staffId,
        result.group.id,
        defaultUploadLinkTemplateMessage
      )
      return c.json({ success: true, clientId: result.individual.id, smsSent })

    }
  )

/**
 * Build a unified list of businesses from either the new `businesses[]`
 * array (preferred) or the legacy flat `business*` fields.
 */
function normalizeBusinesses(input: {
  businesses?: BusinessInput[]
  businessName?: string
  businessType?: BusinessInput['businessType']
  businessEin?: string
  businessPhone?: string
  businessEmail?: string
  businessAddress?: string
  businessCity?: string
  businessState?: string
  businessZip?: string
}): BusinessInput[] {
  if (input.businesses && input.businesses.length > 0) return input.businesses
  if (!input.businessName) return []
  return [{
    name: input.businessName,
    businessType: input.businessType,
    ein: input.businessEin,
    phone: input.businessPhone,
    email: input.businessEmail,
    address: input.businessAddress,
    city: input.businessCity,
    state: input.businessState,
    zip: input.businessZip,
  }]
}

/**
 * Try sending welcome SMS if auto-send is enabled.
 *
 * When `clientGroupId` is provided, the magic link is created with `scope=GROUP`
 * so the portal renders the entity picker (individual + businesses) instead of
 * the solo upload page. Required for INDIVIDUAL_WITH_BUSINESS submissions —
 * without it, multi-entity intakes get a CASE-scoped link and bypass the picker.
 */
async function trySendWelcomeSms(
  shouldAutoSend: boolean, caseId: string, clientName: string,
  phone: string, taxYear: number, language: string, staffId: string | null,
  clientGroupId?: string,
  customMessage?: string,
): Promise<boolean> {
  if (!shouldAutoSend || !isSmsEnabled()) return false
  try {
    const magicLink = clientGroupId
      ? await createMagicLink(caseId, { clientName, scope: 'GROUP', clientGroupId })
      : await createMagicLink(caseId, { clientName })
    const result = await sendWelcomeMessage(
      caseId, clientName, phone, magicLink, taxYear,
      language as 'VI' | 'EN', customMessage, staffId,
    )
    return result.smsSent
  } catch (error) {
    console.error('[Form] Failed to send welcome SMS:', error)
    return false
  }
}

export { formRoute }
