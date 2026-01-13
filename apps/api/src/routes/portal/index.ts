/**
 * Portal API routes (Public)
 * Magic link access and document upload for clients
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import { validateMagicLink } from '../../services/magic-link'
import { validateUploadedFiles } from '../../lib/validation'
import { DOC_TYPE_LABELS_VI, CHECKLIST_STATUS_LABELS_VI } from '../../lib/constants'
import { processImage, isGeminiConfigured } from '../../services/ai'
import { uploadFile, generateFileKey } from '../../services/storage'

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

  // Process each file: upload to R2 + AI processing
  const createdImages = []
  const aiResults = []

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

    // Trigger AI processing if configured
    if (isGeminiConfigured) {
      try {
        const pipelineResult = await processImage(rawImage.id, buffer, mimeType)
        aiResults.push({
          imageId: rawImage.id,
          success: pipelineResult.success,
          docType: pipelineResult.classification?.docType,
          isBlurry: pipelineResult.blurDetection?.isBlurry,
        })
      } catch (error) {
        console.error('AI processing failed for image:', rawImage.id, error)
        aiResults.push({ imageId: rawImage.id, success: false })
      }
    }
  }

  // Create action for staff to review if AI not configured or some images failed
  const needsManualReview = !isGeminiConfigured || aiResults.some((r) => !r.success)
  if (createdImages.length > 0 && needsManualReview) {
    await prisma.action.create({
      data: {
        caseId,
        type: 'VERIFY_DOCS',
        priority: 'HIGH',
        title: 'Tài liệu mới từ khách hàng',
        description: isGeminiConfigured
          ? `Khách hàng đã gửi ${createdImages.length} file - một số cần xác minh thủ công`
          : `Khách hàng đã gửi ${createdImages.length} file qua portal`,
        metadata: { rawImageIds: createdImages.map((img) => img.id) },
      },
    })
  }

  return c.json({
    uploaded: createdImages.length,
    images: createdImages,
    aiProcessed: isGeminiConfigured,
    aiResults: isGeminiConfigured ? aiResults : undefined,
    message: `Đã nhận ${createdImages.length} file. Cảm ơn bạn!`,
  })
})

export { portalRoute }
