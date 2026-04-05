/**
 * Business CRUD routes
 * Nested under /clients/:clientId/businesses
 * All routes require auth + org scope via parent /clients/* middleware
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import { buildClientScopeFilter } from '../../lib/org-scope'
import { encryptSSN, decryptSSN } from '../../services/crypto'
import { logProfileChanges } from '../../services/audit-logger'
import { requireOrgAdmin } from '../../middleware/auth'
import { createBusinessSchema, updateBusinessSchema } from './schemas'
import type { AuthVariables } from '../../middleware/auth'

const businessesRoute = new Hono<{ Variables: AuthVariables }>()

/** Mask EIN: decrypt then show only last 4 digits */
function maskEIN(einEncrypted: string): string {
  try {
    const ein = decryptSSN(einEncrypted).replace(/-/g, '')
    return `XX-XXX${ein.slice(-4)}`
  } catch {
    return 'XX-XXX****'
  }
}

/**
 * GET /clients/:clientId/businesses - List businesses for a client
 */
businessesRoute.get('/:clientId/businesses', async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  const client = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    select: { id: true },
  })

  if (!client) {
    return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
  }

  const businesses = await prisma.business.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      type: true,
      einEncrypted: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { contractors: true } },
    },
  })

  const data = businesses.map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type,
    einMasked: maskEIN(b.einEncrypted),
    address: b.address,
    city: b.city,
    state: b.state,
    zip: b.zip,
    contractorCount: b._count.contractors,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }))

  return c.json({ data })
})

/**
 * GET /clients/:clientId/businesses/:businessId - Get single business
 */
businessesRoute.get('/:clientId/businesses/:businessId', async (c) => {
  const user = c.get('user')
  const { clientId, businessId } = c.req.param()

  const client = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    select: { id: true },
  })

  if (!client) {
    return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
  }

  const business = await prisma.business.findFirst({
    where: { id: businessId, clientId },
    select: {
      id: true,
      name: true,
      type: true,
      einEncrypted: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { contractors: true, filingBatches: true } },
    },
  })

  if (!business) {
    return c.json({ error: 'NOT_FOUND', message: 'Business not found' }, 404)
  }

  return c.json({
    data: {
      id: business.id,
      name: business.name,
      type: business.type,
      einMasked: maskEIN(business.einEncrypted),
      address: business.address,
      city: business.city,
      state: business.state,
      zip: business.zip,
      contractorCount: business._count.contractors,
      filingBatchCount: business._count.filingBatches,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    },
  })
})

/**
 * POST /clients/:clientId/businesses - Create business
 */
businessesRoute.post(
  '/:clientId/businesses',
  requireOrgAdmin,
  zValidator('json', createBusinessSchema),
  async (c) => {
    const user = c.get('user')
    const { clientId } = c.req.param()
    const data = c.req.valid('json')

    const client = await prisma.client.findFirst({
      where: { id: clientId, ...buildClientScopeFilter(user) },
      select: { id: true },
    })

    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    const einEncrypted = encryptSSN(data.ein)

    const business = await prisma.business.create({
      data: {
        clientId,
        name: data.name,
        type: data.type,
        einEncrypted,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
      },
      select: {
        id: true,
        name: true,
        type: true,
        einEncrypted: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        createdAt: true,
      },
    })

    void logProfileChanges(
      clientId,
      [{ field: 'business_ein_encrypted', oldValue: null, newValue: `[ENCRYPTED] business:${business.id}` }],
      user.staffId ?? undefined
    )

    console.log(`[Business] Created ${business.id} for client ${clientId} by staff ${user.staffId}`)

    return c.json({
      data: {
        id: business.id,
        name: business.name,
        type: business.type,
        einMasked: maskEIN(business.einEncrypted),
        address: business.address,
        city: business.city,
        state: business.state,
        zip: business.zip,
        createdAt: business.createdAt,
      },
    }, 201)
  }
)

/**
 * PATCH /clients/:clientId/businesses/:businessId - Update business
 */
businessesRoute.patch(
  '/:clientId/businesses/:businessId',
  requireOrgAdmin,
  zValidator('json', updateBusinessSchema),
  async (c) => {
    const user = c.get('user')
    const { clientId, businessId } = c.req.param()
    const data = c.req.valid('json')

    const client = await prisma.client.findFirst({
      where: { id: clientId, ...buildClientScopeFilter(user) },
      select: { id: true },
    })

    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    const existing = await prisma.business.findFirst({
      where: { id: businessId, clientId },
      select: { id: true },
    })

    if (!existing) {
      return c.json({ error: 'NOT_FOUND', message: 'Business not found' }, 404)
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.type !== undefined) updateData.type = data.type
    if (data.ein !== undefined) updateData.einEncrypted = encryptSSN(data.ein)
    if (data.address !== undefined) updateData.address = data.address
    if (data.city !== undefined) updateData.city = data.city
    if (data.state !== undefined) updateData.state = data.state
    if (data.zip !== undefined) updateData.zip = data.zip

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'VALIDATION_ERROR', message: 'At least one field required' }, 400)
    }

    const business = await prisma.business.update({
      where: { id: businessId },
      data: updateData,
      select: {
        id: true,
        name: true,
        type: true,
        einEncrypted: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        updatedAt: true,
      },
    })

    if (data.ein !== undefined) {
      void logProfileChanges(
        clientId,
        [{ field: 'business_ein_updated', oldValue: '[ENCRYPTED]', newValue: `[RE-ENCRYPTED] business:${businessId}` }],
        user.staffId ?? undefined
      )
    }

    console.log(`[Business] Updated ${businessId} for client ${clientId} by staff ${user.staffId}`)

    return c.json({
      data: {
        id: business.id,
        name: business.name,
        type: business.type,
        einMasked: maskEIN(business.einEncrypted),
        address: business.address,
        city: business.city,
        state: business.state,
        zip: business.zip,
        updatedAt: business.updatedAt,
      },
    })
  }
)

/**
 * DELETE /clients/:clientId/businesses/:businessId - Delete business
 */
businessesRoute.delete(
  '/:clientId/businesses/:businessId',
  requireOrgAdmin,
  async (c) => {
    const user = c.get('user')
    const { clientId, businessId } = c.req.param()

    const client = await prisma.client.findFirst({
      where: { id: clientId, ...buildClientScopeFilter(user) },
      select: { id: true },
    })

    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    const existing = await prisma.business.findFirst({
      where: { id: businessId, clientId },
      include: { _count: { select: { contractors: true, filingBatches: true } } },
    })

    if (!existing) {
      return c.json({ error: 'NOT_FOUND', message: 'Business not found' }, 404)
    }

    if (existing._count.contractors > 0 || existing._count.filingBatches > 0) {
      return c.json({
        error: 'HAS_DEPENDENTS',
        message: `Cannot delete: ${existing._count.contractors} contractors, ${existing._count.filingBatches} filing batches linked`,
      }, 409)
    }

    await prisma.business.delete({ where: { id: businessId } })

    console.log(`[Business] Deleted ${businessId} by staff ${user.staffId}`)

    return c.json({ success: true })
  }
)

export { businessesRoute }
