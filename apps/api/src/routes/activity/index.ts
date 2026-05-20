import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { AuthVariables } from '../../middleware/auth'
import {
  InvalidActivityCursorError,
  listClientActivity,
  listRecentActivity,
} from '../../services/activity-query'
import { activityQuerySchema, clientActivityParamSchema } from './schemas'

const activityRoute = new Hono<{ Variables: AuthVariables }>()

activityRoute.get('/recent', zValidator('query', activityQuerySchema), async (c) => {
  const user = c.get('user')
  const filters = c.req.valid('query')
  try {
    const result = await listRecentActivity(user, filters)

    return c.json(result)
  } catch (error) {
    if (error instanceof InvalidActivityCursorError) {
      return c.json({ error: 'INVALID_CURSOR', message: 'Invalid activity cursor' }, 400)
    }
    throw error
  }
})

activityRoute.get(
  '/clients/:clientId',
  zValidator('param', clientActivityParamSchema),
  zValidator('query', activityQuerySchema),
  async (c) => {
    const user = c.get('user')
    const { clientId } = c.req.valid('param')
    const filters = c.req.valid('query')
    try {
      const result = await listClientActivity(user, clientId, filters)

      if (!result) {
        return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
      }

      return c.json(result)
    } catch (error) {
      if (error instanceof InvalidActivityCursorError) {
        return c.json({ error: 'INVALID_CURSOR', message: 'Invalid activity cursor' }, 400)
      }
      throw error
    }
  }
)

export { activityRoute }
