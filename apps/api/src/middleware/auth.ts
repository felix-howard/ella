/**
 * Auth Middleware - JWT verification and role-based access control
 * Phase 3: Authentication System
 */
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { verifyAccessToken } from '../services/auth'

export interface AuthUser {
  id: string
  email: string
  role: string
  name: string
}

export interface AuthVariables {
  user: AuthUser
}

/**
 * JWT verification middleware
 * Extracts user from Authorization: Bearer <token> header
 */
export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Yêu cầu xác thực' })
  }

  const token = authHeader.slice(7)

  const payload = await verifyAccessToken(token)
  if (!payload) {
    throw new HTTPException(401, { message: 'Token không hợp lệ hoặc đã hết hạn' })
  }

  // Set user in context (name is now included in JWT - H3)
  c.set('user', {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    name: payload.name,
  })

  await next()
})

/**
 * Optional auth middleware
 * Sets user if valid token present, continues without if not
 */
export const optionalAuthMiddleware = createMiddleware<{ Variables: Partial<AuthVariables> }>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const payload = await verifyAccessToken(token)

    if (payload) {
      c.set('user', {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        name: payload.name,
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
