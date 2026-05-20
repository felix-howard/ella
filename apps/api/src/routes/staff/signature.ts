/**
 * Staff Signature Routes
 * Manage per-staff PNG signature stored in R2
 * POST   /staff/me/signature  - upload new signature
 * GET    /staff/me/signature  - get current signature URL
 * DELETE /staff/me/signature  - clear signature
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { customAlphabet } from 'nanoid'
import { ActivityRiskLevel } from '@ella/db'
import { prisma } from '../../lib/db'
import { uploadFile, getSignedDownloadUrl, deleteFile } from '../../services/storage'
import type { AuthVariables } from '../../middleware/auth'
import { getAuditRequestContext, logStaffActivity } from '../../services/activity-log'
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, ACTIVITY_TARGET_TYPES } from '../../services/activity-actions'

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 12)

// Max decoded PNG size: 200KB
const MAX_PNG_BYTES = 200 * 1024

// PNG magic bytes: \x89PNG
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])

const uploadSignatureSchema = z.object({
  signatureBase64: z
    .string()
    .startsWith('data:image/png;base64,', 'Must be a PNG data URL'),
})

export const signatureRoute = new Hono<{ Variables: AuthVariables }>()

// GET /staff/me/signature - return current signature (signed URL, 15 min TTL)
signatureRoute.get('/', async (c) => {
  const user = c.get('user')
  if (!user?.staffId) {
    return c.json({ error: 'Staff record not found' }, 404)
  }

  const staff = await prisma.staff.findUnique({
    where: { id: user.staffId },
    select: { signaturePngKey: true, signatureUpdatedAt: true },
  })

  if (!staff) {
    return c.json({ error: 'Staff record not found' }, 404)
  }

  if (!staff.signaturePngKey) {
    return c.json({ signaturePngKey: null, signedUrl: null })
  }

  const signedUrl = await getSignedDownloadUrl(staff.signaturePngKey, 900) // 15 min
  return c.json({
    signaturePngKey: staff.signaturePngKey,
    signatureUpdatedAt: staff.signatureUpdatedAt,
    signedUrl,
  })
})

// POST /staff/me/signature - upload new signature PNG
signatureRoute.post(
  '/',
  zValidator('json', uploadSignatureSchema),
  async (c) => {
    const user = c.get('user')
    if (!user?.staffId) {
      return c.json({ error: 'Staff record not found' }, 404)
    }

    const { signatureBase64 } = c.req.valid('json')

    // Decode base64 payload
    const base64Data = signatureBase64.slice('data:image/png;base64,'.length)
    let pngBuffer: Buffer
    try {
      pngBuffer = Buffer.from(base64Data, 'base64')
    } catch {
      return c.json({ error: 'Invalid base64 data' }, 400)
    }

    // Size guard
    if (pngBuffer.length > MAX_PNG_BYTES) {
      return c.json({ error: `Signature PNG must be ≤ 200KB (got ${Math.round(pngBuffer.length / 1024)}KB)` }, 400)
    }

    // PNG magic byte check
    if (pngBuffer.length < 4 || !pngBuffer.subarray(0, 4).equals(PNG_MAGIC)) {
      return c.json({ error: 'File must be a valid PNG image' }, 400)
    }

    // Load current signature key for cleanup
    const existing = await prisma.staff.findUnique({
      where: { id: user.staffId },
      select: { signaturePngKey: true },
    })

    const r2Key = `staff-signatures/${user.staffId}/${nanoid()}.png`

    // Upload to R2
    const { url: signedUrl } = await uploadFile(r2Key, pngBuffer, 'image/png')

    // Update Staff record
    await prisma.staff.update({
      where: { id: user.staffId },
      data: {
        signaturePngKey: r2Key,
        signatureUpdatedAt: new Date(),
      },
    })

    // Best-effort delete old R2 object after DB is committed
    if (existing?.signaturePngKey && existing.signaturePngKey !== r2Key) {
      deleteFile(existing.signaturePngKey).catch((err) =>
        console.warn('[Signature] Failed to delete old signature PNG:', err)
      )
    }

    await logStaffActivity({
      organizationId: user.organizationId,
      actorStaffId: user.staffId,
      category: ACTIVITY_CATEGORIES.PROFILE,
      targetType: ACTIVITY_TARGET_TYPES.STAFF,
      targetId: user.staffId,
      summary: 'Updated staff signature',
      action: ACTIVITY_ACTIONS.PROFILE.SIGNATURE_UPDATED,
      riskLevel: ActivityRiskLevel.MEDIUM,
      metadata: {
        changedFields: ['signaturePngKey', 'signatureUpdatedAt'],
        replacedExistingSignature: Boolean(existing?.signaturePngKey),
      },
      request: getAuditRequestContext(c),
    })

    return c.json({ signaturePngKey: r2Key, signedUrl })
  }
)

// DELETE /staff/me/signature - clear signature
signatureRoute.delete('/', async (c) => {
  const user = c.get('user')
  if (!user?.staffId) {
    return c.json({ error: 'Staff record not found' }, 404)
  }

  const staff = await prisma.staff.findUnique({
    where: { id: user.staffId },
    select: { signaturePngKey: true },
  })

  if (!staff) {
    return c.json({ error: 'Staff record not found' }, 404)
  }

  if (staff.signaturePngKey) {
    // Best-effort R2 delete
    deleteFile(staff.signaturePngKey).catch((err) =>
      console.warn('[Signature] Failed to delete signature PNG from R2:', err)
    )
  }

  await prisma.staff.update({
    where: { id: user.staffId },
    data: { signaturePngKey: null, signatureUpdatedAt: null },
  })

  await logStaffActivity({
    organizationId: user.organizationId,
    actorStaffId: user.staffId,
    category: ACTIVITY_CATEGORIES.PROFILE,
    targetType: ACTIVITY_TARGET_TYPES.STAFF,
    targetId: user.staffId,
    summary: 'Deleted staff signature',
    action: ACTIVITY_ACTIONS.PROFILE.SIGNATURE_DELETED,
    riskLevel: ActivityRiskLevel.MEDIUM,
    metadata: {
      changedFields: ['signaturePngKey', 'signatureUpdatedAt'],
      hadSignature: Boolean(staff.signaturePngKey),
    },
    request: getAuditRequestContext(c),
  })

  return c.json({ success: true })
})
