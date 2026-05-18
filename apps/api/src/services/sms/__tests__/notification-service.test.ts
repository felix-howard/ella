import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    magicLink: { findFirst: vi.fn() },
    taxCase: { findUnique: vi.fn() },
    message: { findFirst: vi.fn() },
    checklistItem: { findMany: vi.fn() },
  },
}))

vi.mock('../message-sender', () => ({
  isSmsEnabled: vi.fn(() => true),
  sendBlurryResendRequest: vi.fn().mockResolvedValue({ success: true, smsSent: true }),
  sendMissingDocsReminder: vi.fn().mockResolvedValue({ success: true, smsSent: true }),
}))

vi.mock('../twilio-client', () => ({
  sendSms: vi.fn(),
  formatPhoneToE164: vi.fn((phone: string) => phone),
  isValidPhoneNumber: vi.fn(() => true),
}))

vi.mock('../templates', () => ({
  generateStaffUploadMessage: vi.fn(),
  generateStaffChatMonitorMessage: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { notifyBlurryDocument } from '../notification-service'

describe('notification-service upload links', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses only unexpired active portal links for automated upload SMS', async () => {
    vi.mocked(prisma.taxCase.findUnique).mockResolvedValueOnce({
      id: 'case_1',
      taxYear: 2025,
      client: {
        name: 'Tuyet Nguyen',
        phone: '+14155550101',
        language: 'VI',
      },
    } as never)
    vi.mocked(prisma.magicLink.findFirst).mockResolvedValueOnce({
      token: 'active-portal-token',
    } as never)
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce(null as never)

    const result = await notifyBlurryDocument('case_1', ['W2'])

    expect(result.success).toBe(true)
    expect(prisma.magicLink.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        caseId: 'case_1',
        type: 'PORTAL',
        isActive: true,
        revokedAt: null,
        replacedById: null,
        OR: expect.arrayContaining([
          { expiresAt: null },
          { expiresAt: expect.objectContaining({ gt: expect.any(Date) }) },
        ]),
      }),
      orderBy: { createdAt: 'desc' },
      select: { token: true },
    }))
  })
})
