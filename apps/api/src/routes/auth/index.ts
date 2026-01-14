/**
 * Auth Routes - Login, logout, refresh, register
 * Phase 3: Authentication System
 *
 * Security features:
 * - Rate limiting on all auth endpoints
 * - Secure HTTP-only cookies
 * - Password complexity validation
 * - Token rotation on refresh
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { rateLimiter } from 'hono-rate-limiter'
import { z } from 'zod'
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'
import {
  hashPassword,
  hashToken,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
} from '../../services/auth'
import type { AuthVariables } from '../../middleware/auth'

const authRoute = new Hono<{ Variables: Partial<AuthVariables> }>()

// Rate limiting: 5 attempts per 15 minutes for auth endpoints
const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  message: { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút' },
  keyGenerator: (c) => c.req.header('x-forwarded-for') || 'unknown',
})

// Less restrictive rate limit for refresh (more frequent)
const refreshRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: 'Quá nhiều yêu cầu refresh, vui lòng thử lại sau' },
  keyGenerator: (c) => c.req.header('x-forwarded-for') || 'unknown',
})

// Validation schemas with password complexity
const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string()
    .min(8, 'Mật khẩu tối thiểu 8 ký tự')
    .regex(/[A-Z]/, 'Cần ít nhất 1 chữ hoa')
    .regex(/[a-z]/, 'Cần ít nhất 1 chữ thường')
    .regex(/[0-9]/, 'Cần ít nhất 1 số'),
  name: z.string().min(1, 'Tên không được để trống'),
  role: z.enum(['ADMIN', 'STAFF', 'CPA']).default('STAFF'),
})

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Mật khẩu không được để trống'),
})

// Helper to check if request is HTTPS (check protocol or X-Forwarded-Proto)
function isSecureRequest(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const proto = c.req.header('x-forwarded-proto')
  if (proto) return proto === 'https'
  return config.nodeEnv === 'production' // Assume HTTPS in production
}

// POST /auth/register - Create new user (for admin use)
authRoute.post('/register', authRateLimiter, zValidator('json', registerSchema), async (c) => {
  const { email, password, name, role } = c.req.valid('json')

  // Check if user exists
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return c.json({ error: 'Email đã được sử dụng' }, 400)
  }

  // Create user with hashed password
  const user = await prisma.user.create({
    data: {
      email,
      password: await hashPassword(password),
      name,
      role,
    },
    select: { id: true, email: true, name: true, role: true },
  })

  console.log(`[Auth] User registered: ${email}`)
  return c.json(user, 201)
})

// POST /auth/login - Authenticate user
authRoute.post('/login', authRateLimiter, zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json')

  // Find user
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.isActive) {
    console.log(`[Auth] Failed login attempt for: ${email}`)
    return c.json({ error: 'Email hoặc mật khẩu không đúng' }, 401)
  }

  // Verify password
  const valid = await verifyPassword(password, user.password)
  if (!valid) {
    console.log(`[Auth] Failed login attempt (wrong password) for: ${email}`)
    return c.json({ error: 'Email hoặc mật khẩu không đúng' }, 401)
  }

  // Generate tokens
  const accessToken = await generateAccessToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
  const refreshToken = await generateRefreshToken(user.id)

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  // Set refresh token in HTTP-only cookie with strict security
  setCookie(c, 'refreshToken', refreshToken, {
    httpOnly: true,
    secure: isSecureRequest(c), // Enforce HTTPS
    sameSite: 'Strict', // Stricter CSRF protection
    maxAge: 60 * 60 * 24 * config.auth.refreshTokenExpiresDays,
    path: '/',
  })

  console.log(`[Auth] User logged in: ${email}`)
  return c.json({
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  })
})

// POST /auth/refresh - Refresh access token
authRoute.post('/refresh', refreshRateLimiter, async (c) => {
  const refreshToken = getCookie(c, 'refreshToken')

  if (!refreshToken) {
    return c.json({ error: 'Refresh token không tồn tại' }, 401)
  }

  // Verify and get user
  const result = await verifyRefreshToken(refreshToken)
  if (!result) {
    deleteCookie(c, 'refreshToken')
    return c.json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn' }, 401)
  }

  // Get user for new access token
  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: { id: true, email: true, name: true, role: true },
  })

  if (!user) {
    deleteCookie(c, 'refreshToken')
    return c.json({ error: 'Người dùng không tồn tại' }, 401)
  }

  // Rotate refresh token
  const newRefreshToken = await rotateRefreshToken(refreshToken, user.id)
  const accessToken = await generateAccessToken(user)

  // Set new refresh token cookie with strict security
  setCookie(c, 'refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: isSecureRequest(c),
    sameSite: 'Strict',
    maxAge: 60 * 60 * 24 * config.auth.refreshTokenExpiresDays,
    path: '/',
  })

  return c.json({ accessToken })
})

// POST /auth/logout - Revoke current refresh token (not all)
authRoute.post('/logout', async (c) => {
  const refreshToken = getCookie(c, 'refreshToken')

  if (refreshToken) {
    // Only revoke the current token, not all tokens
    const hashedToken = hashToken(refreshToken)
    await prisma.refreshToken.updateMany({
      where: { token: hashedToken },
      data: { revokedAt: new Date() },
    })
    console.log('[Auth] User logged out (single device)')
  }

  deleteCookie(c, 'refreshToken')
  return c.json({ success: true })
})

// GET /auth/me - Get current user info
authRoute.get('/me', async (c) => {
  // This route uses optional auth middleware set in app.ts
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Chưa đăng nhập' }, 401)
  }

  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
})

export { authRoute }
