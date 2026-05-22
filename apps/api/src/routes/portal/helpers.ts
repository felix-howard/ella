/**
 * Portal route helpers
 * Shared scope-validation and payload-shaping utilities for /portal/:token endpoints.
 */
import { prisma } from '../../lib/db'
import {
  BLURRY_IMAGE_RESEND_REASONS,
  CHECKLIST_STATUS_LABELS_EN,
  CHECKLIST_STATUS_LABELS_VI,
  UNCLEAR_IMAGE_LABELS,
} from '../../lib/constants'
import { getDocTypeLabel } from '../../services/ai/document-classifier'
import type { MagicLinkValidationResult } from '../../services/magic-link'

export const PORTAL_ERROR_MESSAGES: Record<string, string> = {
  INVALID_TOKEN: 'This link is invalid. Please contact the tax office.',
  EXPIRED_TOKEN: 'This link has expired. Please contact the tax office.',
}

const INVALID_TARGET_CASE_MESSAGE = 'Invalid document target'

function getPortalDocTypeLabel(docType: string, language: 'EN' | 'VI' = 'EN'): string {
  return getDocTypeLabel(docType as Parameters<typeof getDocTypeLabel>[0], language)
}

/**
 * Verify that a target tax case belongs to the same ClientGroup AND organization
 * as the magic link. Defends against forged targetCaseId values.
 */
export async function assertCaseInScope(
  targetCaseId: string,
  link: { scope: 'CASE' | 'GROUP'; clientGroupId: string | null; clientGroup?: { organizationId: string | null } | null }
): Promise<{ ok: true } | { ok: false; status: 403 | 404; code: string; message: string }> {
  const target = await prisma.taxCase.findUnique({
    where: { id: targetCaseId },
    select: {
      id: true,
      client: {
        select: {
          clientGroupId: true,
          organizationId: true,
          clientGroup: { select: { organizationId: true } },
        },
      },
    },
  })

  if (!target) {
    return {
      ok: false,
      status: 404,
      code: 'INVALID_TARGET_CASE',
      message: INVALID_TARGET_CASE_MESSAGE,
    }
  }

  if (link.scope !== 'GROUP' || !link.clientGroupId) {
    return {
      ok: false,
      status: 403,
      code: 'INVALID_TARGET_CASE',
      message: INVALID_TARGET_CASE_MESSAGE,
    }
  }

  if (target.client.clientGroupId !== link.clientGroupId) {
    return {
      ok: false,
      status: 403,
      code: 'INVALID_TARGET_CASE',
      message: INVALID_TARGET_CASE_MESSAGE,
    }
  }

  // Defense-in-depth: verify same organization in case ClientGroup was reassigned
  const linkOrgId = link.clientGroup?.organizationId ?? null
  const caseOrgId = target.client.clientGroup?.organizationId ?? target.client.organizationId
  if (linkOrgId && caseOrgId && linkOrgId !== caseOrgId) {
    return {
      ok: false,
      status: 403,
      code: 'INVALID_TARGET_CASE',
      message: INVALID_TARGET_CASE_MESSAGE,
    }
  }

  return { ok: true }
}

/**
 * Build the legacy scope=CASE GET payload (checklist/stats blocks).
 * Returns null when called for scope=GROUP (entities[] is used instead).
 */
export function buildCaseChecklistPayload(
  data: NonNullable<MagicLinkValidationResult['data']>
) {
  if (!data.taxCase) return null
  const { checklistItems, rawImages } = data.taxCase

  const received = checklistItems
    .filter((item) => item.status === 'VERIFIED' || item.status === 'HAS_DIGITAL')
    .map((item) => ({
      id: item.id,
      docType: item.template.docType,
      labelEn: getPortalDocTypeLabel(item.template.docType),
      labelVi: getPortalDocTypeLabel(item.template.docType, 'VI') || item.template.labelVi,
      status: CHECKLIST_STATUS_LABELS_EN[item.status],
      statusEn: CHECKLIST_STATUS_LABELS_EN[item.status],
      statusVi: CHECKLIST_STATUS_LABELS_VI[item.status],
    }))

  const blurry = rawImages
    .filter((img) => img.status === 'BLURRY')
    .map((img) => ({
      id: img.id,
      docType: img.classifiedType,
      labelEn: img.classifiedType
        ? getPortalDocTypeLabel(img.classifiedType)
        : UNCLEAR_IMAGE_LABELS.EN,
      labelVi: img.classifiedType
        ? getPortalDocTypeLabel(img.classifiedType, 'VI')
        : UNCLEAR_IMAGE_LABELS.VI,
      reason: BLURRY_IMAGE_RESEND_REASONS.EN,
      reasonEn: BLURRY_IMAGE_RESEND_REASONS.EN,
      reasonVi: BLURRY_IMAGE_RESEND_REASONS.VI,
    }))

  const missing = checklistItems
    .filter((item) => item.status === 'MISSING')
    .map((item) => ({
      id: item.id,
      docType: item.template.docType,
      labelEn: getPortalDocTypeLabel(item.template.docType),
      labelVi: getPortalDocTypeLabel(item.template.docType, 'VI') || item.template.labelVi,
    }))

  return {
    checklist: { received, blurry, missing },
    stats: {
      uploaded: rawImages.length,
      verified: checklistItems.filter((item) => item.status === 'VERIFIED').length,
      missing: missing.length,
    },
  }
}
