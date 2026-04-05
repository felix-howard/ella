/**
 * Public Contractor Intake Routes
 * Public endpoints for contractor self-registration via intake token
 * No authentication required
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import { rateLimiter } from '../../middleware/rate-limiter'
import { encryptSSN } from '../../services/crypto'
import { intakeTokenParamSchema, submitContractorIntakeSchema } from './schemas'

const contractorIntakeRoute = new Hono()

// Rate limits
const intakeReadRateLimit = rateLimiter({
  keyPrefix: 'intake-read',
  maxRequests: 10,
  windowMs: 60000,
})

const intakeSubmitRateLimit = rateLimiter({
  keyPrefix: 'intake-submit',
  maxRequests: 5,
  windowMs: 60000,
})

/**
 * GET /contractor-intake/:token - Validate token, return business + org info
 */
contractorIntakeRoute.get(
  '/:token',
  intakeReadRateLimit,
  zValidator('param', intakeTokenParamSchema),
  async (c) => {
    const { token } = c.req.valid('param')

    const intakeToken = await prisma.contractorIntakeToken.findFirst({
      where: {
        token,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        taxYear: true,
        business: {
          select: {
            name: true,
            client: {
              select: {
                organization: {
                  select: { name: true, logoUrl: true },
                },
              },
            },
          },
        },
      },
    })

    if (!intakeToken) {
      return c.json({ error: 'Invalid or expired intake link' }, 404)
    }

    return c.json({
      business: { name: intakeToken.business.name },
      org: intakeToken.business.client.organization ?? { name: '', logoUrl: null },
      taxYear: intakeToken.taxYear,
    })
  }
)

/**
 * POST /contractor-intake/:token - Submit contractor info
 */
contractorIntakeRoute.post(
  '/:token',
  intakeSubmitRateLimit,
  zValidator('param', intakeTokenParamSchema),
  zValidator('json', submitContractorIntakeSchema),
  async (c) => {
    const { token } = c.req.valid('param')
    const input = c.req.valid('json')

    const intakeToken = await prisma.contractorIntakeToken.findFirst({
      where: {
        token,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { businessId: true },
    })

    if (!intakeToken) {
      return c.json({ error: 'Invalid or expired intake link' }, 404)
    }

    const ssnDigits = input.ssn.replace(/\D/g, '')
    const ssnLast4 = ssnDigits.slice(-4)
    const ssnEncrypted = encryptSSN(input.ssn)

    const contractor = await prisma.contractor.create({
      data: {
        businessId: intakeToken.businessId,
        firstName: input.firstName,
        lastName: input.lastName,
        tinType: input.tinType,
        ssnEncrypted,
        ssnLast4,
        address: input.address,
        city: input.city,
        state: input.state,
        zip: input.zip,
        email: input.email ?? null,
        phone: input.phone ?? null,
      },
      select: {
        firstName: true,
        lastName: true,
        ssnLast4: true,
      },
    })

    console.log(`[ContractorIntake] Created contractor via token ${token} for business ${intakeToken.businessId}`)

    return c.json({ success: true, contractor })
  }
)

export { contractorIntakeRoute }
