/**
 * Public Form Routes
 * Public endpoints for client self-registration via intake form
 * No authentication required
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { Prisma } from '@ella/db'
import type { Language } from '@ella/db'
import { prisma } from '../../lib/db'
import { findOrCreateEngagement } from '../../services/engagement-helpers'
import { createMagicLink } from '../../services/magic-link'
import { sendWelcomeMessage, isSmsEnabled } from '../../services/sms'
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
formRoute.post(
  '/:orgSlug/submit',
  submitRateLimit,
  zValidator('param', getFormInfoParamsSchema),
  zValidator('json', submitFormSchema),
  async (c) => {
    const { orgSlug } = c.req.valid('param')
    const input = c.req.valid('json')

    // 1. Find org
    const org = await prisma.organization.findFirst({
      where: { slug: orgSlug, isActive: true },
      select: {
        id: true,
        autoSendFormClientUploadLink: true,
      },
    })

    if (!org) return c.json({ error: 'Organization not found' }, 404)

    // 2. Find staff if staffSlug provided
    let staffId: string | null = null
    if (input.staffSlug) {
      const staff = await prisma.staff.findFirst({
        where: {
          organizationId: org.id,
          formSlug: input.staffSlug,
          isActive: true,
        },
        select: { id: true },
      })
      if (!staff) {
        return c.json({ error: 'Staff member not found' }, 404)
      }
      staffId = staff.id
    }

    // 3. Create client + engagement + case in transaction
    const fullName = input.lastName
      ? `${input.firstName} ${input.lastName}`
      : input.firstName

    let result: { client: { id: string }; taxCase: { id: string; taxYear: number } }

    try {
      result = await prisma.$transaction(async (tx) => {
        const client = await tx.client.create({
          data: {
            firstName: input.firstName,
            lastName: input.lastName || null,
            name: fullName,
            phone: input.phone,
            language: input.language as Language,
            source: 'FORM',
            organizationId: org.id,
            managedById: staffId,
          },
        })

        const { engagementId } = await findOrCreateEngagement(
          tx,
          client.id,
          input.taxYear
        )

        const taxCase = await tx.taxCase.create({
          data: {
            clientId: client.id,
            taxYear: input.taxYear,
            engagementId,
            taxTypes: ['FORM_1040'],
            status: 'INTAKE',
          },
        })

        // Create conversation for messages
        await tx.conversation.create({
          data: {
            caseId: taxCase.id,
            lastMessageAt: new Date(),
          },
        })

        return { client, taxCase }
      })
    } catch (error) {
      // Handle phone uniqueness constraint violation (race condition)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return c.json(
          {
            error: 'PHONE_ALREADY_REGISTERED',
            message:
              'This phone number is already registered. Please contact your CPA.',
          },
          409
        )
      }
      throw error
    }

    // 4. Send welcome SMS with upload link if auto-send enabled
    // Only create magic link when actually sending — otherwise the client list
    // badge ("need send upload link") won't appear since hasUploadLink checks
    // for existing magic links.
    let smsSent = false
    if (org.autoSendFormClientUploadLink && isSmsEnabled()) {
      try {
        const magicLink = await createMagicLink(result.taxCase.id)
        const smsResult = await sendWelcomeMessage(
          result.taxCase.id,
          fullName,
          input.phone,
          magicLink,
          input.taxYear,
          input.language as 'VI' | 'EN'
        )
        smsSent = smsResult.smsSent
      } catch (error) {
        console.error('[Form] Failed to send welcome SMS:', error)
      }
    }

    return c.json({
      success: true,
      clientId: result.client.id,
      smsSent,
    })
  }
)

export { formRoute }
