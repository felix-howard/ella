/**
 * Rate Limiter Middleware
 * In-memory rate limiting for API endpoints
 */
import { createMiddleware } from 'hono/factory'
import type { Context } from 'hono'
import { isIP } from 'node:net'
import { config } from '../lib/config'

// Rate limit storage: Map<key, { count: number; resetTime: number }>
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export interface RateLimitConfig {
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs?: number
  /** Maximum requests per window (default: 60) */
  maxRequests?: number
  /** Key prefix for different rate limit pools */
  keyPrefix?: string
}

export function getClientIp(c: Context): string {
  if (config.security.trustProxyHeaders) {
    const cfIp = c.req.header('cf-connecting-ip')?.trim()
    if (cfIp && isIP(cfIp)) return cfIp

    const realIp = c.req.header('x-real-ip')?.trim()
    if (realIp && isIP(realIp)) return realIp

    const forwardedIp = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    if (forwardedIp && isIP(forwardedIp)) return forwardedIp
  }

  return 'unknown'
}

/**
 * Check and update rate limit for a given key
 * @returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(
  key: string,
  windowMs: number = 60000,
  maxRequests: number = 60
): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count++
  return true
}

export function isRateLimitExceeded(
  key: string,
  _windowMs: number = 60000,
  maxRequests: number = 60
): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(key)
  if (!record || now > record.resetTime) return false
  return record.count >= maxRequests
}

export function getRateLimitRetryAfterSeconds(key: string): number | undefined {
  const record = rateLimitMap.get(key)
  if (!record) return undefined
  return Math.max(1, Math.ceil((record.resetTime - Date.now()) / 1000))
}

/**
 * Create rate limiter middleware with custom config
 */
export function rateLimiter(config: RateLimitConfig = {}) {
  const { windowMs = 60000, maxRequests = 60, keyPrefix = 'api' } = config

  return createMiddleware(async (c, next) => {
    // Get client identifier (prefer staff ID for authenticated routes, fallback to IP)
    const user = c.get('user') as { staffId?: string } | undefined
    const clientIp = getClientIp(c)
    const key = `${keyPrefix}:${user?.staffId || clientIp}`

    if (!checkRateLimit(key, windowMs, maxRequests)) {
      console.warn(`[RateLimit] Exceeded for ${key}`)
      return c.json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' }, 429)
    }

    await next()
  })
}

// Cleanup old rate limit entries every minute
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitMap) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}, 60000)

/**
 * Testing hook — clears the in-memory bucket so per-test state does not leak
 * across tests that share a token key. Only for use inside `__tests__/` files.
 */
export function __resetRateLimitMapForTests(): void {
  rateLimitMap.clear()
}

/**
 * Pre-configured rate limiters for common use cases
 */

/** Standard API rate limit: 60 requests/minute */
export const standardRateLimit = rateLimiter({ keyPrefix: 'std', maxRequests: 60 })

/** Strict rate limit for sensitive operations: 10 requests/minute */
export const strictRateLimit = rateLimiter({ keyPrefix: 'strict', maxRequests: 10 })

/** Presence endpoint rate limit: 30 requests/minute (account for heartbeats) */
export const presenceRateLimit = rateLimiter({ keyPrefix: 'presence', maxRequests: 30 })
