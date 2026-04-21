/**
 * Shared org-scoping helper for shared-docs handlers.
 * Builds the `where` clause for "fetch this document id if it belongs to the
 * caller's org and isn't soft-deleted".
 */
import { buildNestedClientScope } from '../../lib/org-scope'
import type { AuthUser } from '../../services/auth'

export function scopedDocWhere(user: AuthUser, id: string) {
  return {
    id,
    deletedAt: null,
    taxCase: buildNestedClientScope(user),
  }
}
