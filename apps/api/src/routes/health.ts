import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { getGeminiStatus } from '../services/ai/gemini-client'
import { getPipelineStatus } from '../services/ai/document-pipeline'
import { getPopplerStatus } from '../services/pdf'

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
            pdfSupport: z.object({
              enabled: z.boolean(),
              maxSizeMB: z.number(),
              maxPages: z.number(),
              renderDpi: z.number(),
              popplerInstalled: z.boolean(),
              popplerError: z.string().nullable().optional(),
            }),
            supportedFormats: z.object({
              images: z.array(z.string()),
              documents: z.array(z.string()),
            }),
          }),
        },
      },
    },
  },
})

healthRoute.openapi(route, (c) => {
  const geminiStatus = getGeminiStatus()
  const pipelineStatus = getPipelineStatus()
  const popplerStatus = getPopplerStatus()

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
    pdfSupport: {
      ...pipelineStatus.pdfSupport,
      popplerInstalled: popplerStatus?.installed ?? false,
      popplerError: popplerStatus?.error ?? null,
    },
    supportedFormats: pipelineStatus.supportedFormats,
  })
})

export { healthRoute }
