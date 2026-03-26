/**
 * Clerk Webhook Service Tests
 * Tests all event handlers: user, organization, and membership events
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('../../../lib/db', () => ({
  prisma: {
    staff: {
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    organization: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from '../../../lib/db'
import { handleClerkWebhook } from '../index'
import type { WebhookEvent } from '@clerk/backend'

// Helper to build a WebhookEvent
function makeEvent(type: string, data: unknown): WebhookEvent {
  return { type, data, object: 'event' } as unknown as WebhookEvent
}

describe('Clerk Webhook Service', () => {
  beforeEach(() => vi.clearAllMocks())

  // ============================================
  // user.created
  // ============================================
  describe('user.created', () => {
    it('upserts staff record for new user', async () => {
      vi.mocked(prisma.staff.upsert).mockResolvedValueOnce({} as never)

      await handleClerkWebhook(makeEvent('user.created', {
        id: 'user_new',
        email_addresses: [{ email_address: 'new@test.com', id: 'email_1' }],
        first_name: 'Jane',
        last_name: 'Smith',
        image_url: 'https://img.clerk.com/jane.jpg',
      }))

      expect(prisma.staff.upsert).toHaveBeenCalledWith({
        where: { clerkId: 'user_new' },
        update: { email: 'new@test.com', name: 'Jane Smith', avatarUrl: 'https://img.clerk.com/jane.jpg' },
        create: { clerkId: 'user_new', email: 'new@test.com', name: 'Jane Smith', avatarUrl: 'https://img.clerk.com/jane.jpg' },
      })
    })

    it('skips when missing required fields', async () => {
      await handleClerkWebhook(makeEvent('user.created', { id: null, email_addresses: [] }))
      expect(prisma.staff.upsert).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // user.updated
  // ============================================
  describe('user.updated', () => {
    it('updates staff email, name, avatar by clerkId', async () => {
      // No custom avatar - should update avatarUrl
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({ avatarUrl: null } as never)
      vi.mocked(prisma.staff.updateMany).mockResolvedValueOnce({ count: 1 })

      await handleClerkWebhook(makeEvent('user.updated', {
        id: 'user_123',
        email_addresses: [{ email_address: 'new@test.com', id: 'email_1' }],
        first_name: 'John',
        last_name: 'Doe',
        image_url: 'https://img.clerk.com/avatar.jpg',
      }))

      expect(prisma.staff.updateMany).toHaveBeenCalledWith({
        where: { clerkId: 'user_123' },
        data: {
          email: 'new@test.com',
          name: 'John Doe',
          avatarUrl: 'https://img.clerk.com/avatar.jpg',
        },
      })
    })

    it('preserves custom R2 avatar on user update', async () => {
      // Staff has custom R2 avatar - should NOT overwrite
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
        avatarUrl: 'avatars/staff_1/custom.jpg',
      } as never)
      vi.mocked(prisma.staff.updateMany).mockResolvedValueOnce({ count: 1 })

      await handleClerkWebhook(makeEvent('user.updated', {
        id: 'user_123',
        email_addresses: [{ email_address: 'new@test.com', id: 'email_1' }],
        first_name: 'John',
        last_name: 'Doe',
        image_url: 'https://img.clerk.com/avatar.jpg',
      }))

      expect(prisma.staff.updateMany).toHaveBeenCalledWith({
        where: { clerkId: 'user_123' },
        data: {
          email: 'new@test.com',
          name: 'John Doe',
          // No avatarUrl - custom avatar preserved
        },
      })
    })

    it('handles missing first/last name gracefully', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(null)
      vi.mocked(prisma.staff.updateMany).mockResolvedValueOnce({ count: 1 })

      await handleClerkWebhook(makeEvent('user.updated', {
        id: 'user_123',
        email_addresses: [{ email_address: 'a@b.com', id: 'e1' }],
        first_name: null,
        last_name: null,
        image_url: '',
      }))

      expect(prisma.staff.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Unknown' }),
        })
      )
    })

    it('skips when missing required fields', async () => {
      await handleClerkWebhook(makeEvent('user.updated', { id: null, email_addresses: [] }))
      expect(prisma.staff.updateMany).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // user.deleted
  // ============================================
  describe('user.deleted', () => {
    it('deactivates all staff records for deleted user', async () => {
      vi.mocked(prisma.staff.updateMany).mockResolvedValueOnce({ count: 1 })

      await handleClerkWebhook(makeEvent('user.deleted', {
        id: 'user_456',
        deleted: true,
      }))

      expect(prisma.staff.updateMany).toHaveBeenCalledWith({
        where: { clerkId: 'user_456' },
        data: { isActive: false, deactivatedAt: expect.any(Date) },
      })
    })

    it('skips when missing user id', async () => {
      await handleClerkWebhook(makeEvent('user.deleted', { deleted: true }))
      expect(prisma.staff.updateMany).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // organization.created
  // ============================================
  describe('organization.created', () => {
    it('upserts organization in DB', async () => {
      vi.mocked(prisma.organization.upsert).mockResolvedValueOnce({} as never)

      await handleClerkWebhook(makeEvent('organization.created', {
        id: 'org_abc',
        name: 'Test Org',
        slug: 'test-org',
        image_url: 'https://img.clerk.com/org.jpg',
      }))

      expect(prisma.organization.upsert).toHaveBeenCalledWith({
        where: { clerkOrgId: 'org_abc' },
        update: { name: 'Test Org', slug: 'test-org', logoUrl: 'https://img.clerk.com/org.jpg' },
        create: { clerkOrgId: 'org_abc', name: 'Test Org', slug: 'test-org', logoUrl: 'https://img.clerk.com/org.jpg' },
      })
    })

    it('skips when missing required fields', async () => {
      await handleClerkWebhook(makeEvent('organization.created', { id: null, name: null }))
      expect(prisma.organization.upsert).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // organization.updated
  // ============================================
  describe('organization.updated', () => {
    it('upserts organization (handles out-of-order events)', async () => {
      vi.mocked(prisma.organization.upsert).mockResolvedValueOnce({} as never)

      await handleClerkWebhook(makeEvent('organization.updated', {
        id: 'org_abc',
        name: 'Updated Org',
        slug: 'updated-org',
        image_url: null,
      }))

      expect(prisma.organization.upsert).toHaveBeenCalledWith({
        where: { clerkOrgId: 'org_abc' },
        update: { name: 'Updated Org', slug: 'updated-org', logoUrl: null },
        create: { clerkOrgId: 'org_abc', name: 'Updated Org', slug: 'updated-org', logoUrl: null },
      })
    })
  })

  // ============================================
  // organizationMembership.created
  // ============================================
  describe('organizationMembership.created', () => {
    const membershipData = {
      id: 'mem_1',
      role: 'org:admin',
      organization: {
        id: 'org_abc',
        name: 'Test Org',
        slug: 'test-org',
        image_url: null,
      },
      public_user_data: {
        user_id: 'user_123',
        identifier: 'john@test.com',
        first_name: 'John',
        last_name: 'Doe',
        image_url: 'https://img.clerk.com/avatar.jpg',
      },
    }

    it('creates org and staff when no existing records', async () => {
      vi.mocked(prisma.organization.upsert).mockResolvedValueOnce({ id: 'db_org_1' } as never)
      vi.mocked(prisma.staff.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.staff.upsert).mockResolvedValueOnce({} as never)

      await handleClerkWebhook(makeEvent('organizationMembership.created', membershipData))

      // Org upserted
      expect(prisma.organization.upsert).toHaveBeenCalledWith({
        where: { clerkOrgId: 'org_abc' },
        update: {},
        create: { clerkOrgId: 'org_abc', name: 'Test Org', slug: 'test-org', logoUrl: null },
      })

      // Staff upserted by clerkId
      expect(prisma.staff.upsert).toHaveBeenCalledWith({
        where: { clerkId: 'user_123' },
        update: expect.objectContaining({
          email: 'john@test.com',
          name: 'John Doe',
          role: 'ADMIN',
          organizationId: 'db_org_1',
          isActive: true,
        }),
        create: expect.objectContaining({
          clerkId: 'user_123',
          email: 'john@test.com',
          role: 'ADMIN',
        }),
      })
    })

    it('links existing staff found by email', async () => {
      vi.mocked(prisma.organization.upsert).mockResolvedValueOnce({ id: 'db_org_1' } as never)
      vi.mocked(prisma.staff.findUnique).mockResolvedValueOnce({
        id: 'existing_staff', email: 'john@test.com',
      } as never)
      vi.mocked(prisma.staff.update).mockResolvedValueOnce({} as never)

      await handleClerkWebhook(makeEvent('organizationMembership.created', membershipData))

      // Should update existing record, not upsert
      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'existing_staff' },
        data: expect.objectContaining({
          clerkId: 'user_123',
          role: 'ADMIN',
          organizationId: 'db_org_1',
          isActive: true,
        }),
      })
      expect(prisma.staff.upsert).not.toHaveBeenCalled()
    })

    it('maps org:member role to STAFF', async () => {
      vi.mocked(prisma.organization.upsert).mockResolvedValueOnce({ id: 'db_org_1' } as never)
      vi.mocked(prisma.staff.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.staff.upsert).mockResolvedValueOnce({} as never)

      await handleClerkWebhook(makeEvent('organizationMembership.created', {
        ...membershipData,
        role: 'org:member',
      }))

      expect(prisma.staff.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ role: 'STAFF' }),
          create: expect.objectContaining({ role: 'STAFF' }),
        })
      )
    })

    it('skips when missing required fields', async () => {
      await handleClerkWebhook(makeEvent('organizationMembership.created', {
        id: 'mem_1',
        role: 'org:admin',
        organization: { id: null },
        public_user_data: { user_id: null },
      }))

      expect(prisma.organization.upsert).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // organizationMembership.updated
  // ============================================
  describe('organizationMembership.updated', () => {
    it('updates staff role', async () => {
      vi.mocked(prisma.staff.updateMany).mockResolvedValueOnce({ count: 1 })

      await handleClerkWebhook(makeEvent('organizationMembership.updated', {
        id: 'mem_1',
        role: 'org:member',
        public_user_data: { user_id: 'user_123' },
      }))

      expect(prisma.staff.updateMany).toHaveBeenCalledWith({
        where: { clerkId: 'user_123' },
        data: { role: 'STAFF' },
      })
    })

    it('maps org:admin to ADMIN role', async () => {
      vi.mocked(prisma.staff.updateMany).mockResolvedValueOnce({ count: 1 })

      await handleClerkWebhook(makeEvent('organizationMembership.updated', {
        id: 'mem_1',
        role: 'org:admin',
        public_user_data: { user_id: 'user_456' },
      }))

      expect(prisma.staff.updateMany).toHaveBeenCalledWith({
        where: { clerkId: 'user_456' },
        data: { role: 'ADMIN' },
      })
    })

    it('skips when missing required fields', async () => {
      await handleClerkWebhook(makeEvent('organizationMembership.updated', {
        id: 'mem_1',
        role: null,
        public_user_data: { user_id: null },
      }))

      expect(prisma.staff.updateMany).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // organizationMembership.deleted
  // ============================================
  describe('organizationMembership.deleted', () => {
    it('deactivates staff scoped to organization', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({ id: 'db_org_1' } as never)
      vi.mocked(prisma.staff.updateMany).mockResolvedValueOnce({ count: 1 })

      await handleClerkWebhook(makeEvent('organizationMembership.deleted', {
        id: 'mem_1',
        role: 'org:member',
        organization: { id: 'org_abc' },
        public_user_data: { user_id: 'user_123' },
      }))

      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { clerkOrgId: 'org_abc' },
      })

      expect(prisma.staff.updateMany).toHaveBeenCalledWith({
        where: { clerkId: 'user_123', organizationId: 'db_org_1' },
        data: { isActive: false, deactivatedAt: expect.any(Date) },
      })
    })

    it('skips deactivation when org not found in DB', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce(null)

      await handleClerkWebhook(makeEvent('organizationMembership.deleted', {
        id: 'mem_1',
        role: 'org:member',
        organization: { id: 'org_unknown' },
        public_user_data: { user_id: 'user_123' },
      }))

      expect(prisma.staff.updateMany).not.toHaveBeenCalled()
    })

    it('skips when missing required fields', async () => {
      await handleClerkWebhook(makeEvent('organizationMembership.deleted', {
        id: 'mem_1',
        organization: { id: null },
        public_user_data: { user_id: null },
      }))

      expect(prisma.organization.findUnique).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // Unhandled events
  // ============================================
  describe('unhandled events', () => {
    it('ignores unknown event types without error', async () => {
      await expect(
        handleClerkWebhook(makeEvent('session.created', { id: 's1' }))
      ).resolves.toBeUndefined()
    })
  })

  // ============================================
  // Error propagation
  // ============================================
  describe('error handling', () => {
    it('re-throws handler errors for Clerk retry', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(null)
      vi.mocked(prisma.staff.updateMany).mockRejectedValueOnce(new Error('DB connection failed'))

      await expect(
        handleClerkWebhook(makeEvent('user.updated', {
          id: 'user_123',
          email_addresses: [{ email_address: 'a@b.com', id: 'e1' }],
          first_name: 'A',
          last_name: 'B',
          image_url: '',
        }))
      ).rejects.toThrow('DB connection failed')
    })
  })
})
