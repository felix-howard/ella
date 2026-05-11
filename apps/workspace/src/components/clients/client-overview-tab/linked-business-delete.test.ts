import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteClient: vi.fn(),
  updateClientGroup: vi.fn(),
}))

vi.mock('../../../lib/api-client', () => ({
  api: {
    clients: { delete: mocks.deleteClient },
    clientGroups: { update: mocks.updateClientGroup },
  },
}))

import { deleteLinkedBusinessClient } from './linked-business-delete'

describe('deleteLinkedBusinessClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes the business client instead of unlinking it from the group', async () => {
    mocks.deleteClient.mockResolvedValue({ success: true, message: 'Client deleted successfully' })

    await expect(deleteLinkedBusinessClient('biz-1')).resolves.toEqual({
      success: true,
      message: 'Client deleted successfully',
    })

    expect(mocks.deleteClient).toHaveBeenCalledWith('biz-1')
    expect(mocks.updateClientGroup).not.toHaveBeenCalled()
  })

  it('rejects missing business ids before calling the API', () => {
    expect(() => deleteLinkedBusinessClient('')).toThrow('Business client not found')
    expect(mocks.deleteClient).not.toHaveBeenCalled()
  })
})
