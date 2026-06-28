import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiError } from './api-client'

vi.mock('./i18n', () => ({
  default: {
    t: (key: string) => key,
  },
}))

import { request } from './api-client'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('portal API client', () => {
  it('preserves API error codes from JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: 'AGREEMENT_VOIDED',
            message: 'Agreement has been revoked',
          }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    )

    await expect(request('/agreements/revoked-token')).rejects.toMatchObject({
      status: 409,
      code: 'AGREEMENT_VOIDED',
    } satisfies Partial<ApiError>)
  })
})
