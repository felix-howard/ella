/**
 * Portal API routes (Public)
 * Magic link access and document upload for clients
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import { validateMagicLink } from '../../services/magic-link'
import { validateUploadedFiles } from '../../lib/validation'
import { isGeminiConfigured } from '../../services/ai'
import { uploadFile, generateFileKey } from '../../services/storage'
import { inngest } from '../../lib/inngest'
import { updateLastActivity } from '../../services/activity-tracker'
import {
  PORTAL_ERROR_MESSAGES,
  assertCaseInScope,
  buildCaseChecklistPayload,
} from './helpers'

const portalRoute = new Hono()

// GET /portal/:token - Get portal data via magic link
portalRoute.get('/:token', async (c) => {
  const token = c.req.param('token')
  const result = await validateMagicLink(token)

  if (!result.valid || !result.data) {
    const errorCode = result.error || 'INVALID_TOKEN'
    return c.json(
      {
        error: errorCode,
        message: PORTAL_ERROR_MESSAGES[errorCode] || PORTAL_ERROR_MESSAGES.INVALID_TOKEN,
      },
      401
    )
  }

  const { scope, entities, taxCase, clientGroup, clientGroupId } = result.data

  // Per-entity uploads short-circuit: GET /portal/:token?caseId=xxx
  // Returns { uploads: [...] } for that case (after scope check). Used by
  // EntityUploadPage to render the "uploaded files" list without bloating
  // the landing payload.
  const queryCaseId = c.req.query('caseId')
  if (queryCaseId) {
    // Validate scope: case must belong to the same group/org as the link
    if (scope === 'CASE') {
      // CASE-scope link only authorizes its own case
      if (!taxCase || taxCase.id !== queryCaseId) {
        return c.json(
          { error: 'INVALID_TARGET_CASE', message: 'Loại tài liệu không hợp lệ' },
          403
        )
      }
    } else {
      const scopeCheck = await assertCaseInScope(queryCaseId, {
        scope,
        clientGroupId,
        clientGroup: clientGroup ? { organizationId: clientGroup.organizationId } : null,
      })
      if (!scopeCheck.ok) {
        return c.json({ error: scopeCheck.code, message: scopeCheck.message }, scopeCheck.status)
      }
    }

    const uploads = await prisma.rawImage.findMany({
      where: { caseId: queryCaseId },
      select: {
        id: true,
        filename: true,
        displayName: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return c.json({
      uploads: uploads.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
    })
  }

  // Resolve client display info from anchor case (CASE) or first entity (GROUP)
  const displayName =
    taxCase?.client.name ||
    clientGroup?.name ||
    entities[0]?.name ||
    'Khách hàng'
  const displayLanguage = taxCase?.client.language || 'VI'
  const displayTaxYear = taxCase?.taxYear ?? entities[0]?.taxYear

  const basePayload = {
    scope,
    client: {
      name: displayName,
      language: displayLanguage,
    },
    entities,
  }

  if (scope === 'GROUP') {
    // Multi-entity payload — checklist/stats are per-entity (in entities[])
    return c.json({
      ...basePayload,
      taxYear: displayTaxYear,
      clientGroup: clientGroup
        ? { id: clientGroup.id, name: clientGroup.name }
        : null,
    })
  }

  // scope === 'CASE' — keep legacy single-entity shape (back-compat)
  const checklistPayload = buildCaseChecklistPayload(result.data)
  return c.json({
    ...basePayload,
    taxCase: taxCase
      ? {
          id: taxCase.id,
          taxYear: taxCase.taxYear,
          status: taxCase.status,
        }
      : null,
    ...(checklistPayload || {}),
  })
})

// POST /portal/:token/upload - Upload documents via portal
portalRoute.post('/:token/upload', async (c) => {
  const token = c.req.param('token')
  const result = await validateMagicLink(token)

  if (!result.valid || !result.data) {
    return c.json(
      { error: 'INVALID_TOKEN', message: 'Link không hợp lệ hoặc đã hết hạn' },
      401
    )
  }

  const { scope, clientGroupId, taxCase, clientGroup } = result.data

  // Parse multipart form data
  const formData = await c.req.formData()
  const files = formData.getAll('files') as File[]
  const targetCaseIdRaw = formData.get('targetCaseId')
  const targetCaseId =
    typeof targetCaseIdRaw === 'string' && targetCaseIdRaw.trim()
      ? targetCaseIdRaw.trim()
      : null

  // GROUP-scoped tokens require an explicit targetCaseId
  if (scope === 'GROUP' && !targetCaseId) {
    return c.json(
      {
        error: 'TARGET_CASE_REQUIRED',
        message: 'Vui lòng chọn loại tài liệu trước khi tải lên',
      },
      400
    )
  }

  // If a targetCaseId was supplied, validate same group + org
  if (targetCaseId) {
    const scopeCheck = await assertCaseInScope(targetCaseId, {
      scope,
      clientGroupId,
      clientGroup: clientGroup ? { organizationId: clientGroup.organizationId } : null,
    })
    if (!scopeCheck.ok) {
      return c.json({ error: scopeCheck.code, message: scopeCheck.message }, scopeCheck.status)
    }
  }

  // For scope=CASE without targetCaseId, fall back to the link's own caseId
  const effectiveCaseId = targetCaseId || taxCase?.id
  if (!effectiveCaseId) {
    return c.json(
      { error: 'TARGET_CASE_REQUIRED', message: 'Không xác định được hồ sơ thuế' },
      400
    )
  }

  // Validate uploaded files (type, size, count)
  const validation = validateUploadedFiles(files)
  if (!validation.valid) {
    const errorMessages: Record<string, string> = {
      NO_FILES: 'Vui lòng chọn ít nhất một file',
      TOO_MANY_FILES: 'Quá nhiều file. Tối đa 50 file mỗi lần tải lên',
      FILE_TOO_LARGE: 'File quá lớn. Tối đa 10MB mỗi file',
      INVALID_TYPE:
        'Loại file không được hỗ trợ. Chỉ chấp nhận ảnh (JPEG, PNG, WebP, HEIC) và PDF',
    }
    return c.json(
      {
        error: validation.errorCode || 'VALIDATION_ERROR',
        message: errorMessages[validation.errorCode || 'NO_FILES'] || validation.error,
      },
      400
    )
  }

  // Owner explicitly picked entity → skip AI entity routing downstream
  const uploadSource = targetCaseId ? 'PORTAL_EXPLICIT' : 'PORTAL_AI'

  // Process each file: upload to R2 + trigger background classification
  const createdImages: { id: string; filename: string; status: string; createdAt: string }[] = []
  const inngestEvents: {
    name: 'document/uploaded'
    data: {
      rawImageId: string
      caseId: string
      r2Key: string
      mimeType: string
      uploadedAt: string
    }
  }[] = []

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const mimeType = file.type || 'image/jpeg'

    const r2Key = generateFileKey(effectiveCaseId, file.name, 'raw')
    await uploadFile(r2Key, buffer, mimeType)

    const rawImage = await prisma.rawImage.create({
      data: {
        caseId: effectiveCaseId,
        r2Key,
        filename: file.name,
        mimeType,
        fileSize: file.size,
        status: 'UPLOADED',
        uploadedVia: 'PORTAL',
        uploadSource,
      },
    })

    createdImages.push({
      id: rawImage.id,
      filename: rawImage.filename,
      status: rawImage.status,
      createdAt: rawImage.createdAt.toISOString(),
    })

    if (isGeminiConfigured) {
      inngestEvents.push({
        name: 'document/uploaded' as const,
        data: {
          rawImageId: rawImage.id,
          caseId: effectiveCaseId,
          r2Key,
          mimeType,
          uploadedAt: new Date().toISOString(),
        },
      })
    }
  }

  // Send Inngest events (non-blocking to prevent upload failure if Inngest unavailable)
  if (inngestEvents.length > 0) {
    inngest.send(inngestEvents).catch((err) => {
      console.error('[Portal] Failed to queue AI processing:', err.message)
      // Create manual review action as fallback
      prisma.action
        .create({
          data: {
            caseId: effectiveCaseId,
            type: 'VERIFY_DOCS',
            priority: 'NORMAL',
            title: 'Tài liệu cần phân loại',
            description: `${createdImages.length} file được tải lên - cần phân loại thủ công`,
            metadata: { rawImageIds: createdImages.map((img) => img.id) },
          },
        })
        .catch(console.error)
    })
  }

  if (createdImages.length > 0) {
    await updateLastActivity(effectiveCaseId)
  }

  if (createdImages.length > 0 && !isGeminiConfigured) {
    await prisma.action.create({
      data: {
        caseId: effectiveCaseId,
        type: 'VERIFY_DOCS',
        priority: 'HIGH',
        title: 'Tài liệu mới từ khách hàng',
        description: `Khách hàng đã gửi ${createdImages.length} file qua portal - cần phân loại thủ công`,
        metadata: { rawImageIds: createdImages.map((img) => img.id) },
      },
    })
  }

  return c.json({
    uploaded: createdImages.length,
    images: createdImages,
    aiProcessing: isGeminiConfigured,
    message: isGeminiConfigured
      ? `Đã nhận ${createdImages.length} file. Đang xử lý tự động...`
      : `Đã nhận ${createdImages.length} file. Cảm ơn bạn!`,
  })
})

export { portalRoute }
