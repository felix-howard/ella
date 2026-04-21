/**
 * Magic link handlers: revoke + extend expiry.
 * Revoke disables the link only (section status stays ACTIVE so it remains visible in list).
 * Deletion (soft delete) is a separate action — see crud-handlers.deleteSection.
 */
import type { Context } from 'hono'
import { prisma } from '../../lib/db'
import type { AuthVariables } from '../../middleware/auth'
import type { AuthUser } from '../../services/auth'
import { sharedDocExpiryFromNow } from './validators'
import { scopedDocWhere } from './scope'

type AuthContext = Context<{ Variables: AuthVariables }>

async function findScopedDoc(user: AuthUser, id: string) {
  return prisma.shareableDocument.findFirst({
    where: scopedDocWhere(user, id),
    select: { id: true },
  })
}

/**
 * POST /shared-docs/:id/revoke
 * Disable the section's active magic link. Section row stays ACTIVE + visible in list.
 * Idempotent — returns success even if no active link existed.
 */
export async function revokeSection(c: AuthContext) {
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
 * POST /shared-docs/:id/extend
 * Extend active magic link expiry by 14 days.
 */
export async function extendSection(c: AuthContext) {
  const id = c.req.param('id')
  const user = c.get('user')

  const doc = await findScopedDoc(user, id)
  if (!doc) return c.json({ error: 'NOT_FOUND', message: 'Section not found' }, 404)

  const newExpiry = sharedDocExpiryFromNow()

  const updated = await prisma.$transaction(async (tx) => {
    const magicLink = await tx.magicLink.findFirst({
      where: { draftReturnId: id, isActive: true },
    })
    if (!magicLink) return null
    return tx.magicLink.update({
      where: { id: magicLink.id },
      data: { expiresAt: newExpiry },
    })
  })

  if (!updated) return c.json({ error: 'NO_ACTIVE_LINK', message: 'No active link to extend' }, 400)

  return c.json({ success: true, expiresAt: newExpiry.toISOString() })
}
