/**
 * Shared internals for the NDA service split modules.
 * Keeps DRY helpers (URL builder, FK scoping, default template vars) in one
 * spot so create/query/mutation modules don't re-import them transitively.
 */
import type { Prisma } from '@ella/db'
import { PORTAL_URL } from '../../lib/constants'
import { currentTemplate } from '../../lib/nda/template-registry'
import type { TemplateVars } from '../../lib/nda/types'
import type { EntityType } from './entity-loader'

/**
 * Default deposit amount for editor seed + preview renders. Mirrors the
 * `NdaAgreement.depositAmount` schema default — keep in sync if the schema
 * default changes.
 */
export const DEFAULT_DEPOSIT_AMOUNT = '300.00'

export function buildNdaUrl(token: string): string {
  return `${PORTAL_URL}/nda/${token}`
}

/** Maps entityType to the correct FK column on NdaAgreement. */
export function ndaScopeWhere(entityType: EntityType, entityId: string) {
  return entityType === 'lead' ? { leadId: entityId } : { clientId: entityId }
}

export function buildDefaultTemplateVars(input: {
  recipientName: string
  orgName: string
  depositAmount: Prisma.Decimal | { toString(): string }
  date: Date
}): TemplateVars {
  // Both name fields populated identically — leadFullName retained as legacy
  // alias so v1 templates still receive it (see types.ts JSDoc).
  return {
    recipientFullName: input.recipientName,
    leadFullName: input.recipientName,
    orgName: input.orgName,
    depositAmount: `$${input.depositAmount.toString()}`,
    date: input.date.toISOString().slice(0, 10),
    templateVersion: currentTemplate.version,
  }
}
