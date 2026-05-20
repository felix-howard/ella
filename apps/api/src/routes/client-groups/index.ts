/**
 * ClientGroup API routes
 * CRUD for grouping clients (individual ↔ business linking)
 */
import { z } from 'zod'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import { getPaginationParams, buildPaginationResponse } from '../../lib/constants'
import { buildClientScopeFilter } from '../../lib/org-scope'
import type { AuthVariables } from '../../middleware/auth'
import type { AuthUser } from '../../services/auth'
import {
  createGroupSchema,
  updateGroupSchema,
  groupIdParamSchema,
  listGroupsQuerySchema,
} from './schemas'
import {
  isCaseFiled,
  scheduleIdentityRetentionForFiledCase,
} from '../../services/identity-doc-retention'

const clientGroupsRoute = new Hono<{ Variables: AuthVariables }>()

/** Extract verified orgId and staffId from auth user */
function getVerifiedAuth(user: AuthUser): { orgId: string; staffId: string } {
  if (!user.organizationId) {
    throw new HTTPException(403, { message: 'Organization required' })
  }
  if (!user.staffId) {
    throw new HTTPException(403, { message: 'Staff record required' })
  }
  return { orgId: user.organizationId, staffId: user.staffId }
}

// Client preview fields included in group responses
const clientPreviewSelect = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  clientType: true,
  phone: true,
  email: true,
  avatarUrl: true,
}

// ============================================
// POST /client-groups — Create group
// ============================================
clientGroupsRoute.post(
  '/',
  zValidator('json', createGroupSchema),
  async (c) => {
    const { name, clientIds } = c.req.valid('json')
    const user = c.get('user')
    const { orgId } = getVerifiedAuth(user)

    // Verify all clients belong to user's org
    const clients = await prisma.client.findMany({
      where: {
        id: { in: clientIds },
        ...buildClientScopeFilter(user),
      },
      select: { id: true },
    })

    if (clients.length !== clientIds.length) {
      throw new HTTPException(400, {
        message: `Some client IDs not found or not in your org. Found ${clients.length} of ${clientIds.length}`,
      })
    }

    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.clientGroup.create({
        data: {
          name,
          organizationId: orgId,
        },
      })

      // Link clients to the group
      await tx.client.updateMany({
        where: { id: { in: clientIds } },
        data: { clientGroupId: created.id },
      })

      return tx.clientGroup.findUnique({
        where: { id: created.id },
        include: { clients: { select: clientPreviewSelect } },
      })
    })

    return c.json({ success: true, data: group }, 201)
  }
)

// ============================================
// GET /client-groups — List groups in org
// ============================================
clientGroupsRoute.get(
  '/',
  zValidator('query', listGroupsQuerySchema),
  async (c) => {
    const { page, limit, search } = c.req.valid('query')
    const user = c.get('user')
    const { orgId } = getVerifiedAuth(user)
    const { skip } = getPaginationParams(page, limit)

    const where: Record<string, unknown> = { organizationId: orgId }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }

    const [groups, total] = await Promise.all([
      prisma.clientGroup.findMany({
        where,
        include: {
          clients: { select: clientPreviewSelect, take: 20 },
          _count: { select: { clients: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.clientGroup.count({ where }),
    ])

    return c.json({
      success: true,
      data: groups,
      pagination: buildPaginationResponse(page, limit, total),
    })
  }
)

// ============================================
// GET /client-groups/:id — Group detail
// ============================================
clientGroupsRoute.get(
  '/:id',
  zValidator('param', groupIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const user = c.get('user')
    const { orgId } = getVerifiedAuth(user)

    const group = await prisma.clientGroup.findFirst({
      where: { id, organizationId: orgId },
      include: {
        clients: { select: clientPreviewSelect },
      },
    })

    if (!group) {
      throw new HTTPException(404, { message: 'Client group not found' })
    }

    return c.json({ success: true, data: group })
  }
)

// ============================================
// PATCH /client-groups/:id — Update group
// ============================================
clientGroupsRoute.patch(
  '/:id',
  zValidator('param', groupIdParamSchema),
  zValidator('json', updateGroupSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const { name, addClientIds, removeClientIds } = c.req.valid('json')
    const user = c.get('user')
    const { orgId } = getVerifiedAuth(user)

    // Early return if nothing to update
    if (!name && !addClientIds?.length && !removeClientIds?.length) {
      throw new HTTPException(400, { message: 'No update fields provided' })
    }

    // Verify group exists and belongs to org
    const existing = await prisma.clientGroup.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    })
    if (!existing) {
      throw new HTTPException(404, { message: 'Client group not found' })
    }

    // Verify added clients belong to user's org
    if (addClientIds?.length) {
      const found = await prisma.client.findMany({
        where: {
          id: { in: addClientIds },
          ...buildClientScopeFilter(user),
        },
        select: { id: true },
      })
      if (found.length !== addClientIds.length) {
        throw new HTTPException(400, {
          message: `Some client IDs not found or not in your org. Found ${found.length} of ${addClientIds.length}`,
        })
      }
    }

    const group = await prisma.$transaction(async (tx) => {
      // Update name if provided
      if (name) {
        await tx.clientGroup.update({
          where: { id },
          data: { name },
        })
      }

      // Add clients to group
      if (addClientIds?.length) {
        await tx.client.updateMany({
          where: { id: { in: addClientIds } },
          data: { clientGroupId: id },
        })
      }

      // Remove clients from group (set clientGroupId to null, org-scoped)
      if (removeClientIds?.length) {
        await tx.client.updateMany({
          where: {
            id: { in: removeClientIds },
            clientGroupId: id,
            ...buildClientScopeFilter(user),
          },
          data: { clientGroupId: null },
        })
      }

      return tx.clientGroup.findUnique({
        where: { id },
        include: { clients: { select: clientPreviewSelect } },
      })
    })

    return c.json({ success: true, data: group })
  }
)

// ============================================
// DELETE /client-groups/:id — Delete group
// ============================================
clientGroupsRoute.delete(
  '/:id',
  zValidator('param', groupIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const user = c.get('user')
    const { orgId } = getVerifiedAuth(user)

    const existing = await prisma.clientGroup.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    })
    if (!existing) {
      throw new HTTPException(404, { message: 'Client group not found' })
    }

    await prisma.$transaction(async (tx) => {
      // Unlink all clients (set clientGroupId to null)
      await tx.client.updateMany({
        where: { clientGroupId: id },
        data: { clientGroupId: null },
      })
      // Delete the group
      await tx.clientGroup.delete({ where: { id } })
    })

    return c.json({ success: true, message: 'Group deleted' })
  }
)

