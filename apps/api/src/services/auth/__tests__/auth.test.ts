import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    organization: {
      upsert: vi.fn(),
    },
    staff: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('../../../lib/clerk-client', () => ({
  clerkClient: {
    organizations: {
      getOrganizationMembershipList: vi.fn(),
    },
    users: {
      getUser: vi.fn(),
    },
  },
}))

import { prisma } from '../../../lib/db'
import { clerkClient } from '../../../lib/clerk-client'
import { syncStaffFromClerkMembership } from '../index'

const membership = {
  role: 'org:member',
  organization: {
    id: 'org_clerk_1',
    name: 'My Ella Team',
    slug: 'my-ella-team',
    imageUrl: 'https://img.clerk.com/org.png',
  },
  publicUserData: {
    userId: 'user_1',
    identifier: 'member@test.com',
    firstName: 'Member',
    lastName: 'One',
    imageUrl: 'https://img.clerk.com/user.png',
  },
}

describe('Auth service', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('syncStaffFromClerkMembership', () => {
    it('does not sync without an active Clerk organization', async () => {
      const staff = await syncStaffFromClerkMembership('user_1', null)

      expect(staff).toBeNull()
      expect(clerkClient.organizations.getOrganizationMembershipList).not.toHaveBeenCalled()
    })

    it('creates staff from active Clerk membership when webhook has not run yet', async () => {
      vi.mocked(clerkClient.organizations.getOrganizationMembershipList).mockResolvedValueOnce({
        data: [membership],
      } as never)
      vi.mocked(prisma.organization.upsert).mockResolvedValueOnce({ id: 'org_db_1' } as never)
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(null as never)
      vi.mocked(prisma.staff.findUnique)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'staff_1', clerkId: 'user_1', organizationId: 'org_db_1' } as never)
      vi.mocked(prisma.staff.upsert).mockResolvedValueOnce({} as never)

      const staff = await syncStaffFromClerkMembership('user_1', 'org_clerk_1', 'org:member')

      expect(staff).toEqual(expect.objectContaining({ id: 'staff_1' }))
      expect(prisma.organization.upsert).toHaveBeenCalledWith({
        where: { clerkOrgId: 'org_clerk_1' },
        update: {
          name: 'My Ella Team',
          slug: 'my-ella-team',
          logoUrl: 'https://img.clerk.com/org.png',
        },
        create: {
          clerkOrgId: 'org_clerk_1',
          name: 'My Ella Team',
          slug: 'my-ella-team',
          logoUrl: 'https://img.clerk.com/org.png',
        },
      })
      expect(prisma.staff.upsert).toHaveBeenCalledWith({
        where: { clerkId: 'user_1' },
        update: expect.objectContaining({
          clerkId: 'user_1',
          email: 'member@test.com',
          name: 'Member One',
          role: 'STAFF',
          organizationId: 'org_db_1',
          isActive: true,
        }),
        create: expect.objectContaining({
          clerkId: 'user_1',
          email: 'member@test.com',
          role: 'STAFF',
          language: 'EN',
          formSlug: expect.stringMatching(/^\d{6}$/),
        }),
      })
    })

    it('links an existing invited staff row by email', async () => {
      vi.mocked(clerkClient.organizations.getOrganizationMembershipList).mockResolvedValueOnce({
        data: [{ ...membership, role: 'org:admin' }],
      } as never)
      vi.mocked(prisma.organization.upsert).mockResolvedValueOnce({ id: 'org_db_1' } as never)
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(null as never)
      vi.mocked(prisma.staff.findUnique)
        .mockResolvedValueOnce({ id: 'staff_existing', email: 'member@test.com', clerkId: null, formSlug: null } as never)
        .mockResolvedValueOnce({ id: 'staff_existing', clerkId: 'user_1', organizationId: 'org_db_1' } as never)
      vi.mocked(prisma.staff.update).mockResolvedValueOnce({} as never)

      await syncStaffFromClerkMembership('user_1', 'org_clerk_1', 'org:admin')

      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff_existing' },
        data: expect.objectContaining({
          clerkId: 'user_1',
          role: 'ADMIN',
          organizationId: 'org_db_1',
          isActive: true,
          formSlug: expect.stringMatching(/^\d{6}$/),
        }),
      })
      expect(prisma.staff.upsert).not.toHaveBeenCalled()
    })

    it('preserves MANAGER role on re-sync for active org:member (no downgrade to STAFF)', async () => {
      // Critical regression case: Clerk re-sync (org:member) must NOT overwrite
      // the app-level MANAGER role with STAFF. Stale invite metadata (staffRole:
      // STAFF from the original invite) must be IGNORED for an active member —
      // exercises the isActiveMember metadata-suppression guard in the sync.
      vi.mocked(clerkClient.organizations.getOrganizationMembershipList).mockResolvedValueOnce({
        data: [{ ...membership, publicMetadata: { staffRole: 'STAFF' } }],
      } as never)
      vi.mocked(prisma.organization.upsert).mockResolvedValueOnce({ id: 'org_db_1' } as never)
      // Lookup by email finds the existing active MANAGER in the same org
      vi.mocked(prisma.staff.findUnique)
        .mockResolvedValueOnce({
          id: 'staff_mgr',
          email: 'member@test.com',
          clerkId: 'user_1',
          role: 'MANAGER',
          organizationId: 'org_db_1',
          isActive: true,
          formSlug: '123456',
        } as never)
        .mockResolvedValueOnce({ id: 'staff_mgr', clerkId: 'user_1', organizationId: 'org_db_1' } as never)
      vi.mocked(prisma.staff.update).mockResolvedValueOnce({} as never)

      await syncStaffFromClerkMembership('user_1', 'org_clerk_1', 'org:member')

      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff_mgr' },
        data: expect.objectContaining({ role: 'MANAGER' }),
      })
    })

    it('demotes app ADMIN to STAFF when Clerk role becomes org:member', async () => {
      vi.mocked(clerkClient.organizations.getOrganizationMembershipList).mockResolvedValueOnce({
        data: [membership],
      } as never)
      vi.mocked(prisma.organization.upsert).mockResolvedValueOnce({ id: 'org_db_1' } as never)
      vi.mocked(prisma.staff.findUnique)
        .mockResolvedValueOnce({
          id: 'staff_admin',
          email: 'member@test.com',
          clerkId: 'user_1',
          role: 'ADMIN',
          organizationId: 'org_db_1',
          isActive: true,
          formSlug: '123456',
        } as never)
        .mockResolvedValueOnce({ id: 'staff_admin', clerkId: 'user_1', organizationId: 'org_db_1' } as never)
      vi.mocked(prisma.staff.update).mockResolvedValueOnce({} as never)

      await syncStaffFromClerkMembership('user_1', 'org_clerk_1', 'org:member')

      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff_admin' },
        data: expect.objectContaining({ role: 'STAFF' }),
      })
    })

    it('does not relink an email already owned by another Clerk user', async () => {
      vi.mocked(clerkClient.organizations.getOrganizationMembershipList).mockResolvedValueOnce({
        data: [membership],
      } as never)
      vi.mocked(prisma.organization.upsert).mockResolvedValueOnce({ id: 'org_db_1' } as never)
      vi.mocked(prisma.staff.findUnique).mockResolvedValueOnce({
        id: 'staff_other',
        email: 'member@test.com',
        clerkId: 'user_other',
      } as never)

      const staff = await syncStaffFromClerkMembership('user_1', 'org_clerk_1')

      expect(staff).toBeNull()
      expect(prisma.staff.update).not.toHaveBeenCalled()
      expect(prisma.staff.upsert).not.toHaveBeenCalled()
    })
  })
})
