/**
 * Auth Middleware - Clerk authentication and role-based access control
 * Phase 3: Authentication System with Clerk
 * Uses @hono/clerk-auth official middleware
 */
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { clerkMiddleware, getAuth } from '@hono/clerk-auth'
import { syncStaffFromClerk, getStaffByClerkId, syncOrganization, type AuthUser } from '../services/auth'
import { prisma } from '../lib/db'

export type { AuthUser }

export interface AuthVariables {
  user: AuthUser
}

/**
 * Base Clerk middleware - verifies JWT and injects auth context
 */
export { clerkMiddleware }

/**
 * Auth middleware that requires authentication and syncs with Staff table
 * Extracts user from Clerk session and gets role from Staff table
 */
export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const auth = getAuth(c)

  if (!auth?.userId) {
    throw new HTTPException(401, { message: 'Yêu cầu xác thực' })
  }

  // Extract org context from Clerk JWT
  const clerkOrgId = auth.orgId || null
  const orgRole = auth.orgRole || null

  // Sync organization if present
  let organizationId: string | null = null
  if (clerkOrgId) {
    try {
      const org = await syncOrganization(clerkOrgId)
      organizationId = org.id
    } catch (error) {
      console.error('[Auth] Organization sync failed:', error)
      // Continue without org context rather than blocking auth entirely
    }
  }

  // Get staff record to check role
  let staff = await getStaffByClerkId(auth.userId)

  // If no staff record exists, sync from Clerk session claims
  if (!staff) {
    const sessionClaims = auth.sessionClaims as {
      email?: string
      name?: string
      picture?: string
    } | undefined

    if (sessionClaims?.email) {
      await syncStaffFromClerk(
        auth.userId,
        sessionClaims.email,
        sessionClaims.name || 'Unknown',
        sessionClaims.picture,
        organizationId || undefined
      )
      staff = await getStaffByClerkId(auth.userId)
    }
  } else if (organizationId && staff.organizationId !== organizationId) {
    // Update staff org if changed, refetch to avoid stale data
    staff = await prisma.staff.update({ where: { id: staff.id }, data: { organizationId } })
  }

  // Check if staff is active
  if (staff && !staff.isActive) {
    throw new HTTPException(403, { message: 'Tài khoản đã bị vô hiệu hóa' })
  }

  // Set user in context
  c.set('user', {
    id: auth.userId,
    staffId: staff?.id || null,
    email: staff?.email || '',
    name: staff?.name || 'Unknown',
    role: staff?.role || 'STAFF',
    imageUrl: staff?.avatarUrl || undefined,
    organizationId,
    clerkOrgId,
    orgRole,
  })

  await next()
})

/**
 * Optional auth middleware
 * Sets user if valid token present, continues without if not
 */
export const optionalAuthMiddleware = createMiddleware<{ Variables: Partial<AuthVariables> }>(async (c, next) => {
  const auth = getAuth(c)

  if (auth?.userId) {
    const staff = await getStaffByClerkId(auth.userId)

    if (staff && staff.isActive) {
      c.set('user', {
        id: auth.userId,
        staffId: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        imageUrl: staff.avatarUrl || undefined,
        organizationId: staff.organizationId || null,
        clerkOrgId: auth.orgId || null,
        orgRole: auth.orgRole || null,
      })
    }
  }

  await next()
})

/**
 * Role-based access middleware factory
 * Usage: app.use('/admin/*', requireRole('ADMIN'))
 */
export function requireRole(...allowedRoles: string[]) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const user = c.get('user')

    if (!user) {
      throw new HTTPException(401, { message: 'Chưa xác thực' })
    }

    if (!allowedRoles.includes(user.role)) {
      throw new HTTPException(403, { message: 'Không đủ quyền truy cập' })
    }

    await next()
  })
}

/**
 * Admin-only middleware (convenience)
 */
export const adminOnly = requireRole('ADMIN')

/**
 * Staff or admin middleware (convenience)
 */
export const staffOrAdmin = requireRole('ADMIN', 'STAFF')

/**
 * CPA or admin middleware (convenience)
 */
export const cpaOrAdmin = requireRole('ADMIN', 'CPA')

/**
 * Requires user to have an active organization selected
 * Use after authMiddleware: app.use('/org/*', authMiddleware, requireOrg)
 */
export const requireOrg = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const user = c.get('user')
  if (!user) throw new HTTPException(401, { message: 'Chưa xác thực' })
  if (!user.organizationId) {
    throw new HTTPException(403, { message: 'Vui lòng chọn tổ chức' })
  }
  await next()
})

/**
 * Requires org:admin role from Clerk JWT or app-level ADMIN role
 * Cross-validates both sources to prevent privilege escalation
 * Use after authMiddleware: app.use('/admin/*', authMiddleware, requireOrgAdmin)
 */
export const requireOrgAdmin = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const user = c.get('user')
  if (!user) throw new HTTPException(401, { message: 'Chưa xác thực' })
  if (user.orgRole !== 'org:admin' && user.role !== 'ADMIN') {
    throw new HTTPException(403, { message: 'Chỉ admin mới có quyền' })
  }
  await next()
})
