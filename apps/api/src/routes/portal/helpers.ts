/**
 * Portal route helpers
 * Shared scope-validation and payload-shaping utilities for /portal/:token endpoints.
 */
import { prisma } from '../../lib/db'
import { DOC_TYPE_LABELS_VI, CHECKLIST_STATUS_LABELS_VI } from '../../lib/constants'
import type { MagicLinkValidationResult } from '../../services/magic-link'

export const PORTAL_ERROR_MESSAGES: Record<string, string> = {
  INVALID_TOKEN: 'Link không hợp lệ. Vui lòng liên hệ văn phòng thuế.',
  EXPIRED_TOKEN: 'Link đã hết hạn. Vui lòng liên hệ văn phòng thuế.',
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
      message: 'Loại tài liệu không hợp lệ',
    }
  }

  if (link.scope !== 'GROUP' || !link.clientGroupId) {
    return {
      ok: false,
      status: 403,
      code: 'INVALID_TARGET_CASE',
      message: 'Loại tài liệu không hợp lệ',
    }
  }

  if (target.client.clientGroupId !== link.clientGroupId) {
    return {
      ok: false,
      status: 403,
      code: 'INVALID_TARGET_CASE',
      message: 'Loại tài liệu không hợp lệ',
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
      message: 'Loại tài liệu không hợp lệ',
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
      labelVi: DOC_TYPE_LABELS_VI[item.template.docType] || item.template.labelVi,
      status: CHECKLIST_STATUS_LABELS_VI[item.status],
    }))

  const blurry = rawImages
    .filter((img) => img.status === 'BLURRY')
    .map((img) => ({
      id: img.id,
      docType: img.classifiedType,
      labelVi: img.classifiedType
        ? DOC_TYPE_LABELS_VI[img.classifiedType] || img.classifiedType
        : 'Ảnh không rõ',
      reason: 'Ảnh bị mờ, vui lòng gửi lại',
    }))

  const missing = checklistItems
    .filter((item) => item.status === 'MISSING')
    .map((item) => ({
      id: item.id,
      docType: item.template.docType,
      labelVi: DOC_TYPE_LABELS_VI[item.template.docType] || item.template.labelVi,
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
