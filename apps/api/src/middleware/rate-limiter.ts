/**
 * Rate Limiter Middleware
 * In-memory rate limiting for API endpoints
 */
import { createMiddleware } from 'hono/factory'

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

/**
 * Create rate limiter middleware with custom config
 */
export function rateLimiter(config: RateLimitConfig = {}) {
  const { windowMs = 60000, maxRequests = 60, keyPrefix = 'api' } = config

  return createMiddleware(async (c, next) => {
    // Get client identifier (prefer staff ID for authenticated routes, fallback to IP)
    const user = c.get('user') as { staffId?: string } | undefined
    const clientIp = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
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
 * Pre-configured rate limiters for common use cases
 */

/** Standard API rate limit: 60 requests/minute */
export const standardRateLimit = rateLimiter({ keyPrefix: 'std', maxRequests: 60 })

/** Strict rate limit for sensitive operations: 10 requests/minute */
export const strictRateLimit = rateLimiter({ keyPrefix: 'strict', maxRequests: 10 })

/** Presence endpoint rate limit: 30 requests/minute (account for heartbeats) */
export const presenceRateLimit = rateLimiter({ keyPrefix: 'presence', maxRequests: 30 })
