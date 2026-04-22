/**
 * Magic link handlers: pause/resume/extend/generate-link.
 * Pause disables the link (reversible); section status stays ACTIVE so it remains visible in list.
 * Resume reactivates a paused link with a fresh 14d expiry — no re-upload required.
 * Extend accepts a duration ('7d' | '14d' | '30d' | 'never') applied to the existing link.
 * Generate creates a new MagicLink row when none exists for the section.
 * Deletion (soft delete) is a separate action — see crud-handlers.deleteSection.
 */
import type { Context } from 'hono'
import { z } from 'zod'
import { prisma } from '../../lib/db'
import type { AuthVariables } from '../../middleware/auth'
import type { AuthUser } from '../../services/auth'
import { sharedDocExpiryFromNow } from './validators'
import { scopedDocWhere } from './scope'
import { serializeMagicLink } from './response-builders'

type AuthContext = Context<{ Variables: AuthVariables }>

type ExtendDuration = '7d' | '14d' | '30d' | 'never'

const DAY_MS = 24 * 60 * 60 * 1000

const DURATION_DAYS: Record<ExtendDuration, number | null> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  never: null,
}

export const extendBodySchema = z.object({
  duration: z.enum(['7d', '14d', '30d', 'never']).default('14d'),
})

function computeExpiry(duration: ExtendDuration): Date | null {
  const days = DURATION_DAYS[duration]
  return days === null ? null : new Date(Date.now() + days * DAY_MS)
}

/**
 * Org-scoped lookup restricted to ACTIVE, non-deleted section rows.
 * Superseded or soft-deleted rows are filtered out so link operations can't target stale versions.
 */
async function findScopedDoc(user: AuthUser, id: string) {
  return prisma.shareableDocument.findFirst({
    where: { ...scopedDocWhere(user, id), status: 'ACTIVE' },
    select: { id: true, taxCaseId: true },
  })
}

/**
 * POST /shared-docs/:id/pause
 * Disable the section's active magic link. Section row stays ACTIVE + visible in list.
 * Idempotent — returns success even if no active link existed.
 */
export async function pauseSection(c: AuthContext) {
  const id = c.req.param('id')
  const user = c.get('user')

  const doc = await findScopedDoc(user, id)
  if (!doc) return c.json({ error: 'NOT_FOUND', message: 'Section not found' }, 404)

  await prisma.magicLink.updateMany({
    where: { draftReturnId: id, isActive: true },
    data: { isActive: false },
  })

  return c.json({ success: true })
}

/**
 * POST /shared-docs/:id/revoke  (DEPRECATED alias for /pause — backward compat)
 * Behaves identically to pauseSection; emits a one-time deprecation warning per process.
 */
let deprecationWarned = false
export async function revokeSection(c: AuthContext) {
  if (!deprecationWarned) {
    deprecationWarned = true
    console.warn('[shared-docs] DEPRECATED: /revoke endpoint — use /pause instead')
  }
  return pauseSection(c)
}

/**
 * POST /shared-docs/:id/resume
 * Reactivate a paused link. Sets isActive=true and resets expiresAt to now + 14 days.
 * Errors with LINK_NOT_FOUND when the section has never had a magic link.
 */
export async function resumeSection(c: AuthContext) {
  const id = c.req.param('id')
  const user = c.get('user')

  const doc = await findScopedDoc(user, id)
  if (!doc) return c.json({ error: 'NOT_FOUND', message: 'Section not found' }, 404)

  const newExpiry = sharedDocExpiryFromNow()

  const updated = await prisma.$transaction(async (tx) => {
    const link = await tx.magicLink.findFirst({
      where: { draftReturnId: id },
      orderBy: { createdAt: 'desc' },
    })
    if (!link) return null
    return tx.magicLink.update({
      where: { id: link.id },
      data: { isActive: true, expiresAt: newExpiry },
    })
  })

  if (!updated) {
    return c.json({ error: 'LINK_NOT_FOUND', message: 'No link exists for this section' }, 404)
  }

  return c.json({
    success: true,
    expiresAt: newExpiry.toISOString(),
    magicLink: serializeMagicLink(updated),
  })
}

/**
 * POST /shared-docs/:id/extend
 * Extend active magic link expiry by the chosen duration.
 * Body: { duration?: '7d' | '14d' | '30d' | 'never' } — default '14d' for backward compat.
 * 'never' sets expiresAt=null (link never expires); portal paths treat null as not-expired.
 */
export async function extendSection(c: AuthContext) {
  const id = c.req.param('id')
  const user = c.get('user')

  const doc = await findScopedDoc(user, id)
  if (!doc) return c.json({ error: 'NOT_FOUND', message: 'Section not found' }, 404)

  const rawBody = await c.req.json().catch(() => ({}))
  const parsed = extendBodySchema.safeParse(rawBody ?? {})
  if (!parsed.success) {
    return c.json({ error: 'INVALID_DURATION', message: 'Invalid duration value' }, 400)
  }
  const newExpiry = computeExpiry(parsed.data.duration)

  const updated = await prisma.$transaction(async (tx) => {
    const link = await tx.magicLink.findFirst({
      where: { draftReturnId: id, isActive: true },
    })
    if (!link) return null
    return tx.magicLink.update({
      where: { id: link.id },
      data: { expiresAt: newExpiry },
    })
  })

  if (!updated) return c.json({ error: 'NO_ACTIVE_LINK', message: 'No active link to extend' }, 400)

  return c.json({
    success: true,
    expiresAt: newExpiry ? newExpiry.toISOString() : null,
  })
}

/**
 * POST /shared-docs/:id/generate-link
 * Create a new MagicLink row for a section that has no existing link.
 * Errors with LINK_EXISTS when any link (active or paused) already exists — caller should
 * use /resume or /extend instead. Note: findFirst→create is non-atomic; UI should disable
 * the button after click to avoid concurrent submits (schema-level unique index is future work).
 */
export async function generateLink(c: AuthContext) {
  const id = c.req.param('id')
  const user = c.get('user')

  const doc = await findScopedDoc(user, id)
  if (!doc) return c.json({ error: 'NOT_FOUND', message: 'Section not found' }, 404)

  const existing = await prisma.magicLink.findFirst({
    where: { draftReturnId: id },
    select: { id: true },
  })
  if (existing) {
    return c.json({ error: 'LINK_EXISTS', message: 'A link already exists for this section' }, 400)
  }

  const expiresAt = sharedDocExpiryFromNow()

  const link = await prisma.magicLink.create({
    data: {
      caseId: doc.taxCaseId,
      type: 'DRAFT_RETURN',
      draftReturnId: id,
      expiresAt,
      isActive: true,
    },
  })

  return c.json({
    success: true,
    expiresAt: expiresAt.toISOString(),
    magicLink: serializeMagicLink(link),
  })
}