// ============================================
// GET /client-groups/:id/images — All images across group entities
// ============================================
const groupImagesQuerySchema = z.object({
  taxYear: z.coerce.number().int().min(2000).max(2100).optional(),
})

clientGroupsRoute.get(
  '/:id/images',
  zValidator('param', groupIdParamSchema),
  zValidator('query', groupImagesQuerySchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const { taxYear: taxYearParam } = c.req.valid('query')
    const user = c.get('user')
    const { orgId } = getVerifiedAuth(user)
    const taxYear = taxYearParam || new Date().getFullYear()

    // Verify group exists and belongs to org
    const group = await prisma.clientGroup.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    })
    if (!group) {
      throw new HTTPException(404, { message: 'Client group not found' })
    }

    // Get all cases in group for this tax year with their images
    let cases = await prisma.taxCase.findMany({
      where: {
        client: {
          clientGroupId: id,
          organizationId: orgId,
        },
        taxYear,
      },
      include: {
        client: { select: { id: true, name: true, clientType: true } },
        rawImages: { orderBy: { createdAt: 'desc' } },
      },
    })

    const filedCases = cases.filter((taxCase) => isCaseFiled(taxCase))
    if (filedCases.length > 0) {
      const results = await Promise.all(
        filedCases.map((taxCase) => scheduleIdentityRetentionForFiledCase(taxCase.id))
      )

      if (results.some((result) => result.scheduled > 0)) {
        cases = await prisma.taxCase.findMany({
          where: {
            client: {
              clientGroupId: id,
              organizationId: orgId,
            },
            taxYear,
          },
          include: {
            client: { select: { id: true, name: true, clientType: true } },
            rawImages: { orderBy: { createdAt: 'desc' } },
          },
        })
      }
    }

    // Flatten images with entity info
    const images = cases.flatMap((tc) =>
      tc.rawImages.map((img) => ({
        ...img,
        entityClientId: tc.client.id,
        entityName: tc.client.name,
        entityType: tc.client.clientType,
        createdAt: img.createdAt.toISOString(),
        updatedAt: img.updatedAt.toISOString(),
        retentionDeleteAt: img.retentionDeleteAt?.toISOString() ?? null,
        retentionDeletedAt: img.retentionDeletedAt?.toISOString() ?? null,
        storageDeletedAt: img.storageDeletedAt?.toISOString() ?? null,
      }))
    )

    // Build entity summary
    const entities = cases.map((tc) => ({
      clientId: tc.client.id,
      name: tc.client.name,
      type: tc.client.clientType,
      caseId: tc.id,
      imageCount: tc.rawImages.length,
    }))

    return c.json({ images, entities })
  }
)

export { clientGroupsRoute }
