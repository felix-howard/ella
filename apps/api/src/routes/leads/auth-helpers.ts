/**
 * Shared auth helpers for `/leads/*` routes.
 */
import { HTTPException } from 'hono/http-exception'
import type { AuthUser } from '../../middleware/auth'

/**
 * Extract verified orgId and staffId from auth user.
 * Belt-and-braces: `requireOrgAdmin` middleware guarantees these, but we still
 * guard to keep downstream code non-nullable.
 */
export function getVerifiedAuth(user: AuthUser): { orgId: string; staffId: string } {
  if (!user.organizationId) {
    throw new HTTPException(403, { message: 'Organization required' })
  }
  if (!user.staffId) {
    throw new HTTPException(403, { message: 'Staff record required' })
  }
  return { orgId: user.organizationId, staffId: user.staffId }
}
