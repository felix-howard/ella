import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UploadLinkData } from '../../lib/api-client'
import { getDaysUntilExpiry, isUploadLinkExpiringSoon } from './upload-link-state'

function link(overrides: Partial<UploadLinkData> = {}): UploadLinkData {
  return {
    id: 'link_1',
    status: 'ACTIVE',
    url: 'https://portal.test/upload/token',
    scope: 'CASE',
    clientGroupId: null,
    expiresAt: '2026-05-21T00:00:00.000Z',
    revokedAt: null,
    extendedAt: null,
    lastUsedAt: null,
    usageCount: 0,
    createdAt: '2026-05-18T00:00:00.000Z',
    updatedAt: '2026-05-18T00:00:00.000Z',
    ...overrides,
  }
}

describe('upload link status helpers', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('marks active links expiring within three days as expiring soon', () => {
    vi.setSystemTime(new Date('2026-05-18T00:00:00.000Z'))

    expect(getDaysUntilExpiry('2026-05-21T00:00:00.000Z')).toBe(3)
    expect(isUploadLinkExpiringSoon(link())).toBe(true)
  })

  it('does not mark inactive or later links as expiring soon', () => {
    vi.setSystemTime(new Date('2026-05-18T00:00:00.000Z'))

    expect(isUploadLinkExpiringSoon(link({ expiresAt: '2026-05-25T00:00:00.000Z' }))).toBe(false)
    expect(isUploadLinkExpiringSoon(link({ status: 'REVOKED', revokedAt: '2026-05-18T01:00:00.000Z' }))).toBe(false)
  })
})
