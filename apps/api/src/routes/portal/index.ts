/**
 * Portal API routes (Public)
 * Magic link access and document upload for clients
 */
import { Hono } from 'hono'
import { ActivityRiskLevel } from '@ella/db'
import { createHash } from 'node:crypto'
import { prisma } from '../../lib/db'
import {
  recordMagicLinkUsage,
  validateMagicLink,
  type MagicLinkValidationResult,
} from '../../services/magic-link'
import { validateUploadedFileContent, validateUploadedFiles } from '../../lib/validation'
import { isGeminiConfigured } from '../../services/ai'
import { uploadFile, generateFileKey } from '../../services/storage'
import { inngest } from '../../lib/inngest'
import { updateLastActivity } from '../../services/activity-tracker'
import {
  checkRateLimit,
  getClientIp,
  getRateLimitRetryAfterSeconds,
  isRateLimitExceeded,
} from '../../middleware/rate-limiter'
import { getAuditRequestContext, logClientPortalActivity } from '../../services/activity-log'
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, ACTIVITY_TARGET_TYPES } from '../../services/activity-actions'
import { PORTAL_ERROR_MESSAGES, assertCaseInScope, buildCaseChecklistPayload } from './helpers'

const portalRoute = new Hono()

export const PORTAL_READ_RATE_LIMIT = {
  windowMs: 10 * 60 * 1000,
  maxRequests: 120,
}

export const PORTAL_UPLOAD_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
}

const PORTAL_INVALID_TOKEN_RATE_LIMIT = {
  windowMs: 10 * 60 * 1000,
  maxRequests: 30,
}

type ValidPortalLinkData = NonNullable<MagicLinkValidationResult['data']>

interface PortalUploadRecord {
  id: string
  status: string
  createdAt: Date
}

interface PortalUploadSummary {
  id: string
  safeLabel: string
  status: string
  createdAt: string
  sequenceNumber: number
}

function buildPortalUploadSummary(
  upload: PortalUploadRecord,
  sequenceNumber: number
): PortalUploadSummary {
  return {
    id: upload.id,
    safeLabel: `Document ${sequenceNumber}`,
    status: upload.status,
    createdAt: upload.createdAt.toISOString(),
    sequenceNumber,
  }
}

function mapPortalUploads(uploads: PortalUploadRecord[]): PortalUploadSummary[] {
  return uploads.map((upload, index) => buildPortalUploadSummary(upload, index + 1)).reverse()
}

function rateLimitedResponse(c: Parameters<typeof getClientIp>[0], retryAfterSeconds?: number) {
  if (retryAfterSeconds) c.header('Retry-After', String(retryAfterSeconds))

  return c.json(
    {
      error: 'RATE_LIMITED',
      message: 'Too many requests. Please wait a moment.',
    },
    429
  )
}

function checkPortalRateLimit(
  key: string,
  config: { windowMs: number; maxRequests: number }
): boolean {
  return checkRateLimit(key, config.windowMs, config.maxRequests)
}

function invalidTokenRateLimitKey(route: 'read' | 'upload', ip: string): string {
  return `portal-invalid-${route}:${ip}`
}

function validTokenRateLimitKey(route: 'read' | 'upload', token: string, ip: string): string {
  const tokenHash = createHash('sha256').update(token).digest('hex')
  return `portal-${route}:${tokenHash}:${ip}`
}

function alreadyRateLimited(
  key: string,
  config: { windowMs: number; maxRequests: number }
): boolean {
  return isRateLimitExceeded(key, config.windowMs, config.maxRequests)
}

async function logPortalRateLimitHit(
  c: Parameters<typeof getAuditRequestContext>[0],
  data: ValidPortalLinkData,
  route: 'read' | 'upload'
): Promise<void> {
  await logClientPortalActivity({
    organizationId: data.clientGroup?.organizationId ?? data.taxCase?.client.organizationId ?? null,
    clientId: data.taxCase?.client.id ?? null,
    caseId: data.taxCase?.id ?? null,
    magicLinkId: data.magicLinkId,
    category: ACTIVITY_CATEGORIES.SYSTEM,
    targetType: ACTIVITY_TARGET_TYPES.MAGIC_LINK,
    targetId: data.magicLinkId,
    targetLabel: route,
    action: ACTIVITY_ACTIONS.SYSTEM.RATE_LIMITED,
    riskLevel: ActivityRiskLevel.MEDIUM,
    summary: `Portal ${route} rate limit hit`,
    metadata: {
      scope: data.scope,
      route,
    },
    request: getAuditRequestContext(c),
  })
}

