/**
 * Organization scope utilities for multi-tenancy client filtering
 * Builds Prisma where clauses that scope queries by org + assignment
 * - Admin: sees all clients in their org
 * - Member/Staff: sees only assigned clients
 */
import type { AuthUser } from '../services/auth'
import { prisma } from './db'

/**
 * Build Prisma where clause that scopes Client queries by org + assignment.
 * Admin: sees all clients in org.
 * Member: sees only assigned clients.
 * No org + no staffId: returns impossible filter to prevent data leak.
 */
export function buildClientScopeFilter(user: AuthUser): Record<string, unknown> {
  const where: Record<string, unknown> = {}

  if (user.organizationId) {
    where.organizationId = user.organizationId
  }

  // Assignment scope for non-admin
  if (user.orgRole !== 'org:admin' && user.staffId) {
    where.assignments = { some: { staffId: user.staffId } }
  }

  // Failsafe: if no org AND no assignment filter, return impossible match
  // to prevent leaking all clients during migration period
  if (!user.organizationId && !where.assignments) {
    where.id = '__NO_ACCESS__'
  }

  return where
}

/**
 * Build Prisma where clause for resources nested under Client
 * (e.g., TaxCase, TaxEngagement) accessed via client relation.
 * Returns filter on the `client` relation.
 */
export function buildNestedClientScope(user: AuthUser): Record<string, unknown> {
  const clientWhere = buildClientScopeFilter(user)
  if (Object.keys(clientWhere).length === 0) return {}
  return { client: clientWhere }
}

/**
 * Verify a specific client belongs to user's org and (if staff) is assigned.
 * Returns true if access allowed.
 */
export async function verifyClientAccess(
  clientId: string,
  user: AuthUser
): Promise<boolean> {
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      ...buildClientScopeFilter(user),
    },
    select: { id: true },
  })
  return !!client
}
