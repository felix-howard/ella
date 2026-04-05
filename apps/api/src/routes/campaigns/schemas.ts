/**
 * Campaign route Zod schemas
 * Validation for campaign management endpoints
 */
import { z } from 'zod'

/** Create campaign */
export const createCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(50),
  tag: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
})

/** Update campaign */
export const updateCampaignSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
})

/** Campaign ID param */
export const campaignIdParamSchema = z.object({
  id: z.string().cuid(),
})
