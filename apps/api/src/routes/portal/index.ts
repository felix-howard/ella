/**
 * Portal API routes (Public)
 * Magic link access and document upload for clients
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import { validateMagicLink } from '../../services/magic-link'
import { DOC_TYPE_LABELS_VI, CHECKLIST_STATUS_LABELS_VI } from '../../lib/constants'

const portalRoute = new Hono()

// GET /portal/:token - Get portal data via magic link
portalRoute.get('/:token', async (c) => {
  const token = c.req.param('token')

  const result = await validateMagicLink(token)

  if (!result.valid || !result.data) {
    const messages = {
      INVALID_TOKEN: 'Link không hợp lệ. Vui lòng liên hệ văn phòng thuế.',
      EXPIRED_TOKEN: 'Link đã hết hạn. Vui lòng liên hệ văn phòng thuế.',
    }
    return c.json(
      {
        error: result.error || 'INVALID_TOKEN',
        message: messages[(result.error || 'INVALID_TOKEN') as keyof typeof messages],
      },
      401
    )
  }

  const { taxCase } = result.data
  const { client, checklistItems, rawImages } = taxCase

  // Group checklist items by status
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

  // Calculate stats
  const stats = {
    uploaded: rawImages.length,
    verified: checklistItems.filter((item) => item.status === 'VERIFIED').length,
    missing: missing.length,
  }

  return c.json({
    client: {
      name: client.name,
      language: client.language,
    },
    taxCase: {
      id: taxCase.id,
      taxYear: taxCase.taxYear,
      status: taxCase.status,
    },
    checklist: {
      received,
      blurry,
      missing,
    },
    stats,
  })
})

// POST /portal/:token/upload - Upload documents via portal
portalRoute.post('/:token/upload', async (c) => {
  const token = c.req.param('token')

  // Validate magic link
  const result = await validateMagicLink(token)

  if (!result.valid || !result.data) {
    return c.json(
      {
        error: 'INVALID_TOKEN',
        message: 'Link không hợp lệ hoặc đã hết hạn',
      },
      401
    )
  }

  const caseId = result.data.taxCase.id

  // Parse multipart form data
  const formData = await c.req.formData()
  const files = formData.getAll('files') as File[]

  if (files.length === 0) {
    return c.json(
      {
        error: 'NO_FILES',
        message: 'Vui lòng chọn ít nhất một file',
      },
      400
    )
  }

  // For each file, create RawImage record
  // In Phase 2, this will also upload to R2 and trigger AI processing
  const createdImages = []

  for (const file of files) {
    // Generate a placeholder R2 key (actual upload in Phase 2)
    const r2Key = `cases/${caseId}/${Date.now()}-${file.name}`

    const rawImage = await prisma.rawImage.create({
      data: {
        caseId,
        r2Key,
        filename: file.name,
        mimeType: file.type || 'image/jpeg',
        fileSize: file.size,
        status: 'UPLOADED',
        uploadedVia: 'PORTAL',
      },
    })

    createdImages.push({
      id: rawImage.id,
      filename: rawImage.filename,
      status: rawImage.status,
      createdAt: rawImage.createdAt.toISOString(),
    })
  }

  // Create action for staff to review (once per upload batch)
  if (createdImages.length > 0) {
    await prisma.action.create({
      data: {
        caseId,
        type: 'VERIFY_DOCS',
        priority: 'HIGH',
        title: 'Tài liệu mới từ khách hàng',
        description: `Khách hàng đã gửi ${createdImages.length} file qua portal`,
        metadata: { rawImageIds: createdImages.map((img) => img.id) },
      },
    })
  }

  return c.json({
    uploaded: createdImages.length,
    images: createdImages,
    message: `Đã nhận ${createdImages.length} file. Cảm ơn bạn!`,
  })
})

export { portalRoute }
