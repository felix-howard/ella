/**
 * Combined Client + Lead recipient search for the "Send quote to client" panel.
 * Returns a lightweight, org-scoped result (no full phone — last4 only) so the
 * workspace combobox can pick a single Client or Lead to send a quote to.
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../../lib/db'
import { sanitizeSearchInput } from '../../lib/validation'
import { buildClientScopeFilter } from '../../lib/org-scope'
import { standardRateLimit } from '../../middleware/rate-limiter'
import {
  authMiddleware,
  requireOrg,
  requireAdminOrManager,
  type AuthVariables,
} from '../../middleware/auth'
import { getVerifiedAuth } from '../leads/auth-helpers'

const RESULT_CAP = 10

const searchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
})

export interface RecipientResult {
  id: string
  type: 'client' | 'lead'
  firstName: string | null
  lastName: string | null
  businessName: string | null
  /** Last 4 digits of the phone, or null — full numbers never leave the API. */
  phoneLast4: string | null
}

const recipientsRoute = new Hono<{ Variables: AuthVariables }>()

recipientsRoute.get(
  '/search',
  authMiddleware,
  requireOrg,
  requireAdminOrManager,
  standardRateLimit,
  zValidator('query', searchQuerySchema),
  async (c) => {
    const user = c.get('user')
    const { orgId } = getVerifiedAuth(user)
    const rawQuery = c.req.valid('query').q
    const sanitized = rawQuery ? sanitizeSearchInput(rawQuery) : ''

    if (!sanitized) {
      return c.json({ clients: [], leads: [] })
    }

    const digitsOnly = sanitized.replace(/\D/g, '')
    const phoneSearch = digitsOnly.length >= 3 ? digitsOnly : sanitized

    const [clients, leads] = await Promise.all([
      prisma.client.findMany({
        where: {
          // Canonical client visibility scope (org + per-user assignment).
          ...buildClientScopeFilter(user),
          OR: [
            { firstName: { contains: sanitized, mode: 'insensitive' } },
            { lastName: { contains: sanitized, mode: 'insensitive' } },
            { name: { contains: sanitized, mode: 'insensitive' } },
            { phone: { contains: phoneSearch } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: RESULT_CAP,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          // Client.businessName lives on the profile, not the model.
          profile: { select: { businessName: true } },
        },
      }),
      prisma.lead.findMany({
        where: {
          organizationId: orgId,
          status: { not: 'CONVERTED' },
          OR: [
            { firstName: { contains: sanitized, mode: 'insensitive' } },
            { lastName: { contains: sanitized, mode: 'insensitive' } },
            { businessName: { contains: sanitized, mode: 'insensitive' } },
            { phone: { contains: phoneSearch } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: RESULT_CAP,
        select: { id: true, firstName: true, lastName: true, businessName: true, phone: true },
      }),
    ])

    return c.json({
      clients: clients.map((r) =>
        toRecipient({
          id: r.id,
          type: 'client',
          firstName: r.firstName,
          lastName: r.lastName,
          businessName: r.profile?.businessName ?? null,
          phone: r.phone,
        }),
      ),
      leads: leads.map((r) =>
        toRecipient({
          id: r.id,
          type: 'lead',
          firstName: r.firstName,
          lastName: r.lastName,
          businessName: r.businessName,
          phone: r.phone,
        }),
      ),
    })
  }
)

function toRecipient(row: {
  id: string
  type: 'client' | 'lead'
  firstName: string | null
  lastName: string | null
  businessName: string | null
  phone: string | null
}): RecipientResult {
  return {
    id: row.id,
    type: row.type,
    firstName: row.firstName,
    lastName: row.lastName,
    businessName: row.businessName,
    phoneLast4: row.phone ? row.phone.replace(/\D/g, '').slice(-4) || null : null,
  }
}

export { recipientsRoute }
