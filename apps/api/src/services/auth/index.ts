/**
 * Auth Service - JWT + bcrypt authentication
 * Phase 3: Authentication System
 */
import { sign, verify } from 'hono/jwt'
import bcrypt from 'bcrypt'
import { createHash, randomBytes } from 'crypto'
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'

const BCRYPT_ROUNDS = 12

export interface JWTPayload {
  sub: string // userId
  email: string
  name: string // H3: Include name in JWT
  role: string
  exp: number
  iat: number
  [key: string]: unknown // Allow index signature for hono/jwt compatibility
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface UserData {
  id: string
  email: string
  name: string
  role: string
}

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(password, hashed)
}

/**
 * Parse expiry string (e.g., "15m", "1h", "7d") to seconds
 */
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/)
  if (!match) return 15 * 60 // Default 15 minutes

  const value = parseInt(match[1])
  const unit = match[2]

  switch (unit) {
    case 's': return value
    case 'm': return value * 60
    case 'h': return value * 60 * 60
    case 'd': return value * 60 * 60 * 24
    default: return 15 * 60
  }
}

/**
 * Generate access token (JWT)
 */
export async function generateAccessToken(user: UserData): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = parseExpiry(config.auth.jwtExpiresIn)

  const payload: JWTPayload = {
    sub: user.id,
    email: user.email,
    name: user.name, // H3: Include name in JWT
    role: user.role,
    iat: now,
    exp: now + expiresIn,
  }

  return sign(payload, config.auth.jwtSecret)
}

/**
 * Verify access token and return payload
 */
export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const rawPayload = await verify(token, config.auth.jwtSecret)

    // Type guard to ensure payload has required fields
    if (
      typeof rawPayload.sub !== 'string' ||
      typeof rawPayload.email !== 'string' ||
      typeof rawPayload.role !== 'string' ||
      typeof rawPayload.exp !== 'number'
    ) {
      return null
    }

    const payload: JWTPayload = {
      sub: rawPayload.sub,
      email: rawPayload.email,
      name: typeof rawPayload.name === 'string' ? rawPayload.name : '', // H3: Include name
      role: rawPayload.role,
      exp: rawPayload.exp,
      iat: typeof rawPayload.iat === 'number' ? rawPayload.iat : 0,
    }

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

/**
 * Hash token for storage (SHA-256)
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Generate refresh token (opaque) and store in DB
 */
export async function generateRefreshToken(userId: string): Promise<string> {
  // Generate random token
  const rawToken = randomBytes(32).toString('hex')

  // Hash for storage
  const hashedToken = hashToken(rawToken)

  // Calculate expiry
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + config.auth.refreshTokenExpiresDays)

  // Store in database
  await prisma.refreshToken.create({
    data: {
      userId,
      token: hashedToken,
      expiresAt,
    },
  })

  return rawToken
}

/**
 * Verify refresh token and return userId
 */
export async function verifyRefreshToken(rawToken: string): Promise<{ userId: string } | null> {
  const hashedToken = hashToken(rawToken)

  const refreshToken = await prisma.refreshToken.findUnique({
    where: { token: hashedToken },
    include: { user: true },
  })

  if (!refreshToken) return null
  if (refreshToken.revokedAt) return null
  if (refreshToken.expiresAt < new Date()) return null
  if (!refreshToken.user.isActive) return null

  return { userId: refreshToken.userId }
}

/**
 * Rotate refresh token (revoke old, issue new)
 * H4: Validates old token ownership before rotation
 */
export async function rotateRefreshToken(oldToken: string, expectedUserId: string): Promise<string> {
  const hashedOld = hashToken(oldToken)

  // Find and validate old token
  const oldRefreshToken = await prisma.refreshToken.findUnique({
    where: { token: hashedOld },
  })

  // Validate token ownership (H4)
  if (!oldRefreshToken || oldRefreshToken.userId !== expectedUserId) {
    throw new Error('Invalid refresh token')
  }

  // Revoke old token
  await prisma.refreshToken.update({
    where: { token: hashedOld },
    data: { revokedAt: new Date() },
  })

  // Issue new token
  return generateRefreshToken(expectedUserId)
}

/**
 * Revoke all refresh tokens for user (logout everywhere)
 */
export async function revokeAllTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/**
 * Generate both access and refresh tokens
 */
export async function generateAuthTokens(user: UserData): Promise<AuthTokens> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(user),
    generateRefreshToken(user.id),
  ])

  return { accessToken, refreshToken }
}

/**
 * Clean up expired tokens (maintenance job)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { not: null } },
      ],
    },
  })

  return result.count
}
