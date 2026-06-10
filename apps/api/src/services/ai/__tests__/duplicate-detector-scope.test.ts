/**
 * Tenant-isolation tests for image-group access (ELLA-SEC-001 / ELLA-SEC-002).
 * Verifies getGroupImages + selectBestImage scope every lookup through
 * taxCase -> client -> organizationId so a staffer cannot read or mutate another
 * org's image group by id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    imageGroup: { findFirst: vi.fn(), update: vi.fn() },
    rawImage: { findUnique: vi.fn() },
  },
}))

import { prisma } from '../../../lib/db'
import { getGroupImages, selectBestImage } from '../duplicate-detector'
import type { AuthUser } from '../../auth'

const adminA: AuthUser = {
  id: 'u-admin-a',
  staffId: 's-admin-a',
  email: 'admin@a.test',
  name: 'Admin A',
  role: 'ADMIN',
  organizationId: 'org-a',
  clerkOrgId: 'org_a',
  orgRole: 'org:admin',
}

const staffA: AuthUser = {
  id: 'u-staff-a',
  staffId: 's-staff-a',
  email: 'staff@a.test',
  name: 'Staff A',
  role: 'STAFF',
  organizationId: 'org-a',
  clerkOrgId: 'org_a',
  orgRole: 'org:member',
}

const mockFindFirst = vi.mocked(prisma.imageGroup.findFirst)
const mockUpdate = vi.mocked(prisma.imageGroup.update)
const mockRawFindUnique = vi.mocked(prisma.rawImage.findUnique)

describe('image-group tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getGroupImages', () => {
    it('scopes the lookup by org (taxCase -> client -> organizationId)', async () => {
      mockFindFirst.mockResolvedValueOnce(null as never)

      await getGroupImages('grp-1', adminA)

      expect(mockFindFirst).toHaveBeenCalledTimes(1)
      const arg = mockFindFirst.mock.calls[0][0] as { where: Record<string, unknown> }
      expect(arg.where).toMatchObject({
        id: 'grp-1',
        taxCase: { client: { organizationId: 'org-a' } },
      })
    })

    it('adds the manager-assignment filter for STAFF', async () => {
      mockFindFirst.mockResolvedValueOnce(null as never)

      await getGroupImages('grp-1', staffA)

      const arg = mockFindFirst.mock.calls[0][0] as { where: { taxCase: { client: Record<string, unknown> } } }
      expect(arg.where.taxCase.client).toMatchObject({
        organizationId: 'org-a',
        managers: { some: { staffId: 's-staff-a' } },
      })
    })

    it('returns null (404 upstream) when the group is outside the caller org', async () => {
      mockFindFirst.mockResolvedValueOnce(null as never)
      const result = await getGroupImages('grp-from-org-b', adminA)
      expect(result).toBeNull()
    })
  })

  describe('selectBestImage', () => {
    it('throws "not found" and never updates when the group is outside the caller org', async () => {
      mockFindFirst.mockResolvedValueOnce(null as never)

      await expect(selectBestImage('grp-from-org-b', 'img-1', adminA)).rejects.toThrow('not found')
      expect(mockRawFindUnique).not.toHaveBeenCalled()
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('updates bestImageId when the group is in scope and the image belongs to it', async () => {
      mockFindFirst.mockResolvedValueOnce({ id: 'grp-1' } as never)
      mockRawFindUnique.mockResolvedValueOnce({ imageGroupId: 'grp-1' } as never)
      mockUpdate.mockResolvedValueOnce({} as never)

      await selectBestImage('grp-1', 'img-1', adminA)

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'grp-1' },
        data: { bestImageId: 'img-1' },
      })
    })

    it('throws "does not belong" when the image is not part of the group', async () => {
      mockFindFirst.mockResolvedValueOnce({ id: 'grp-1' } as never)
      mockRawFindUnique.mockResolvedValueOnce({ imageGroupId: 'other-grp' } as never)

      await expect(selectBestImage('grp-1', 'img-1', adminA)).rejects.toThrow('does not belong')
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })
})
