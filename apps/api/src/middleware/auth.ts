/**
 * Auth Middleware - Clerk authentication and role-based access control
 * Phase 3: Authentication System with Clerk
 * Uses @hono/clerk-auth official middleware
 */
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { clerkMiddleware, getAuth } from '@hono/clerk-auth'
import { syncStaffFromClerk, getStaffByClerkId, type AuthUser } from '../services/auth'

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

  // Get staff record to check role
  let staff = await getStaffByClerkId(auth.userId)

  // If no staff record exists, sync from Clerk session claims
  if (!staff) {
    // Try to get user info from session claims
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
        sessionClaims.picture
      )
      staff = await getStaffByClerkId(auth.userId)
    }
  }

  // Check if staff is active
  if (staff && !staff.isActive) {
    throw new HTTPException(403, { message: 'Tài khoản đã bị vô hiệu hóa' })
  }

  // Set user in context
  c.set('user', {
    id: auth.userId,
    staffId: staff?.id || null, // Staff table ID for foreign keys
    email: staff?.email || '',
    name: staff?.name || 'Unknown',
    role: staff?.role || 'STAFF',
    imageUrl: staff?.avatarUrl || undefined,
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
        staffId: staff.id, // Staff table ID for foreign keys
        email: staff.email,
        name: staff.name,
        role: staff.role,
        imageUrl: staff.avatarUrl || undefined,
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