// GET /portal/:token - Get portal data via magic link
portalRoute.get('/:token', async (c) => {
  const token = c.req.param('token')
  const ip = getClientIp(c)
  const invalidKey = invalidTokenRateLimitKey('read', ip)
  const validKey = validTokenRateLimitKey('read', token, ip)

  if (alreadyRateLimited(invalidKey, PORTAL_INVALID_TOKEN_RATE_LIMIT)) {
    return rateLimitedResponse(c, getRateLimitRetryAfterSeconds(invalidKey))
  }

  const result = await validateMagicLink(token, { recordUsage: false })

  if (!result.valid || !result.data) {
    if (!checkPortalRateLimit(invalidKey, PORTAL_INVALID_TOKEN_RATE_LIMIT)) {
      return rateLimitedResponse(c, getRateLimitRetryAfterSeconds(invalidKey))
    }
    const errorCode = result.error || 'INVALID_TOKEN'
    return c.json(
      {
        error: errorCode,
        message: PORTAL_ERROR_MESSAGES[errorCode] || PORTAL_ERROR_MESSAGES.INVALID_TOKEN,
      },
      401
    )
  }

  if (!checkPortalRateLimit(validKey, PORTAL_READ_RATE_LIMIT)) {
    await logPortalRateLimitHit(c, result.data, 'read')
    return rateLimitedResponse(c, getRateLimitRetryAfterSeconds(validKey))
  }
  await recordMagicLinkUsage(result.data.magicLinkId)

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
        return c.json({ error: 'INVALID_TARGET_CASE', message: 'Invalid document target' }, 403)
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
        status: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })

    return c.json({
      uploads: mapPortalUploads(uploads),
    })
  }

  // Resolve client display info from anchor case (CASE) or first entity (GROUP)
  const displayName = taxCase?.client.name || clientGroup?.name || entities[0]?.name || 'Client'
  const displayLanguage = taxCase?.client.language || 'EN'
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
      clientGroup: clientGroup ? { id: clientGroup.id, name: clientGroup.name } : null,
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
  const ip = getClientIp(c)
  const invalidKey = invalidTokenRateLimitKey('upload', ip)
  const validKey = validTokenRateLimitKey('upload', token, ip)

  if (alreadyRateLimited(invalidKey, PORTAL_INVALID_TOKEN_RATE_LIMIT)) {
    return rateLimitedResponse(c, getRateLimitRetryAfterSeconds(invalidKey))
  }

  const result = await validateMagicLink(token, { recordUsage: false })

  if (!result.valid || !result.data) {
    if (!checkPortalRateLimit(invalidKey, PORTAL_INVALID_TOKEN_RATE_LIMIT)) {
      return rateLimitedResponse(c, getRateLimitRetryAfterSeconds(invalidKey))
    }
    return c.json({ error: 'INVALID_TOKEN', message: 'This link is invalid or expired' }, 401)
  }

  if (!checkPortalRateLimit(validKey, PORTAL_UPLOAD_RATE_LIMIT)) {
    await logPortalRateLimitHit(c, result.data, 'upload')
    return rateLimitedResponse(c, getRateLimitRetryAfterSeconds(validKey))
  }
  await recordMagicLinkUsage(result.data.magicLinkId)

  const { scope, clientGroupId, taxCase, clientGroup } = result.data

  // Parse multipart form data
  const formData = await c.req.formData()
  const files = formData.getAll('files') as File[]
  const targetCaseIdRaw = formData.get('targetCaseId')
  const targetCaseId =
    typeof targetCaseIdRaw === 'string' && targetCaseIdRaw.trim() ? targetCaseIdRaw.trim() : null

  // GROUP-scoped tokens require an explicit targetCaseId
  if (scope === 'GROUP' && !targetCaseId) {
    return c.json(
      {
        error: 'TARGET_CASE_REQUIRED',
        message: 'Please choose a document target before uploading',
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
    return c.json({ error: 'TARGET_CASE_REQUIRED', message: 'Could not determine the tax case' }, 400)
  }

  // Validate uploaded files (type, size, count)
  const validation = validateUploadedFiles(files)
  if (!validation.valid) {
    const errorMessages: Record<string, string> = {
      NO_FILES: 'Please choose at least one file',
      TOO_MANY_FILES: 'Too many files. Upload at most 50 files at a time',
      EMPTY_FILE:
        'This file has no content. Please open it on your device, download it if it is in iCloud/Drive, then upload it again',
      FILE_TOO_LARGE: 'File is too large. Maximum size is 10MB per file',
      INVALID_TYPE: 'Unsupported file type. Only images (JPEG, PNG, WebP, HEIC) and PDF are accepted',
      INVALID_FILE_CONTENT:
        'File content does not match a supported format. Please upload a valid PDF or image',
    }
    return c.json(
      {
        error: validation.errorCode || 'VALIDATION_ERROR',
        message: errorMessages[validation.errorCode || 'NO_FILES'] || validation.error,
      },
      400
    )
  }

  const fileSignatures = await Promise.all(
    files.map(async (file) => ({
      file,
      buffer: Buffer.from(await file.slice(0, 64).arrayBuffer()),
    }))
  )

  const contentValidation = validateUploadedFileContent(fileSignatures)
  if (!contentValidation.valid) {
    return c.json(
      {
        error: 'INVALID_FILE_CONTENT',
        message: 'File content does not match a supported format. Please upload a valid PDF or image',
      },
      400
    )
  }

  // Owner explicitly picked entity → skip AI entity routing downstream
  const uploadSource = targetCaseId ? 'PORTAL_EXPLICIT' : 'PORTAL_AI'

  // Process each file: upload to R2 + trigger background classification
  const createdImages: PortalUploadSummary[] = []
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
    const buffer = Buffer.from(await file.arrayBuffer())
    const mimeType = file.type || 'image/jpeg'

    const r2Key = generateFileKey(effectiveCaseId, file.name, 'raw')
    await uploadFile(r2Key, buffer, mimeType)

    const { rawImage, sequenceNumber } = await prisma.$transaction(async (tx) => {
      const lockKey = `portal-upload-sequence:${effectiveCaseId}`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
      const sequenceNumber = (await tx.rawImage.count({ where: { caseId: effectiveCaseId } })) + 1
      const rawImage = await tx.rawImage.create({
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
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
      })
      return { rawImage, sequenceNumber }
    })

    createdImages.push({
      ...buildPortalUploadSummary(rawImage, sequenceNumber),
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
            title: 'Documents need classification',
            description: `${createdImages.length} files uploaded - manual classification needed`,
            metadata: { rawImageIds: createdImages.map((img) => img.id) },
          },
        })
        .catch(console.error)
    })
  }

  if (createdImages.length > 0) {
    await updateLastActivity(effectiveCaseId)
    const entity = result.data.entities.find((item) => item.caseId === effectiveCaseId)
    const clientId = entity?.clientId ?? taxCase?.client.id ?? null
    const clientName = entity?.name ?? taxCase?.client.name ?? clientGroup?.name ?? 'Client'
    const organizationId =
      clientGroup?.organizationId ?? taxCase?.client.organizationId ?? null

    await logClientPortalActivity({
      organizationId,
      clientId,
      caseId: effectiveCaseId,
      rawImageId: createdImages.length === 1 ? createdImages[0]?.id : null,
      magicLinkId: result.data.magicLinkId,
      category: ACTIVITY_CATEGORIES.DOCUMENT,
      targetType: ACTIVITY_TARGET_TYPES.CASE,
      targetId: effectiveCaseId,
      targetLabel: clientName,
      summary: `Uploaded ${createdImages.length} ${createdImages.length === 1 ? 'document' : 'documents'}`,
      action: ACTIVITY_ACTIONS.DOCUMENT.UPLOADED,
      riskLevel: ActivityRiskLevel.LOW,
      metadata: {
        uploadCount: createdImages.length,
        rawImageIds: createdImages.map((img) => img.id),
        uploadSource,
        scope,
      },
      request: getAuditRequestContext(c),
    })
  }

  if (createdImages.length > 0 && !isGeminiConfigured) {
    await prisma.action.create({
      data: {
        caseId: effectiveCaseId,
        type: 'VERIFY_DOCS',
        priority: 'HIGH',
        title: 'New documents from client',
        description: `Client uploaded ${createdImages.length} files through the portal - manual classification needed`,
        metadata: { rawImageIds: createdImages.map((img) => img.id) },
      },
    })
  }

  return c.json({
    uploaded: createdImages.length,
    images: createdImages,
    aiProcessing: isGeminiConfigured,
    message: isGeminiConfigured
      ? `Received ${createdImages.length} files. Automatic processing has started.`
      : `Received ${createdImages.length} files. Thank you!`,
  })
})

export { portalRoute }
