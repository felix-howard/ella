import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useClientPaidServices } from './use-client-paid-services'

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn((options: {
    queryKey: string[]
    queryFn: () => Promise<unknown>
    enabled: boolean
  }) => options),
  list: vi.fn(async () => ({
    success: true,
    data: [],
    meta: { isTruncated: false, limit: 100 },
  })),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}))

vi.mock('../../../lib/api-client', () => ({
  api: { clients: { paidServices: { list: mocks.list } } },
}))

beforeEach(() => {
  mocks.useQuery.mockClear()
  mocks.list.mockClear()
})

describe('useClientPaidServices', () => {
  it('uses the client-scoped cache key and exact API method', async () => {
    useClientPaidServices('client_1')
    const options = mocks.useQuery.mock.calls[0][0]

    expect(options.queryKey).toEqual(['client-paid-services', 'client_1'])
    expect(options.enabled).toBe(true)
    await options.queryFn()
    expect(mocks.list).toHaveBeenCalledWith('client_1')
  })

  it('does not query without a client ID', () => {
    useClientPaidServices('')
    expect(mocks.useQuery.mock.calls[0][0].enabled).toBe(false)
  })
})
