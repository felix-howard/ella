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

// Profile update schema - self-edit only
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phoneNumber: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, 'Invalid E.164 format')
    .optional()
    .nullable(),
})

// Avatar presigned URL request
export const avatarPresignedUrlSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  fileSize: z.number().min(100).max(5 * 1024 * 1024), // 100B - 5MB
})

// Avatar confirm schema - after direct browser upload
export const avatarConfirmSchema = z.object({
  r2Key: z.string().startsWith('avatars/'),
})
