/**
 * Agreement service public surface.
 *
 * Entity-aware primaries live in sibling modules (agreement-create-ops,
 * agreement-query-ops, agreement-mutation-ops). This file re-exports them
 * and provides legacy `*ForLead` wrappers + lead-keyed shims (`updateDeposit`,
 * `getPresignedPdfUrl`, `resendNda`) so existing route handlers and tests
 * don't need to change.
 *
 * Public signing flow lives in `agreement-signing-service.ts`. SMS dispatch +
 * persistence concerns live in `agreement-sms.ts`.
 */
import type { AgreementType, Prisma } from '@ella/db'
import type { DepositStatus } from '../../routes/agreements/helpers'
import {
  createAgreementForEntity,
  createNdaForEntity,
  getDefaultHtmlForEntity,
  renderPreviewPdf as renderPreviewPdfForEntity,
} from './agreement-create-ops'
import { listAgreementsForEntity, getPresignedPdfUrlForEntity } from './agreement-query-ops'
import {
  updateDepositForEntity,
  resendAgreementForEntity,
  resendNdaForEntity,
  extendAgreementForEntity,
} from './agreement-mutation-ops'
import {
  createAgreementDraftForEntity,
  updateAgreementDraftForEntity,
  discardAgreementDraftForEntity,
  sendAgreementDraftForEntity,
} from './agreement-draft-ops'
import { storeUploadedPdf } from './agreement-upload-ops'

export { buildAgreementUrl, buildNdaUrl } from './agreement-shared'
export {
  agreementResponseInclude,
  serializeAgreementResponse,
  stripAgreementToken,
  type AgreementResponse,
  type AgreementStaffSummary,
  type AgreementWithResponseRelations,
} from './agreement-response-serializer'
export {
  createAgreementForEntity,
  createNdaForEntity,
  getDefaultHtmlForEntity,
  listAgreementsForEntity,
  updateDepositForEntity,
  getPresignedPdfUrlForEntity,
  resendAgreementForEntity,
  resendNdaForEntity,
  extendAgreementForEntity,
  createAgreementDraftForEntity,
  updateAgreementDraftForEntity,
  discardAgreementDraftForEntity,
  sendAgreementDraftForEntity,
  storeUploadedPdf,
}

/** Legacy alias retained so any caller still importing the old name compiles. */
export const listNdasForEntity = listAgreementsForEntity

/**
 * Renders an in-memory PDF preview of the agreement body. Caller passes the
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
  type?: AgreementType
  title?: string
  templateId?: string
  depositAmount?: Prisma.Decimal | string | number | null
}) {
  return createAgreementForEntity({
    entityType: 'lead',
    entityId: input.leadId,
    orgId: input.orgId,
    staffId: input.staffId,
    contentHtml: input.contentHtml,
    type: input.type,
    title: input.title,
    templateId: input.templateId,
    depositAmount: input.depositAmount,
  })
}

export function getDefaultHtmlForLead(leadId: string, orgId: string) {
  return getDefaultHtmlForEntity({ entityType: 'lead', entityId: leadId, orgId })
}

export function listNdasForLead(leadId: string, orgId: string) {
  return listAgreementsForEntity({ entityType: 'lead', entityId: leadId, orgId })
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
    agreementId: input.ndaId,
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
    agreementId: input.ndaId,
    orgId: input.orgId,
  })
}

export function resendNda(input: {
  ndaId: string
  leadId: string
  orgId: string
  staffId: string
}) {
  return resendAgreementForEntity({
    entityType: 'lead',
    entityId: input.leadId,
    agreementId: input.ndaId,
    orgId: input.orgId,
    staffId: input.staffId,
  })
}
