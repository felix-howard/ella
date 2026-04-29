/**
 * Entity loader for NDA flows. Resolves a Lead or Client into a canonical
 * shape `{ id, firstName, lastName, phone, organization: { name } }` so the
 * service layer can stay entity-agnostic.
 *
 * `requirePhone` is opt-in because read paths (default-html, preview-pdf,
 * list) don't need phone — only SMS-bearing flows (create, resend) do.
 */
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../lib/db'

export type EntityType = 'lead' | 'client'

export interface CanonicalEntity {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  organization: { name: string }
}

export interface LoadEntityInput {
  entityType: EntityType
  entityId: string
  orgId: string
  requirePhone?: boolean
}

const ENTITY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  organization: { select: { name: true } },
} as const

export async function loadEntityWithOrg(input: LoadEntityInput): Promise<CanonicalEntity> {
  const { entityType, entityId, orgId, requirePhone = false } = input
  const where = { id: entityId, organizationId: orgId }

  const found =
    entityType === 'lead'
      ? await prisma.lead.findFirst({ where, select: ENTITY_SELECT })
      : await prisma.client.findFirst({ where, select: ENTITY_SELECT })

  if (!found) {
    throw new HTTPException(404, { message: `${entityType === 'lead' ? 'Lead' : 'Client'} not found` })
  }

  if (requirePhone && !found.phone?.trim()) {
    throw new HTTPException(422, { message: 'Phone required' })
  }

  return found as CanonicalEntity
}

export function formatRecipientName(entity: {
  firstName: string | null
  lastName: string | null
}): string {
  const parts = [entity.firstName, entity.lastName].filter(
    (p): p is string => !!p && p.trim().length > 0,
  )
  return parts.join(' ').trim() || 'Unnamed Recipient'
}
