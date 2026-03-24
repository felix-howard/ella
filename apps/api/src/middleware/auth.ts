/**
 * Auth Middleware - Clerk authentication and role-based access control
 * Uses @hono/clerk-auth official middleware
 * Read-only: webhook handles DB sync (see services/clerk-webhook)
 */
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { clerkMiddleware, getAuth } from '@hono/clerk-auth'
import { type AuthUser } from '../services/auth'
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
 * Auth middleware that requires authentication
 * Looks up Staff by clerkId (no sync - webhook handles DB writes)
 */
export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const auth = getAuth(c)

  if (!auth?.userId) {
    throw new HTTPException(401, { message: 'Yêu cầu xác thực' })
  }

  // Look up staff by Clerk ID (no sync - webhook handles it)
  const staff = await prisma.staff.findUnique({
    where: { clerkId: auth.userId },
    include: { organization: true },
  })

  // Staff record should exist (created by webhook on membership.created)
  // If not found, webhook may be pending
  if (!staff) {
    console.warn(`[Auth] Staff not found for clerkId: ${auth.userId}`)
    throw new HTTPException(401, { message: 'Tài khoản chưa sẵn sàng. Vui lòng thử lại.' })
  }

  if (!staff.isActive) {
    throw new HTTPException(403, { message: 'Tài khoản đã bị vô hiệu hóa' })
  }

  // Extract org context from JWT (for validation)
  const clerkOrgId = auth.orgId || null
  const orgRole = auth.orgRole || null

  c.set('user', {
    id: auth.userId,
    staffId: staff.id,
    email: staff.email,
    name: staff.name,
    role: staff.role,
    imageUrl: staff.avatarUrl || undefined,
    organizationId: staff.organizationId,
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
    const staff = await prisma.staff.findUnique({
      where: { clerkId: auth.userId },
    })

    if (staff?.isActive) {
      c.set('user', {
        id: auth.userId,
        staffId: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        imageUrl: staff.avatarUrl || undefined,
        organizationId: staff.organizationId,
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
