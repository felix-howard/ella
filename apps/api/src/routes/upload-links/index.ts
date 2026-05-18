import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { ActivityRiskLevel } from '@ella/db'
import { prisma } from '../../lib/db'
import { buildNestedClientScope } from '../../lib/org-scope'
import type { AuthVariables } from '../../middleware/auth'
import type { AuthUser } from '../../services/auth'
import {
  createPortalMagicLink,
  getMagicLinkStatus,
  getMagicLinkUrl,
  type MagicLinkStatus,
} from '../../services/magic-link'
import {
  getAuditRequestContext,
  logStaffActivity,
} from '../../services/activity-log'
import {
  caseIdParamSchema,
  extendUploadLinkSchema,
  linkIdParamSchema,
} from './schemas'

const uploadLinksRoute = new Hono<{ Variables: AuthVariables }>()

const DAY_MS = 24 * 60 * 60 * 1000

type ScopedLink = Awaited<ReturnType<typeof findScopedPortalLink>>

interface SerializableLink {
  id: string
  token: string
  scope: 'CASE' | 'GROUP'
  clientGroupId: string | null
  expiresAt: Date | null
  isActive: boolean
  revokedAt: Date | null
  extendedAt: Date | null
  replacedById: string | null
  lastUsedAt: Date | null
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

function serializeLink(link: SerializableLink) {
  const status = getMagicLinkStatus(link)
  return {
    id: link.id,
    status,
    url: status === 'ACTIVE' ? getMagicLinkUrl(link.token, 'PORTAL') : null,
    scope: link.scope,
    clientGroupId: link.clientGroupId,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    revokedAt: link.revokedAt?.toISOString() ?? null,
    extendedAt: link.extendedAt?.toISOString() ?? null,
    lastUsedAt: link.lastUsedAt?.toISOString() ?? null,
    usageCount: link.usageCount,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  }
}

async function findScopedCase(user: AuthUser, caseId: string) {
  return prisma.taxCase.findFirst({
    where: {
      id: caseId,
      ...buildNestedClientScope(user),
    },
    select: {
      id: true,
      taxYear: true,
      client: {
        select: {
          id: true,
          name: true,
          organizationId: true,
          clientGroupId: true,
        },
      },
    },
  })
}

async function findScopedPortalLink(user: AuthUser, id: string) {
  return prisma.magicLink.findFirst({
    where: {
      id,
      type: 'PORTAL',
      taxCase: buildNestedClientScope(user),
    },
    include: {
      taxCase: {
        select: {
          id: true,
          taxYear: true,
          client: {
            select: {
              id: true,
              name: true,
              organizationId: true,
              clientGroupId: true,
            },
          },
        },
      },
    },
  })
}

function linkLogBase(user: AuthUser, link: NonNullable<ScopedLink>) {
  return {
    organizationId: link.taxCase?.client.organizationId ?? user.organizationId,
    clientId: link.taxCase?.client.id,
    caseId: link.caseId,
    magicLinkId: link.id,
  }
}

async function logUploadLinkAction(
  c: Parameters<typeof getAuditRequestContext>[0],
  user: AuthUser,
  link: NonNullable<ScopedLink>,
  action: string,
  riskLevel: ActivityRiskLevel,
  metadata: Record<string, unknown>
) {
  if (!user.staffId) return
  await logStaffActivity({
    ...linkLogBase(user, link),
    actorStaffId: user.staffId,
    action,
    riskLevel,
    metadata,
    request: getAuditRequestContext(c),
  })
}

function addDays(days: number) {
  return new Date(Date.now() + days * DAY_MS)
}

// GET /upload-links/cases/:caseId
uploadLinksRoute.get(
  '/cases/:caseId',
  zValidator('param', caseIdParamSchema),
  async (c) => {
    const user = c.get('user')
    const { caseId } = c.req.valid('param')
    const taxCase = await findScopedCase(user, caseId)
    if (!taxCase) {
      return c.json({ error: 'NOT_FOUND', message: 'Tax case not found' }, 404)
    }

    const links = await prisma.magicLink.findMany({
      where: { caseId, type: 'PORTAL' },
      orderBy: { createdAt: 'desc' },
      include: {
        taxCase: {
          select: {
            id: true,
            taxYear: true,
            client: {
              select: {
                id: true,
                name: true,
                organizationId: true,
                clientGroupId: true,
              },
            },
          },
        },
      },
    })

    return c.json({
      data: links.map((link) => serializeLink(link)),
      taxCase: {
        id: taxCase.id,
        taxYear: taxCase.taxYear,
        client: {
          id: taxCase.client.id,
          name: taxCase.client.name,
        },
      },
    })
  }
)

// POST /upload-links/:id/revoke
uploadLinksRoute.post(
  '/:id/revoke',
  zValidator('param', linkIdParamSchema),
  async (c) => {
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const link = await findScopedPortalLink(user, id)
    if (!link) {
      return c.json({ error: 'NOT_FOUND', message: 'Upload link not found' }, 404)
    }

    const previousStatus = getMagicLinkStatus(link)
    const updated = await prisma.magicLink.update({
      where: { id },
      data: {
        isActive: false,
        revokedAt: link.revokedAt ?? new Date(),
        revokedById: link.revokedById ?? user.staffId,
      },
      include: { taxCase: { select: { id: true, client: { select: { id: true, organizationId: true } } } } },
    })

    await logUploadLinkAction(c, user, link, 'upload_link.revoked', ActivityRiskLevel.HIGH, {
      previousStatus,
      newStatus: 'REVOKED' satisfies MagicLinkStatus,
    })

    return c.json({ success: true, magicLink: serializeLink(updated) })
  }
)

// POST /upload-links/:id/extend
uploadLinksRoute.post(
  '/:id/extend',
  zValidator('param', linkIdParamSchema),
  zValidator('json', extendUploadLinkSchema),
  async (c) => {
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const { days } = c.req.valid('json')
    const link = await findScopedPortalLink(user, id)
    if (!link) {
      return c.json({ error: 'NOT_FOUND', message: 'Upload link not found' }, 404)
    }

    const status = getMagicLinkStatus(link)
    if (status === 'REVOKED' || status === 'REPLACED') {
      return c.json({ error: 'LINK_NOT_ACTIVE', message: 'Only active or expired links can be extended' }, 400)
    }

    const expiresAt = addDays(days)
    const updated = await prisma.magicLink.update({
      where: { id },
      data: {
        expiresAt,
        isActive: true,
        extendedAt: new Date(),
        extendedById: user.staffId,
      },
      include: { taxCase: { select: { id: true, client: { select: { id: true, organizationId: true } } } } },
    })

    await logUploadLinkAction(c, user, link, 'upload_link.extended', ActivityRiskLevel.MEDIUM, {
      previousStatus: status,
      days,
      expiresAt: expiresAt.toISOString(),
    })

    return c.json({
      success: true,
      expiresAt: expiresAt.toISOString(),
      magicLink: serializeLink(updated),
    })
  }
)

// POST /upload-links/cases/:caseId/generate
uploadLinksRoute.post(
  '/cases/:caseId/generate',
  zValidator('param', caseIdParamSchema),
  async (c) => {
    const user = c.get('user')
    const { caseId } = c.req.valid('param')
    const taxCase = await findScopedCase(user, caseId)
    if (!taxCase) {
      return c.json({ error: 'NOT_FOUND', message: 'Tax case not found' }, 404)
    }

    const scope = taxCase.client.clientGroupId ? 'GROUP' : 'CASE'
    const created = await createPortalMagicLink(caseId, {
      scope,
      clientGroupId: taxCase.client.clientGroupId ?? undefined,
    })

    const link = await findScopedPortalLink(user, created.id)
    if (!link) {
      return c.json({ error: 'LINK_NOT_FOUND', message: 'Generated link was not found' }, 500)
    }

    await logUploadLinkAction(c, user, link, 'upload_link.generated', ActivityRiskLevel.HIGH, {
      scope: created.scope,
      clientGroupId: created.clientGroupId,
      expiresAt: created.expiresAt?.toISOString() ?? null,
    })

    return c.json({
      success: true,
      magicLink: serializeLink(link),
    })
  }
)

export { uploadLinksRoute }
