/**
 * Shared internals for the agreement service split modules.
 * Keeps DRY helpers (URL builder, FK scoping, default template vars) in one
 * spot so create/query/mutation modules don't re-import them transitively.
 */
import type { Prisma } from '@ella/db'
import { PORTAL_URL } from '../../lib/constants'
import { currentTemplate } from '../../lib/agreements/template-registry'
import type { TemplateVars } from '../../lib/agreements/types'
import type { EntityType } from './entity-loader'

/**
 * Default deposit amount for editor seed + preview renders when an NDA-style
 * deposit is implied but no explicit amount is supplied by the caller.
 * Per-send amount is now opt-in (`Agreement.depositAmount` is nullable);
 * this constant is only used to seed previews/template renders.
 */
export const DEFAULT_DEPOSIT_AMOUNT = '300.00'

/** Public signing portal URL. Path stays `/nda/:token` for back-compat with
 *  existing customer SMS links; Phase 06 adds `/agreements/:token` alias. */
export function buildAgreementUrl(token: string): string {
  return `${PORTAL_URL}/nda/${token}`
}

/** Legacy alias — preserved so transitional callers compile. */
export const buildNdaUrl = buildAgreementUrl

/** Maps entityType to the correct FK column on Agreement. */
export function agreementScopeWhere(entityType: EntityType, entityId: string) {
  return entityType === 'lead' ? { leadId: entityId } : { clientId: entityId }
}

/**
 * Organization fields consumed by buildDefaultTemplateVars.
 * Subset of the full Organization model — pass only what you have.
 *
 * Backward compat: callers that only have `name` can omit the rest.
 * governingState / governingCounty are optional; missing values produce
 * preview-safe placeholder text ("[State]", "[County, State]").
 */
export interface OrganizationVarsInput {
  name: string
  governingState?: string | null
  governingCounty?: string | null
}

export function buildDefaultTemplateVars(input: {
  recipientName: string
  /** Legacy: plain org name string. New callers should prefer `organization`. */
  orgName?: string
  /** v2: full org object with governing law fields. When present, name takes
   *  precedence over the legacy `orgName` string. */
  organization?: OrganizationVarsInput
  depositAmount: Prisma.Decimal | { toString(): string }
  date: Date
}): TemplateVars {
  // Resolve org name: prefer organization.name, fall back to legacy orgName.
  const org = input.organization
  const orgName = org?.name ?? input.orgName ?? ''

  const governingState = org?.governingState?.trim() || undefined
  // Compose "{county}, {state}" if we have both; otherwise fall through to undefined
  // so the template uses its own fallback placeholder.
  const governingCounty = org?.governingCounty?.trim() || undefined

  // Both name fields populated identically — leadFullName retained as legacy
  // alias so v1 templates still receive it (see types.ts JSDoc).
  return {
    recipientFullName: input.recipientName,
    leadFullName: input.recipientName,
    orgName,
    depositAmount: `$${input.depositAmount.toString()}`,
    date: input.date.toISOString().slice(0, 10),
    templateVersion: currentTemplate.version,
    governingState,
    governingCounty,
    confidentialityYears: 'five (5)',
  }
}
