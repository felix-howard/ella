import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api-client'

const fetchMock = vi.fn()

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('api.leads.messages.listLatest', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the backend latest window so partial last pages do not truncate history', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      messages: Array.from({ length: 50 }, (_, index) => ({ id: `msg_${index + 2}` })),
      pagination: { page: 2, limit: 50, total: 51, totalPages: 2 },
    }))

    const result = await api.leads.messages.listLatest('lead_1')

    expect(result.messages).toHaveLength(50)
    expect(result.messages[0]?.id).toBe('msg_2')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('page')).toBe('1')
    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('latest')).toBe('true')
  })
})
