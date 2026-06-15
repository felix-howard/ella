/**
 * Team route validation schemas
 * Zod schemas for team member management endpoints
 */
import { z } from 'zod'
import { APP_ROLES } from '../../lib/staff-role-mapping'

const staffFileContentTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const
const staffPaymentCountries = ['US', 'VN', 'PH'] as const

const accountNumberRules: Record<
  (typeof staffPaymentCountries)[number],
  { min: number; max: number }
> = {
  US: { min: 4, max: 17 },
  VN: { min: 6, max: 20 },
  PH: { min: 6, max: 20 },
}

const staffFileExtensionsByMime: Record<(typeof staffFileContentTypes)[number], string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
}

function fileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

function isValidRoutingNumber(routing: string): boolean {
  if (!/^\d{9}$/.test(routing)) return false

  const digits = routing.split('').map(Number)
  const checksum =
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    (digits[2] + digits[5] + digits[8])

  return checksum % 10 === 0
}

function validateStaffPaymentInfo(
  input: {
    country: (typeof staffPaymentCountries)[number]
    accountNumber: string
    routingNumber?: string
  },
  ctx: z.RefinementCtx
) {
  const accountNumber = digitsOnly(input.accountNumber)
  const accountRule = accountNumberRules[input.country]

  if (accountNumber !== input.accountNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['accountNumber'],
      message: 'Account number must contain digits only',
    })
  }

  if (accountNumber.length < accountRule.min || accountNumber.length > accountRule.max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['accountNumber'],
      message: `Account number must be ${accountRule.min}-${accountRule.max} digits for ${input.country}`,
    })
  }

  if (input.country === 'US') {
    if (!input.routingNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['routingNumber'],
        message: 'Routing number is required for US payment info',
      })
    } else if (!isValidRoutingNumber(input.routingNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['routingNumber'],
        message: 'Invalid routing number',
      })
    }
    return
  }

  if (input.routingNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['routingNumber'],
      message: 'Routing number is only supported for US payment info',
    })
  }
}

function validateStaffFileUpload(
  input: {
    kind: 'PERSONAL_DOCUMENT' | 'INVOICE'
    contentType: (typeof staffFileContentTypes)[number]
    originalFilename: string
    invoiceYear?: number
    invoiceMonth?: number
  },
  ctx: z.RefinementCtx
) {
  if (input.kind === 'INVOICE' && (!input.invoiceYear || !input.invoiceMonth)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['invoiceYear'],
      message: 'invoiceYear and invoiceMonth are required for invoices',
    })
  }

  if (input.kind === 'PERSONAL_DOCUMENT' && (input.invoiceYear || input.invoiceMonth)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['invoiceYear'],
      message: 'invoice fields are only allowed for invoices',
    })
  }

  const allowedExtensions = staffFileExtensionsByMime[input.contentType]
  if (!allowedExtensions.includes(fileExtension(input.originalFilename))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['originalFilename'],
      message: 'File extension does not match content type',
    })
  }
}

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

export const staffPaymentCountryParamSchema = z.object({
  country: z.enum(staffPaymentCountries),
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
  // ADMIN-only preferences — handler rejects when target staff is not ADMIN
  notifyOnAgreementSigned: z.boolean().optional(),
  notifyOnClientPayment: z.boolean().optional(),
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

const staffFileUploadMetadataSchema = z.object({
  kind: z.enum(['PERSONAL_DOCUMENT', 'INVOICE']),
  contentType: z.enum(staffFileContentTypes),
  fileSize: z.number().int().min(100).max(10 * 1024 * 1024),
  originalFilename: z.string().trim().min(1).max(255),
  invoiceYear: z.number().int().min(2000).max(2100).optional(),
  invoiceMonth: z.number().int().min(1).max(12).optional(),
})

export const staffFilePresignedUrlSchema =
  staffFileUploadMetadataSchema.superRefine(validateStaffFileUpload)

export const staffFileConfirmUploadSchema = staffFileUploadMetadataSchema
  .extend({
    uploadKey: z.string().startsWith('staff-files/'),
    title: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(80).optional(),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  })
  .superRefine(validateStaffFileUpload)

export const listStaffFilesQuerySchema = z.object({
  kind: z.enum(['PERSONAL_DOCUMENT', 'INVOICE']).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const updateStaffFileSchema = z.object({
  title: z.string().trim().min(1).max(120),
})

export const updateStaffInvoiceStatusSchema = z.object({
  status: z.enum(['SUBMITTED', 'APPROVED', 'PAID', 'REJECTED']),
  adminNote: z.string().trim().max(1000).optional().nullable(),
})

export const upsertStaffPaymentInfoBodySchema = z.object({
  nameOnAccount: z.string().trim().min(1).max(120),
  bankName: z.string().trim().min(1).max(120),
  accountNumber: z.string().trim().min(1).max(34),
  routingNumber: z.string().trim().optional(),
})

export const upsertStaffPaymentInfoSchema = upsertStaffPaymentInfoBodySchema
  .extend({ country: z.enum(staffPaymentCountries) })
  .superRefine(validateStaffPaymentInfo)
