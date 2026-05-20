import { ActivityRiskLevel } from '@ella/db'
import { z } from 'zod'
import { ACTIVITY_CATEGORIES, type ActivityCategory } from '../../services/activity-actions'

const activityCategoryValues = Object.values(ACTIVITY_CATEGORIES) as [
  ActivityCategory,
  ...ActivityCategory[],
]

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
  category: z.enum(activityCategoryValues).optional(),
  actorStaffId: z.string().min(1).optional(),
  riskLevel: z.nativeEnum(ActivityRiskLevel).optional(),
})

export const clientActivityParamSchema = z.object({
  clientId: z.string().min(1),
})

export type ActivityQuery = z.infer<typeof activityQuerySchema>
