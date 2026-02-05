/**
 * Team route validation schemas
 * Zod schemas for team member management endpoints
 */
import { z } from 'zod'

export const inviteMemberSchema = z.object({
  emailAddress: z.string().email(),
  role: z.enum(['org:admin', 'org:member']).default('org:member'),
})

export const updateMemberRoleSchema = z.object({
  role: z.enum(['org:admin', 'org:member']),
})

export const staffIdParamSchema = z.object({
  staffId: z.string().min(1),
})

export const invitationIdParamSchema = z.object({
  invitationId: z.string().min(1),
})
