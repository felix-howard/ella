/**
 * Clerk Backend Client - Server-side Clerk operations
 * Used for team management: invitations, membership updates, org operations
 */
import { createClerkClient } from '@clerk/backend'
import { config } from './config'

export const clerkClient = createClerkClient({
  secretKey: config.clerk.secretKey,
})
