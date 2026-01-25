/**
 * Portal API routes (Public)
 * Magic link access and document upload for clients
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import { validateMagicLink } from '../../services/magic-link'
import { validateUploadedFiles } from '../../lib/validation'
import { DOC_TYPE_LABELS_VI, CHECKLIST_STATUS_LABELS_VI } from '../../lib/constants'
import { isGeminiConfigured } from '../../services/ai'
import { uploadFile, generateFileKey } from '../../services/storage'
import { inngest } from '../../lib/inngest'
import { updateLastActivity } from '../../services/activity-tracker'

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

  // Validate uploaded files (type, size, count)
  const validation = validateUploadedFiles(files)
  if (!validation.valid) {
    const errorMessages: Record<string, string> = {
      NO_FILES: 'Vui lòng chọn ít nhất một file',
      TOO_MANY_FILES: 'Quá nhiều file. Tối đa 20 file mỗi lần tải lên',
      FILE_TOO_LARGE: 'File quá lớn. Tối đa 10MB mỗi file',
      INVALID_TYPE: 'Loại file không được hỗ trợ. Chỉ chấp nhận ảnh (JPEG, PNG, WebP, HEIC) và PDF',
    }
    return c.json(
      {
        error: validation.errorCode || 'VALIDATION_ERROR',
        message: errorMessages[validation.errorCode || 'NO_FILES'] || validation.error,
      },
      400
    )
  }

  // Process each file: upload to R2 + trigger background classification
  const createdImages: { id: string; filename: string; status: string; createdAt: string }[] = []
  const inngestEvents: { name: 'document/uploaded'; data: { rawImageId: string; caseId: string; r2Key: string; mimeType: string; uploadedAt: string } }[] = []

  for (const file of files) {
    // Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const mimeType = file.type || 'image/jpeg'

    // Generate R2 key and upload
    const r2Key = generateFileKey(caseId, file.name, 'raw')
    await uploadFile(r2Key, buffer, mimeType)

    // Create raw image record
    const rawImage = await prisma.rawImage.create({
      data: {
        caseId,
        r2Key,
        filename: file.name,
        mimeType,
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

    // Queue background classification job if AI configured
    if (isGeminiConfigured) {
      inngestEvents.push({
        name: 'document/uploaded' as const,
        data: {
          rawImageId: rawImage.id,
          caseId,
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
            caseId,
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

  // Update case activity timestamp (client uploaded documents)
  if (createdImages.length > 0) {
    await updateLastActivity(caseId)
  }

  // Create manual review action only if AI is not configured
  if (createdImages.length > 0 && !isGeminiConfigured) {
    await prisma.action.create({
      data: {
        caseId,
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
