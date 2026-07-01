import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  downloadFromTwilioUrl: vi.fn(),
  getStorageStatus: vi.fn(),
  uploadFile: vi.fn(),
}))

vi.mock('../mms-media-handler', () => ({
  downloadFromTwilioUrl: mocks.downloadFromTwilioUrl,
  getExtensionFromMimeType: (mimeType: string) => mimeType === 'image/png' ? 'png' : 'jpg',
}))

vi.mock('../../storage', () => ({
  getStorageStatus: mocks.getStorageStatus,
  uploadFile: mocks.uploadFile,
  getSafeStorageReference: (key: string) => ({ objectType: key.split('/')[0], keyHash: 'hash' }),
  getSafeStorageError: (error: unknown) => ({
    message: error instanceof Error ? error.message : String(error),
  }),
}))

import { processLeadMmsMedia } from '../lead-mms-media-handler'

const incoming = {
  MessageSid: 'SM123',
  AccountSid: 'AC_test',
  From: '+15551234567',
  To: '+15550001111',
  Body: '',
  NumMedia: '1',
  MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC/Messages/MM/Media/ME',
  MediaContentType0: 'image/png',
}

describe('processLeadMmsMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStorageStatus.mockReturnValue({
      configured: true,
      bucket: 'ella-documents',
      endpoint: 'https://r2.example',
    })
    mocks.downloadFromTwilioUrl.mockResolvedValue(Buffer.from('image-bytes'))
    mocks.uploadFile.mockResolvedValue({
      key: 'lead-message-attachments/org_1/lead_1/SM123/0.png',
      url: 'https://r2.example/signed',
    })
  })

  it('downloads Twilio media and stores it under a lead-message prefix', async () => {
    const result = await processLeadMmsMedia(incoming, {
      id: 'lead_1',
      organizationId: 'org_1',
    })

    expect(result).toEqual({
      attachmentUrls: ['https://r2.example/signed'],
      attachmentR2Keys: ['lead-message-attachments/org_1/lead_1/SM123/0.png'],
      errors: [],
    })
    expect(mocks.downloadFromTwilioUrl).toHaveBeenCalledWith(incoming.MediaUrl0, 15000)
    expect(mocks.uploadFile).toHaveBeenCalledWith(
      'lead-message-attachments/org_1/lead_1/SM123/0.png',
      Buffer.from('image-bytes'),
      'image/png'
    )
  })

  it('returns a safe error and does not download when storage is not configured', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getStorageStatus.mockReturnValueOnce({
      configured: false,
      bucket: 'ella-documents',
      endpoint: null,
    })

    const result = await processLeadMmsMedia(incoming, {
      id: 'lead_1',
      organizationId: 'org_1',
    })

    expect(result.attachmentUrls).toEqual([])
    expect(result.attachmentR2Keys).toEqual([])
    expect(result.errors).toEqual(['R2 storage not configured - media cannot be persisted'])
    expect(mocks.downloadFromTwilioUrl).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
