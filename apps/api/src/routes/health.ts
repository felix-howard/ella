import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

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
          }),
        },
      },
    },
  },
})

healthRoute.openapi(route, (c) => {
  return c.json({
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
  })
})

export { healthRoute }
