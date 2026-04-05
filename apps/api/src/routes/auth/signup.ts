/**
 * Self-service signup endpoint
 * Creates Clerk user + organization, returns sign-in token for cross-domain auth
 * Public endpoint (no auth required), rate limited
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { clerkClient } from '../../lib/clerk-client'
import { config } from '../../lib/config'
import { prisma } from '../../lib/db'
import { rateLimiter } from '../../middleware/rate-limiter'

const signupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  orgName: z.string().min(1),
})

// Strict rate limit: 5 signup attempts per minute per IP
const signupRateLimit = rateLimiter({ keyPrefix: 'signup', maxRequests: 5 })

const authSignupRoute = new Hono()

authSignupRoute.post(
  '/signup',
  signupRateLimit,
  zValidator('json', signupSchema),
  async (c) => {
    const { firstName, lastName, email, password, orgName } = c.req.valid('json')

    let userId: string | null = null
    let orgId: string | null = null

    try {
      // 1. Create Clerk user
      const user = await clerkClient.users.createUser({
        emailAddress: [email],
        password,
        firstName,
        lastName,
      })
      userId = user.id

      // 2. Create organization (auto-adds user as admin)
      const clerkOrg = await clerkClient.organizations.createOrganization({
        name: orgName,
        createdBy: userId,
      })
      orgId = clerkOrg.id

      // 3. Create DB records immediately (don't wait for webhook)
      const dbOrg = await prisma.organization.upsert({
        where: { clerkOrgId: orgId },
        update: {},
        create: { clerkOrgId: orgId, name: orgName },
      })
      await prisma.staff.upsert({
        where: { clerkId: userId },
        update: { organizationId: dbOrg.id },
        create: {
          clerkId: userId,
          email,
          name: `${firstName} ${lastName}`,
          role: 'ADMIN',
          avatarUrl: user.imageUrl,
          organizationId: dbOrg.id,
        },
      })

      // 4. Generate short-lived sign-in token
      const signInToken = await clerkClient.signInTokens.createSignInToken({
        userId,
        expiresInSeconds: 300,
      })

      // 5. Build redirect URL
      const redirectUrl = `${config.workspaceUrl}/auto-login?token=${signInToken.token}&orgId=${orgId}`

      return c.json({ success: true, redirectUrl })
    } catch (error: unknown) {
      // Rollback: clean up any created resources
      if (orgId) {
        try {
          await clerkClient.organizations.deleteOrganization(orgId)
        } catch {
          console.error('[Signup] Rollback failed - orphaned org:', orgId)
        }
      }
      if (userId) {
        try {
          await clerkClient.users.deleteUser(userId)
        } catch {
          console.error('[Signup] Rollback failed - orphaned user:', userId)
        }
      }

      const clerkErr = error as { errors?: Array<{ code?: string; message?: string }> }
      const firstErr = clerkErr.errors?.[0]

      if (firstErr?.code === 'form_identifier_exists') {
        return c.json({ error: 'Email already in use' }, 400)
      }
      if (firstErr?.code === 'form_password_pwned') {
        return c.json({ error: 'Password is too weak, please choose a different one' }, 400)
      }

      return c.json({ error: 'Signup failed, please try again' }, 400)
    }
  }
)

// GET /auth/invitation-info?ticket=<clerk_ticket> - Get org name from invitation ticket (public)
authSignupRoute.get('/invitation-info', async (c) => {
  const ticket = c.req.query('ticket')
  if (!ticket) {
    return c.json({ error: 'Missing ticket' }, 400)
  }

  try {
    // Decode JWT payload to extract org ID
    const parts = ticket.split('.')
    if (parts.length < 2) {
      return c.json({ orgName: '' })
    }

    // Base64url decode the payload
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))

    // Clerk tickets use 'oid' for org ID
    const orgId = payload.oid || payload.org_id || payload.organization_id || ''
    if (!orgId) {
      return c.json({ orgName: '' })
    }

    const org = await clerkClient.organizations.getOrganization({ organizationId: orgId })
    return c.json({ orgName: org.name || '' })
  } catch (error) {
    console.error('[Auth] Failed to get invitation info:', error)
    return c.json({ orgName: '' })
  }
})

export { authSignupRoute }
