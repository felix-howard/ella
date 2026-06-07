/**
 * Team route validation schemas
 * Zod schemas for team member management endpoints
 */
import { z } from 'zod'
import { APP_ROLES } from '../../lib/staff-role-mapping'

// App-level roles (NOT Clerk roles): ADMIN -> org:admin, MANAGER/MEMBER -> org:member.
// Mapping to Clerk role + Staff.role happens in the handlers via staff-role-mapping.
export const inviteMemberSchema = z.object({
  emailAddress: z.string().email(),
  role: z.enum(APP_ROLES).default('MEMBER'),
})

export const updateMemberRoleSchema = z.object({
  role: z.enum(APP_ROLES),
})

export const updateContractorAgentSchema = z.object({
  isContractorAgent: z.boolean(),
})

export const staffIdParamSchema = z.object({
  staffId: z.string().min(1),
})

export const invitationIdParamSchema = z.object({
  invitationId: z.string().min(1),
})

// Profile update schema - self-edit only
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phoneNumber: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, 'Invalid E.164 format')
    .optional()
    .nullable(),
  // NDA signing identity
  title: z.string().max(80).nullable().optional(),
  // Notification preferences
  notifyOnUpload: z.boolean().optional(),
  notifyOnChat: z.boolean().optional(),
})

// Notification subscriptions update
export const updateNotificationSubscriptionsSchema = z.object({
  targetStaffIds: z.array(z.string()).max(50),
  type: z.enum(['UPLOAD', 'CHAT']).default('UPLOAD'),
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
