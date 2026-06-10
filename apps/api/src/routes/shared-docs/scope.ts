/**
 * Shared org-scoping helper for shared-docs handlers.
 * Builds the `where` clause for "fetch this document id if it belongs to the
 * caller's org and isn't soft-deleted".
 */
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { buildNestedClientScope } from '../../lib/org-scope'
import type { AuthUser } from '../../services/auth'

/**
 * Read a required route param. Hono types params as `string | undefined` for
 * untyped contexts; these routes always mount with the param, so absence means a
 * routing bug — fail fast with 400 instead of letting an undefined id silently
 * match the first scoped row in a Prisma `where` clause.
 */
export function requireParam(c: Context, name: string): string {
  const value = c.req.param(name)
  if (!value) {
    throw new HTTPException(400, { message: `Missing required parameter: ${name}` })
  }
  return value
}

export function scopedDocWhere(user: AuthUser, id: string) {
  return {
    id,
    deletedAt: null,
    taxCase: buildNestedClientScope(user),
  }
}
