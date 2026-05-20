import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../lib/db', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
    $executeRaw: vi.fn(),
    magicLink: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

import { prisma } from '../../lib/db'
import { createPortalMagicLink, upgradeActivePortalLinksToGroup, validateMagicLink } from '../magic-link'

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

describe('createPortalMagicLink', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a random 32-character portal token with default expiry and replaces active case links', async () => {
    vi.mocked(prisma.magicLink.create).mockImplementationOnce(({ data, select: _select }) => {
      expect(data.token).toMatch(/^[0-9A-Za-z_-]{32}$/)
      expect(data.expiresAt).toBeInstanceOf(Date)
      expect(data.type).toBe('PORTAL')
      expect(data.isActive).toBe(true)
      return Promise.resolve({
        id: 'link-new',
        token: data.token,
        expiresAt: data.expiresAt,
        scope: data.scope,
        clientGroupId: data.clientGroupId,
      }) as never
    })
    vi.mocked(prisma.magicLink.updateMany).mockResolvedValueOnce({ count: 1 } as never)

    const link = await createPortalMagicLink('case_1')

    expect(link.id).toBe('link-new')
    expect(link.url).toContain('/upload/')
    expect(prisma.magicLink.updateMany).toHaveBeenCalledWith({
      where: {
        id: { not: 'link-new' },
        type: 'PORTAL',
        isActive: true,
        scope: 'CASE',
        caseId: 'case_1',
      },
      data: {
        isActive: false,
        replacedById: 'link-new',
      },
    })
    expect(prisma.$executeRaw).toHaveBeenCalled()
  })
})

describe('validateMagicLink lifecycle checks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects revoked portal links', async () => {
    vi.mocked(prisma.magicLink.findUnique).mockResolvedValueOnce({
      id: 'link_1',
      token: 'tok',
      type: 'PORTAL',
      scope: 'CASE',
      isActive: true,
      revokedAt: new Date(),
      replacedById: null,
      expiresAt: null,
      taxCase: null,
      clientGroup: null,
    } as never)

    const result = await validateMagicLink('tok')

    expect(result).toEqual({ valid: false, error: 'INVALID_TOKEN' })
    expect(prisma.magicLink.update).not.toHaveBeenCalled()
  })

  it('rejects replaced portal links', async () => {
    vi.mocked(prisma.magicLink.findUnique).mockResolvedValueOnce({
      id: 'link_1',
      token: 'tok',
      type: 'PORTAL',
      scope: 'CASE',
      isActive: true,
      revokedAt: null,
      replacedById: 'link_2',
      expiresAt: null,
      taxCase: null,
      clientGroup: null,
    } as never)

    const result = await validateMagicLink('tok')

    expect(result).toEqual({ valid: false, error: 'INVALID_TOKEN' })
    expect(prisma.magicLink.update).not.toHaveBeenCalled()
  })
})
