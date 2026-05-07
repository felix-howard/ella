/**
 * Entity loader for agreement flows. Resolves a Lead or Client into a
 * canonical shape `{ id, firstName, lastName, phone, organization: { name } }`
 * so the service layer can stay entity-agnostic.
 *
 * `requirePhone` is opt-in because read paths (default-html, preview-pdf,
 * list) don't need phone — only SMS-bearing flows (create, resend) do.
 *
 * `loadEntityForV2Snapshot` is the v2 NDA variant that also pulls business
 * address fields (clients only) + the firm's governing-law fields so the
 * Agreement row can snapshot a self-contained header block.
 */
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../lib/db'

export type EntityType = 'lead' | 'client'

export interface CanonicalEntity {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  email?: string | null
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
  email: true,
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

// ── v2 NDA snapshot loader ────────────────────────────────────────────────

/** Subset of Organization fields snapshotted into the Agreement header. */
export interface OrgSnapshotFields {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  governingState: string | null
  governingCounty: string | null
  firmPhone: string | null
  firmEmail: string | null
  firmWebsite: string | null
}

/** Client business fields. For BUSINESS clients, `firstName` IS the business
 *  name (Client model has no separate businessName column — see
 *  `apps/api/src/routes/clients/index.ts:402`). Lead has its own `businessName`
 *  scalar; that's exposed via `leadBusinessName` on V2EntitySnapshot. */
export interface ClientSnapshotFields {
  clientType: 'INDIVIDUAL' | 'BUSINESS'
  businessAddress: string | null
  businessCity: string | null
  businessState: string | null
  businessZip: string | null
}

export interface V2EntitySnapshot extends CanonicalEntity {
  organization: OrgSnapshotFields
  /** Lead.businessName when entityType === 'lead', else null (clients keep their
   *  own business fields under `client`). */
  leadBusinessName: string | null
  client: ClientSnapshotFields | null
}

const ORG_V2_SELECT = {
  id: true,
  name: true,
  address: true,
  city: true,
  state: true,
  zip: true,
  governingState: true,
  governingCounty: true,
  firmPhone: true,
  firmEmail: true,
  firmWebsite: true,
} as const

const LEAD_V2_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  businessName: true,
  organization: { select: ORG_V2_SELECT },
} as const

const CLIENT_V2_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  clientType: true,
  businessAddress: true,
  businessCity: true,
  businessState: true,
  businessZip: true,
  organization: { select: ORG_V2_SELECT },
} as const

export async function loadEntityForV2Snapshot(input: LoadEntityInput): Promise<V2EntitySnapshot> {
  const { entityType, entityId, orgId, requirePhone = false } = input
  const where = { id: entityId, organizationId: orgId }

  if (entityType === 'lead') {
    const lead = await prisma.lead.findFirst({ where, select: LEAD_V2_SELECT })
    if (!lead) throw new HTTPException(404, { message: 'Lead not found' })
    if (requirePhone && !lead.phone?.trim()) {
      throw new HTTPException(422, { message: 'Phone required' })
    }
    return {
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: lead.phone,
      email: lead.email,
      organization: lead.organization!,
      leadBusinessName: lead.businessName,
      client: null,
    }
  }

  const client = await prisma.client.findFirst({ where, select: CLIENT_V2_SELECT })
  if (!client) throw new HTTPException(404, { message: 'Client not found' })
  if (requirePhone && !client.phone?.trim()) {
    throw new HTTPException(422, { message: 'Phone required' })
  }
  return {
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    email: client.email,
    organization: client.organization!,
    leadBusinessName: null,
    client: {
      clientType: client.clientType,
      businessAddress: client.businessAddress,
      businessCity: client.businessCity,
      businessState: client.businessState,
      businessZip: client.businessZip,
    },
  }
}

export function composeContactLine(parts: {
  phone?: string | null
  email?: string | null
  website?: string | null
}): string | null {
  const pieces = [parts.phone, parts.email, parts.website]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p)
  return pieces.length > 0 ? pieces.join(' | ') : null
}

/** Compose a "Street, City, ST ZIP" address line, dropping empty pieces.
 *  Returns null when nothing useful is present so callers can render "[Address]"
 *  fallback without misleading commas. */
export function composeAddressLine(parts: {
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}): string | null {
  const street = parts.address?.trim()
  const city = parts.city?.trim()
  const state = parts.state?.trim()
  const zip = parts.zip?.trim()
  const cityStateZip = [city, [state, zip].filter(Boolean).join(' ').trim()]
    .filter((s) => s && s.length > 0)
    .join(', ')
  const composed = [street, cityStateZip].filter((s) => s && s.length > 0).join(', ')
  return composed.length > 0 ? composed : null
}

/** Resolve "what the client is called in the header / signature block".
 *  BUSINESS client → firstName (Client uses firstName as the business name —
 *  see `routes/clients/index.ts:402`). Lead with businessName → businessName.
 *  Otherwise → "FirstName LastName". */
export function resolveClientNameOrBusiness(input: {
  firstName: string | null
  lastName: string | null
  client?: { clientType: 'INDIVIDUAL' | 'BUSINESS' } | null
  leadBusinessName?: string | null
}): string {
  const fullName = formatRecipientName({ firstName: input.firstName, lastName: input.lastName })
  if (input.client?.clientType === 'BUSINESS') {
    return input.firstName?.trim() || fullName
  }
  if (input.leadBusinessName?.trim()) return input.leadBusinessName.trim()
  return fullName
}
