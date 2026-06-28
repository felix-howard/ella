import type { ActionType, Prisma } from '@ella/db'
import { buildClientScopeFilter, isAdminOrManager } from '../../lib/org-scope'
import { serializePhone } from '../../lib/phone-privacy'
import type { AuthVariables } from '../../middleware/auth'

export function buildActionOwnerScope(user: AuthVariables['user']): Prisma.ActionWhereInput {
  const ownerScopes: Prisma.ActionWhereInput[] = [
    { taxCase: { client: buildClientScopeFilter(user) } },
  ]

  if (isAdminOrManager(user) && user.organizationId) {
    ownerScopes.push({ lead: { organizationId: user.organizationId } })
  }

  return { OR: ownerScopes }
}

export const actionInclude = {
  taxCase: {
    include: {
      client: { select: { id: true, name: true, phone: true } },
    },
  },
  lead: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      businessName: true,
      status: true,
    },
  },
  assignedTo: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ActionInclude

function asMetadataObject(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null
  }
  return metadata as Record<string, unknown>
}

function getBoundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  return value.slice(0, maxLength)
}

function serializeActionMetadata(type: ActionType, metadata: unknown): unknown {
  if (type !== 'CLIENT_REPLIED' && type !== 'LEAD_REPLIED') {
    return metadata
  }

  const source = asMetadataObject(metadata)
  if (!source) return null

  const safeMetadata: Record<string, string | number> = {}
  const messageId = getBoundedString(source.messageId, 120)
  const preview = type === 'CLIENT_REPLIED'
    ? getBoundedString(source.preview, 160)
    : undefined
  const mediaCount = source.mediaCount

  if (messageId) safeMetadata.messageId = messageId
  if (preview) safeMetadata.preview = preview
  if (typeof mediaCount === 'number' && Number.isFinite(mediaCount) && mediaCount >= 0) {
    safeMetadata.mediaCount = Math.trunc(mediaCount)
  }

  return Object.keys(safeMetadata).length > 0 ? safeMetadata : null
}

export function serializeAction<T extends {
  type: ActionType
  metadata: unknown
  taxCase: { client: { phone: string } } | null
  createdAt: Date
  updatedAt: Date
}>(user: AuthVariables['user'], action: T) {
  return {
    ...action,
    metadata: serializeActionMetadata(action.type, action.metadata),
    taxCase: action.taxCase
      ? {
          ...action.taxCase,
          client: {
            ...action.taxCase.client,
            phone: serializePhone(user, action.taxCase.client.phone),
          },
        }
      : null,
    createdAt: action.createdAt.toISOString(),
    updatedAt: action.updatedAt.toISOString(),
  }
}
