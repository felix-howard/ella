import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  clientDriveFolder: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  conversation: {
    upsert: vi.fn(),
    update: vi.fn(),
  },
  message: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  taxCase: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}))

const twilioMocks = vi.hoisted(() => ({
  isTwilioConfigured: vi.fn(),
  formatPhoneToE164: vi.fn((phone: string) => `+1${phone}`),
  sendSms: vi.fn(),
}))

const realtimeMocks = vi.hoisted(() => ({
  publishMessageEventFromConversation: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../twilio-client', () => twilioMocks)
vi.mock('../../realtime/message-publisher', () => realtimeMocks)

import {
  buildDriveSharedFolderMessage,
  sendDriveSharedFolderMessage,
} from '../message-sender'

describe('Drive shared folder message sender', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMocks.clientDriveFolder.findFirst.mockResolvedValue({
      status: 'READY',
      sharedFolderId: 'shared_1',
      sharedFolderWebUrl: 'https://drive.example/shared',
      permissionSnapshot: {},
    })
    prismaMocks.clientDriveFolder.updateMany.mockResolvedValue({ count: 1 })
    prismaMocks.taxCase.findFirst.mockResolvedValue({
      id: 'case_1',
      client: { phone: '5551234567' },
    })
    prismaMocks.conversation.upsert.mockResolvedValue({ id: 'conversation_1' })
    prismaMocks.message.findFirst.mockResolvedValue(null)
    prismaMocks.message.create.mockResolvedValue({ id: 'message_1' })
    prismaMocks.conversation.update.mockResolvedValue({})
    prismaMocks.taxCase.update.mockResolvedValue({})
    twilioMocks.isTwilioConfigured.mockReturnValue(true)
    twilioMocks.sendSms.mockResolvedValue({ success: true, sid: 'SM_1', status: 'queued' })
    realtimeMocks.publishMessageEventFromConversation.mockResolvedValue(undefined)
  })

  it('builds the fixed English shared folder message', () => {
    expect(buildDriveSharedFolderMessage('https://drive.example/shared')).toBe(
      'This is your secure Google Drive upload folder:\nhttps://drive.example/shared'
    )
  })

  it('sends through the normal message history and stores an idempotency marker', async () => {
    const result = await sendDriveSharedFolderMessage({
      organizationId: 'org_1',
      ownerClientId: 'client_1',
      clientDriveFolderId: 'drive_folder_row',
      sharedFolderId: 'shared_1',
      sharedFolderWebUrl: 'https://drive.example/shared',
      actorStaffId: 'staff_1',
    })

    const expectedBody = 'This is your secure Google Drive upload folder:\nhttps://drive.example/shared'
    expect(result).toMatchObject({
      success: true,
      skipped: false,
      smsSent: true,
      messageId: 'message_1',
    })
    expect(prismaMocks.taxCase.findFirst).toHaveBeenCalledWith({
      where: {
        clientId: 'client_1',
        client: { organizationId: 'org_1' },
      },
      orderBy: [{ taxYear: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        client: { select: { phone: true } },
      },
    })
    expect(twilioMocks.sendSms).toHaveBeenCalledWith({
      to: '+15551234567',
      body: expectedBody,
    })
    expect(prismaMocks.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conversation_1',
        channel: 'SMS',
        direction: 'OUTBOUND',
        content: expectedBody,
        sentById: 'staff_1',
        twilioSid: 'SM_1',
        twilioStatus: 'queued',
      }),
    })
    expect(prismaMocks.clientDriveFolder.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'drive_folder_row',
        organizationId: 'org_1',
        ownerClientId: 'client_1',
      },
      data: {
        permissionSnapshot: expect.objectContaining({
          sharedFolderSmsFolderId: 'shared_1',
          sharedFolderSmsFolderWebUrl: 'https://drive.example/shared',
          sharedFolderSmsMessageId: 'message_1',
          sharedFolderSmsSentAt: expect.any(String),
        }),
      },
    })
  })

  it('skips duplicate sends when the folder snapshot already has a matching marker', async () => {
    prismaMocks.clientDriveFolder.findFirst.mockResolvedValueOnce({
      status: 'READY',
      sharedFolderId: 'shared_1',
      sharedFolderWebUrl: 'https://drive.example/shared',
      permissionSnapshot: {
        sharedFolderSmsFolderId: 'shared_1',
        sharedFolderSmsFolderWebUrl: 'https://drive.example/shared',
        sharedFolderSmsMessageId: 'message_1',
        sharedFolderSmsSentAt: '2026-08-15T00:00:00.000Z',
      },
    })

    await expect(sendDriveSharedFolderMessage({
      organizationId: 'org_1',
      ownerClientId: 'client_1',
      clientDriveFolderId: 'drive_folder_row',
      sharedFolderId: 'shared_1',
      sharedFolderWebUrl: 'https://drive.example/shared',
    })).resolves.toMatchObject({
      success: true,
      skipped: true,
      skippedReason: 'ALREADY_SENT',
      messageId: 'message_1',
      smsSent: false,
    })

    expect(prismaMocks.taxCase.findFirst).not.toHaveBeenCalled()
    expect(twilioMocks.sendSms).not.toHaveBeenCalled()
    expect(prismaMocks.message.create).not.toHaveBeenCalled()
  })

  it('does not store the marker when SMS is not configured and no message record is created', async () => {
    twilioMocks.isTwilioConfigured.mockReturnValueOnce(false)

    await expect(sendDriveSharedFolderMessage({
      organizationId: 'org_1',
      ownerClientId: 'client_1',
      clientDriveFolderId: 'drive_folder_row',
      sharedFolderId: 'shared_1',
      sharedFolderWebUrl: 'https://drive.example/shared',
    })).resolves.toMatchObject({
      success: true,
      skipped: true,
      skippedReason: 'SMS_NOT_CONFIGURED',
      smsSent: false,
      error: 'SMS_NOT_CONFIGURED',
    })

    expect(prismaMocks.message.create).not.toHaveBeenCalled()
    expect(prismaMocks.clientDriveFolder.updateMany).not.toHaveBeenCalled()
  })

  it('does not store the sent marker when Twilio returns a failed send result', async () => {
    twilioMocks.sendSms.mockResolvedValueOnce({
      success: false,
      error: 'Carrier rejected message',
    })

    await expect(sendDriveSharedFolderMessage({
      organizationId: 'org_1',
      ownerClientId: 'client_1',
      clientDriveFolderId: 'drive_folder_row',
      sharedFolderId: 'shared_1',
      sharedFolderWebUrl: 'https://drive.example/shared',
    })).rejects.toThrow('Carrier rejected message')

    expect(prismaMocks.message.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        twilioSid: { not: null },
      }),
    }))
    expect(prismaMocks.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        twilioSid: null,
        twilioStatus: 'ERROR: Carrier rejected message',
      }),
    })
    expect(prismaMocks.clientDriveFolder.updateMany).not.toHaveBeenCalled()
  })
})
