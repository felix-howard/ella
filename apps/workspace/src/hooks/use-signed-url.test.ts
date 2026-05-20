import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}))

vi.mock('react', () => ({
  useCallback: (callback: () => void) => callback,
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mocks.useQuery(options),
  useQueryClient: () => mocks.useQueryClient(),
}))

vi.mock('../lib/api-client', () => ({
  api: {
    cases: {
      getImageSignedUrl: vi.fn(),
    },
  },
}))

import { SIGNED_URL_GC_TIME_MS, SIGNED_URL_STALE_TIME_MS, useSignedUrl } from './use-signed-url'

describe('useSignedUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useQuery.mockReturnValue({ data: null })
    mocks.useQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
    })
  })

  it('clamps caller staleTime so signed document URLs refresh before expiry', () => {
    useSignedUrl('img_1', { staleTime: 55 * 60 * 1000 })

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        staleTime: SIGNED_URL_STALE_TIME_MS,
        gcTime: SIGNED_URL_GC_TIME_MS,
      })
    )
  })

  it('allows shorter caller staleTime values', () => {
    useSignedUrl('img_1', { staleTime: 60 * 1000 })

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        staleTime: 60 * 1000,
        gcTime: SIGNED_URL_GC_TIME_MS,
      })
    )
  })
})
