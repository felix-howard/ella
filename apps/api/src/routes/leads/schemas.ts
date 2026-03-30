/**
 * Lead route Zod schemas
 * Validation for lead management endpoints
 */
import { z } from 'zod'

/** Create lead (public endpoint from registration form) */
export const createLeadSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().regex(/^\+?[\d\s\-()]{10,15}$/, 'Invalid phone number format'),
  email: z.string().email().max(254).optional().nullable(),
  businessName: z.string().max(200).optional().nullable(),
  orgSlug: z.string().min(1).max(100),
  eventSlug: z.string().max(100).optional(),
})

/** Lead ID param */
export const leadIdParamSchema = z.object({
  id: z.string().cuid(),
})

/** List leads query */
export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'LOST']).optional(),
  search: z.string().max(100).optional(),
})

/** Update lead */
export const updateLeadSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'LOST']).optional(),
  notes: z.string().max(5000).optional().nullable(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().max(254).optional().nullable(),
  businessName: z.string().max(200).optional().nullable(),
  tags: z.array(z.string().max(100).regex(/^[a-z0-9-]+$/)).max(20).optional(),
})

/** Convert lead to client */
export const convertLeadSchema = z.object({
  managedById: z.string().cuid().optional(),
  language: z.enum(['VI', 'EN']).default('VI'),
  taxYear: z.number().int().min(2020).max(new Date().getFullYear() + 1),
  sendWelcomeSms: z.boolean().default(true),
  customMessage: z.string().max(500).optional(),
})

/** Bulk SMS */
export const bulkSmsSchema = z.object({
  leadIds: z.array(z.string().cuid()).min(1).max(100),
  message: z.string().min(1).max(500),
  formLinkType: z.enum(['org', 'staff']).default('org'),
  staffSlug: z.string().optional(),
})
