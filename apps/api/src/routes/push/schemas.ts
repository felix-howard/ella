import { z } from 'zod'
import { isAllowedWebPushEndpoint } from '../../services/web-push/web-push-endpoint-validation'
export { isAllowedWebPushEndpoint } from '../../services/web-push/web-push-endpoint-validation'

export const pushEndpointSchema = z.object({
  endpoint: z.string().url().max(4096).refine(isAllowedWebPushEndpoint, {
    message: 'Unsupported push endpoint',
  }),
})

export const pushSubscribeSchema = pushEndpointSchema.extend({
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().trim().min(1).max(4096),
    auth: z.string().trim().min(1).max(4096),
  }),
  deviceLabel: z.string().trim().min(1).max(120).optional(),
})
