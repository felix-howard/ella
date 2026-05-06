import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../lib/db', () => ({
  prisma: {
    magicLink: {
      updateMany: vi.fn(),
    },
  },
}))

import { prisma } from '../../lib/db'
import { upgradeActivePortalLinksToGroup } from '../magic-link'

describe('upgradeActivePortalLinksToGroup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upgrades active PORTAL links for a case to GROUP scope', async () => {
    vi.mocked(prisma.magicLink.updateMany).mockResolvedValueOnce({ count: 2 } as never)

    const count = await upgradeActivePortalLinksToGroup('case_1', 'group_1')

    expect(count).toBe(2)
    expect(prisma.magicLink.updateMany).toHaveBeenCalledWith({
      where: {
        caseId: 'case_1',
        type: 'PORTAL',
        isActive: true,
      },
      data: {
        scope: 'GROUP',
        clientGroupId: 'group_1',
      },
    })
  })
})
