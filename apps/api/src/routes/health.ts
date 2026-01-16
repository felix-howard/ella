import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { getGeminiStatus } from '../services/ai/gemini-client'

const healthRoute = new OpenAPIHono()

const route = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      description: 'Health check response',
      content: {
        'application/json': {
          schema: z.object({
            status: z.literal('ok'),
            timestamp: z.string(),
            gemini: z.object({
              configured: z.boolean(),
              model: z.string(),
              available: z.boolean(),
              checkedAt: z.string().nullable(),
              error: z.string().nullable().optional(),
            }),
          }),
        },
      },
    },
  },
})

healthRoute.openapi(route, (c) => {
  const geminiStatus = getGeminiStatus()

  return c.json({
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    gemini: {
      configured: geminiStatus.configured,
      model: geminiStatus.model,
      available: geminiStatus.available,
      checkedAt: geminiStatus.checkedAt,
      error: geminiStatus.error,
    },
  })
})

export { healthRoute }
