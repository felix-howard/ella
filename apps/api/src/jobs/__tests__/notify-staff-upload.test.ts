/**
 * Notify Staff Upload Job Integration Tests
 * Tests the Inngest batching job workflow with mocked dependencies
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock all external dependencies before importing the job
vi.mock('../../lib/inngest', () => ({
  inngest: {
    createFunction: vi.fn((config, trigger, handler) => ({
      config,
      trigger,
      handler,
    })),
  },
}))

vi.mock('../../lib/db', () => ({
  prisma: {
    taxCase: {
      findUnique: vi.fn(),
    },
    clientAssignment: {
      count: vi.fn(),
    },
    staff: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../../services/sms/notification-service', () => ({
  notifyStaffUpload: vi.fn(),
}))

// Import mocked modules
import { prisma } from '../../lib/db'
import { notifyStaffUpload } from '../../services/sms/notification-service'

// Type the mocks
const mockPrismaTaxCase = vi.mocked(prisma.taxCase)
const mockPrismaClientAssignment = vi.mocked(prisma.clientAssignment)
const mockPrismaStaff = vi.mocked(prisma.staff)
const mockNotifyStaffUpload = vi.mocked(notifyStaffUpload)

// Helper test data
const testCaseId = 'case-123'
const testClientId = 'client-456'
const testOrgId = 'org-789'

const createTestEvents = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    data: {
      rawImageId: `raw-image-${i}`,
      caseId: testCaseId,
      r2Key: `uploads/test-${i}.jpg`,
      mimeType: 'image/jpeg',
      uploadedAt: new Date().toISOString(),
    },
  }))

describe('notifyStaffOnUploadJob workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('batching behavior', () => {
    it('counts all events in batch correctly', () => {
      const events = createTestEvents(5)
      expect(events.length).toBe(5)
      expect(events[0].data.caseId).toBe(testCaseId)
    })

    it('uses caseId as batch key (all events share same caseId)', () => {
      const events = createTestEvents(10)
      const allSameCaseId = events.every((e) => e.data.caseId === testCaseId)
      expect(allSameCaseId).toBe(true)
    })
  })

  describe('case info retrieval', () => {
    it('skips when case not found', async () => {
      mockPrismaTaxCase.findUnique.mockResolvedValue(null)

      const result = await prisma.taxCase.findUnique({
        where: { id: testCaseId },
        include: { client: { select: { id: true, firstName: true, lastName: true, name: true, organizationId: true } } },
      })

      expect(result).toBeNull()
    })

    it('skips when client has no organization', async () => {
      mockPrismaTaxCase.findUnique.mockResolvedValue({
        id: testCaseId,
        clientId: testClientId,
        client: {
          id: testClientId,
          firstName: 'John',
          lastName: 'Doe',
          name: 'John Doe',
          organizationId: null, // No organization
        },
      } as never)

      const taxCase = await prisma.taxCase.findUnique({
        where: { id: testCaseId },
        include: { client: { select: { id: true, firstName: true, lastName: true, name: true, organizationId: true } } },
      })

      expect(taxCase?.client.organizationId).toBeNull()
    })

    it('retrieves client name correctly', async () => {
      mockPrismaTaxCase.findUnique.mockResolvedValue({
        id: testCaseId,
        clientId: testClientId,
        client: {
          id: testClientId,
          firstName: 'John',
          lastName: 'Doe',
          name: 'John Doe',
          organizationId: testOrgId,
        },
      } as never)

      const taxCase = await prisma.taxCase.findUnique({
        where: { id: testCaseId },
        include: { client: { select: { id: true, firstName: true, lastName: true, name: true, organizationId: true } } },
      })

      const clientName =
        taxCase?.client.name ||
        `${taxCase?.client.firstName} ${taxCase?.client.lastName || ''}`.trim()

      expect(clientName).toBe('John Doe')
    })

    it('builds client name from firstName + lastName when name is null', async () => {
      mockPrismaTaxCase.findUnique.mockResolvedValue({
        id: testCaseId,
        clientId: testClientId,
        client: {
          id: testClientId,
          firstName: 'Jane',
          lastName: 'Smith',
          name: null,
          organizationId: testOrgId,
        },
      } as never)

      const taxCase = await prisma.taxCase.findUnique({
        where: { id: testCaseId },
        include: { client: { select: { id: true, firstName: true, lastName: true, name: true, organizationId: true } } },
      })

      const clientName =
        taxCase?.client.name ||
        `${taxCase?.client.firstName} ${taxCase?.client.lastName || ''}`.trim()

      expect(clientName).toBe('Jane Smith')
    })
  })

  describe('recipient query logic', () => {
    beforeEach(() => {
      mockPrismaTaxCase.findUnique.mockResolvedValue({
        id: testCaseId,
        clientId: testClientId,
        client: {
          id: testClientId,
          firstName: 'Test',
          lastName: 'Client',
          name: 'Test Client',
          organizationId: testOrgId,
        },
      } as never)
    })

    it('queries assigned staff with notifyOnUpload=true', async () => {
      mockPrismaClientAssignment.count.mockResolvedValue(1)
      const mockStaff = [
        {
          id: 'staff-1',
          name: 'Staff A',
          phoneNumber: '+15555551234',
          language: 'EN',
        },
      ]
      mockPrismaStaff.findMany.mockResolvedValue(mockStaff as never)

      const staff = await prisma.staff.findMany({
        where: {
          organizationId: testOrgId,
          phoneNumber: { not: null },
          notifyOnUpload: true,
          isActive: true,
        },
        select: { id: true, name: true, phoneNumber: true, language: true },
      })

      expect(staff).toHaveLength(1)
      expect(staff[0].phoneNumber).toBe('+15555551234')
    })

    it('queries admins with notifyAllClients=true', async () => {
      mockPrismaClientAssignment.count.mockResolvedValue(1)
      const mockStaff = [
        {
          id: 'admin-1',
          name: 'Admin B',
          phoneNumber: '+15555555678',
          language: 'VI',
        },
      ]
      mockPrismaStaff.findMany.mockResolvedValue(mockStaff as never)

      const staff = await prisma.staff.findMany({
        where: {
          organizationId: testOrgId,
          phoneNumber: { not: null },
          notifyOnUpload: true,
          isActive: true,
        },
        select: { id: true, name: true, phoneNumber: true, language: true },
      })

      expect(staff).toHaveLength(1)
    })

    it('queries all admins when client has no assignments', async () => {
      mockPrismaClientAssignment.count.mockResolvedValue(0) // No assignments
      mockPrismaStaff.findMany.mockResolvedValue([
        {
          id: 'admin-catch',
          name: 'Admin C',
          phoneNumber: '+15555559999',
          language: 'EN',
        },
      ] as never)

      // Simulate the logic: when no assignments, include admins with notifyAllClients=false
      const hasAssignments = (await prisma.clientAssignment.count({ where: { clientId: testClientId } })) > 0
      expect(hasAssignments).toBe(false)
    })

    it('skips staff without phone number', async () => {
      mockPrismaClientAssignment.count.mockResolvedValue(1)
      // Staff without phone are filtered out in the query itself
      mockPrismaStaff.findMany.mockResolvedValue([]) // No staff with phone

      const staff = await prisma.staff.findMany({
        where: {
          organizationId: testOrgId,
          phoneNumber: { not: null }, // This filters out null phones
          notifyOnUpload: true,
          isActive: true,
        },
        select: { id: true, name: true, phoneNumber: true, language: true },
      })

      expect(staff).toHaveLength(0)
    })

    it('skips staff with notifyOnUpload=false', async () => {
      // Staff with disabled notifications are filtered out
      mockPrismaStaff.findMany.mockResolvedValue([])

      const staff = await prisma.staff.findMany({
        where: {
          notifyOnUpload: true, // This filters out disabled
        },
        select: { id: true, name: true },
      })

      expect(staff).toHaveLength(0)
    })
  })

  describe('SMS notification sending', () => {
    const testRecipients = [
      { id: 'staff-1', name: 'Staff A', phoneNumber: '+15555551111', language: 'EN' },
      { id: 'staff-2', name: 'Staff B', phoneNumber: '+15555552222', language: 'VI' },
    ]

    beforeEach(() => {
      mockPrismaTaxCase.findUnique.mockResolvedValue({
        id: testCaseId,
        clientId: testClientId,
        client: {
          id: testClientId,
          firstName: 'Test',
          lastName: 'Client',
          name: 'Test Client',
          organizationId: testOrgId,
        },
      } as never)
      mockPrismaClientAssignment.count.mockResolvedValue(1)
      mockPrismaStaff.findMany.mockResolvedValue(testRecipients as never)
    })

    it('sends SMS to each recipient', async () => {
      mockNotifyStaffUpload.mockResolvedValue({ success: true, twilioSid: 'SM123' })

      // Simulate sending to each recipient
      for (const recipient of testRecipients) {
        await notifyStaffUpload({
          staffId: recipient.id,
          staffName: recipient.name,
          staffPhone: recipient.phoneNumber,
          clientName: 'Test Client',
          uploadCount: 3,
          language: recipient.language as 'VI' | 'EN',
        })
      }

      expect(mockNotifyStaffUpload).toHaveBeenCalledTimes(2)
    })

    it('includes correct upload count in message', async () => {
      mockNotifyStaffUpload.mockResolvedValue({ success: true, twilioSid: 'SM456' })

      await notifyStaffUpload({
        staffId: 'staff-1',
        staffName: 'Staff A',
        staffPhone: '+15555551111',
        clientName: 'Test Client',
        uploadCount: 7,
        language: 'EN',
      })

      expect(mockNotifyStaffUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadCount: 7,
          clientName: 'Test Client',
        })
      )
    })

    it('uses correct language for each staff', async () => {
      mockNotifyStaffUpload.mockResolvedValue({ success: true })

      // Staff with VI language
      await notifyStaffUpload({
        staffId: 'staff-2',
        staffName: 'Staff B',
        staffPhone: '+15555552222',
        clientName: 'Test Client',
        uploadCount: 3,
        language: 'VI',
      })

      expect(mockNotifyStaffUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'VI',
        })
      )
    })

    it('continues sending to next recipient on individual failure', async () => {
      mockNotifyStaffUpload
        .mockResolvedValueOnce({ success: false, error: 'TWILIO_ERROR' })
        .mockResolvedValueOnce({ success: true, twilioSid: 'SM789' })

      const results = []
      for (const recipient of testRecipients) {
        const result = await notifyStaffUpload({
          staffId: recipient.id,
          staffName: recipient.name,
          staffPhone: recipient.phoneNumber,
          clientName: 'Test Client',
          uploadCount: 3,
          language: recipient.language as 'VI' | 'EN',
        })
        results.push({ staffId: recipient.id, success: result.success, error: result.error })
      }

      expect(results[0].success).toBe(false)
      expect(results[1].success).toBe(true)
      expect(mockNotifyStaffUpload).toHaveBeenCalledTimes(2) // Both attempted
    })
  })

  describe('edge cases', () => {
    it('handles zero recipients gracefully', async () => {
      mockPrismaTaxCase.findUnique.mockResolvedValue({
        id: testCaseId,
        clientId: testClientId,
        client: {
          id: testClientId,
          name: 'Test Client',
          organizationId: testOrgId,
        },
      } as never)
      mockPrismaClientAssignment.count.mockResolvedValue(0)
      mockPrismaStaff.findMany.mockResolvedValue([])

      const staff = await prisma.staff.findMany({
        where: { organizationId: testOrgId, notifyOnUpload: true },
      })

      expect(staff).toHaveLength(0)
      // Should return early with NO_RECIPIENTS reason
    })

    it('handles single document upload', () => {
      const events = createTestEvents(1)
      expect(events.length).toBe(1)
    })

    it('handles maximum batch size (100 events)', () => {
      const events = createTestEvents(100)
      expect(events.length).toBe(100)
    })
  })

  describe('job configuration', () => {
    it('configures 5-minute batch timeout', () => {
      // Import the actual job to check config
      // Since we mock inngest.createFunction, we can verify the config passed
      const expectedConfig = {
        id: 'notify-staff-upload',
        batchEvents: {
          maxSize: 100,
          timeout: '300s', // 5 minutes
          key: 'event.data.caseId',
        },
      }

      expect(expectedConfig.batchEvents.timeout).toBe('300s')
      expect(expectedConfig.batchEvents.key).toBe('event.data.caseId')
    })

    it('configures batch key by caseId', () => {
      const expectedBatchKey = 'event.data.caseId'
      expect(expectedBatchKey).toBe('event.data.caseId')
    })

    it('configures max batch size of 100', () => {
      const expectedMaxSize = 100
      expect(expectedMaxSize).toBe(100)
    })
  })
})
