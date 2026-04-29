/**
 * NDA service public surface.
 *
 * Entity-aware primaries live in sibling modules (nda-create-ops, nda-query-ops,
 * nda-mutation-ops). This file re-exports them and provides legacy `*ForLead`
 * wrappers + lead-keyed shims (`updateDeposit`, `getPresignedPdfUrl`, `resendNda`)
 * so existing route handlers and tests don't need to change.
 *
 * Public signing flow lives in `nda-signing-service.ts`. SMS dispatch +
 * persistence concerns live in `nda-sms.ts`.
 */
import type { DepositStatus } from '../../routes/nda/helpers'
import {
  createNdaForEntity,
  getDefaultHtmlForEntity,
  renderPreviewPdf as renderPreviewPdfForEntity,
} from './nda-create-ops'
import { listNdasForEntity, getPresignedPdfUrlForEntity } from './nda-query-ops'
import { updateDepositForEntity, resendNdaForEntity } from './nda-mutation-ops'

export { buildNdaUrl } from './nda-shared'
export {
  createNdaForEntity,
  getDefaultHtmlForEntity,
  listNdasForEntity,
  updateDepositForEntity,
  getPresignedPdfUrlForEntity,
  resendNdaForEntity,
}

/**
 * Renders an in-memory PDF preview of the NDA body. Caller passes the
 * (possibly-edited) HTML; we sanitize then hand off to the same generator the
 * signing path uses, but in `mode: 'preview'` so the signature block + audit
 * footer are suppressed and the footer is replaced with a PREVIEW marker.
 *
 * Re-exported under the original name `renderPreviewPdf` for backward compat
 * with the lead route handler.
 */
export const renderPreviewPdf = renderPreviewPdfForEntity

// ──────────────────────────────────────────────────────────────────────────
// Legacy lead-keyed wrappers — preserved so existing callers (lead route +
// tests) continue to compile and behave identically.
// ──────────────────────────────────────────────────────────────────────────

export function createNdaForLead(input: {
  leadId: string
  orgId: string
  staffId: string
  contentHtml?: string
}) {
  return createNdaForEntity({
    entityType: 'lead',
    entityId: input.leadId,
    orgId: input.orgId,
    staffId: input.staffId,
    contentHtml: input.contentHtml,
  })
}

export function getDefaultHtmlForLead(leadId: string, orgId: string) {
  return getDefaultHtmlForEntity({ entityType: 'lead', entityId: leadId, orgId })
}

export function listNdasForLead(leadId: string, orgId: string) {
  return listNdasForEntity({ entityType: 'lead', entityId: leadId, orgId })
}

export function updateDeposit(input: {
  ndaId: string
  leadId: string
  orgId: string
  status: DepositStatus
  note: string | null
  paidAt: Date | null
}) {
  return updateDepositForEntity({
    entityType: 'lead',
    entityId: input.leadId,
    ndaId: input.ndaId,
    orgId: input.orgId,
    status: input.status,
    note: input.note,
    paidAt: input.paidAt,
  })
}

export function getPresignedPdfUrl(input: {
  ndaId: string
  leadId: string
  orgId: string
}) {
  return getPresignedPdfUrlForEntity({
    entityType: 'lead',
    entityId: input.leadId,
    ndaId: input.ndaId,
    orgId: input.orgId,
  })
}

export function resendNda(input: {
  ndaId: string
  leadId: string
  orgId: string
  staffId: string
}) {
  return resendNdaForEntity({
    entityType: 'lead',
    entityId: input.leadId,
    ndaId: input.ndaId,
    orgId: input.orgId,
    staffId: input.staffId,
  })
}
