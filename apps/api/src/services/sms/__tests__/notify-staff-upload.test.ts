/**
 * Staff Upload Notification Service Tests
 * Tests the notifyStaffUpload function in notification-service.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock dependencies
vi.mock('../twilio-client', () => ({
  sendSms: vi.fn(),
  formatPhoneToE164: vi.fn((phone) => phone), // Pass through for testing
  isValidPhoneNumber: vi.fn((phone) => phone?.startsWith('+')),
}))

vi.mock('../message-sender', () => ({
  isSmsEnabled: vi.fn(() => true),
}))

vi.mock('../templates', () => ({
  generateStaffUploadMessage: vi.fn(),
}))

// Import mocks
import { sendSms, formatPhoneToE164, isValidPhoneNumber } from '../twilio-client'
import { isSmsEnabled } from '../message-sender'
import { generateStaffUploadMessage } from '../templates'

// Import function under test
import { notifyStaffUpload, type NotifyStaffUploadParams } from '../notification-service'

// Type the mocks
const mockSendSms = vi.mocked(sendSms)
const mockIsSmsEnabled = vi.mocked(isSmsEnabled)
const mockGenerateMessage = vi.mocked(generateStaffUploadMessage)
const mockFormatPhone = vi.mocked(formatPhoneToE164)
const mockIsValidPhone = vi.mocked(isValidPhoneNumber)

describe('notifyStaffUpload', () => {
  const baseParams: NotifyStaffUploadParams = {
    staffId: 'staff-123',
    staffName: 'John CPA',
    staffPhone: '+15555551234',
    clientName: 'Jane Client',
    uploadCount: 3,
    language: 'EN',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsSmsEnabled.mockReturnValue(true)
    mockIsValidPhone.mockReturnValue(true)
    mockFormatPhone.mockReturnValue('+15555551234')
    mockGenerateMessage.mockReturnValue('[Ella] Jane Client uploaded 3 documents. Log in to view.')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('successful notification', () => {
    it('sends SMS and returns success with Twilio SID', async () => {
      mockSendSms.mockResolvedValue({ success: true, sid: 'SM12345abc' })

      const result = await notifyStaffUpload(baseParams)

      expect(result.success).toBe(true)
      expect(result.twilioSid).toBe('SM12345abc')
      expect(result.error).toBeUndefined()
    })

    it('generates message with correct parameters', async () => {
      mockSendSms.mockResolvedValue({ success: true, sid: 'SM123' })

      await notifyStaffUpload(baseParams)

      expect(mockGenerateMessage).toHaveBeenCalledWith({
        clientName: 'Jane Client',
        uploadCount: 3,
        language: 'EN',
      })
    })

    it('formats phone number to E.164 before sending', async () => {
      mockSendSms.mockResolvedValue({ success: true, sid: 'SM123' })

      await notifyStaffUpload(baseParams)

      expect(mockFormatPhone).toHaveBeenCalledWith('+15555551234')
    })

    it('sends SMS with formatted phone and generated message', async () => {
      mockGenerateMessage.mockReturnValue('Test message content')
      mockFormatPhone.mockReturnValue('+84909123456')
      mockSendSms.mockResolvedValue({ success: true, sid: 'SM123' })

      await notifyStaffUpload({
        ...baseParams,
        staffPhone: '0909123456',
      })

      expect(mockSendSms).toHaveBeenCalledWith({
        to: '+84909123456',
        body: 'Test message content',
      })
    })
  })

  describe('SMS disabled', () => {
    it('returns error when SMS not enabled', async () => {
      mockIsSmsEnabled.mockReturnValue(false)

      const result = await notifyStaffUpload(baseParams)

      expect(result.success).toBe(false)
      expect(result.error).toBe('SMS_NOT_ENABLED')
      expect(mockSendSms).not.toHaveBeenCalled()
    })
  })

  describe('phone validation', () => {
    it('returns error when phone number is empty', async () => {
      const result = await notifyStaffUpload({
        ...baseParams,
        staffPhone: '',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('NO_PHONE_NUMBER')
      expect(mockSendSms).not.toHaveBeenCalled()
    })

    it('returns error when phone number is invalid', async () => {
      mockFormatPhone.mockReturnValue('invalid')
      mockIsValidPhone.mockReturnValue(false)

      const result = await notifyStaffUpload({
        ...baseParams,
        staffPhone: 'invalid',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('INVALID_PHONE')
      expect(mockSendSms).not.toHaveBeenCalled()
    })
  })

  describe('Twilio failures', () => {
    it('returns error when Twilio send fails', async () => {
      mockSendSms.mockResolvedValue({ success: false, error: 'TWILIO_ERROR_21211' })

      const result = await notifyStaffUpload(baseParams)

      expect(result.success).toBe(false)
      expect(result.error).toBe('TWILIO_ERROR_21211')
      expect(result.twilioSid).toBeUndefined()
    })

    it('handles Twilio timeout error', async () => {
      mockSendSms.mockResolvedValue({ success: false, error: 'TWILIO_SEND_FAILED' })

      const result = await notifyStaffUpload(baseParams)

      expect(result.success).toBe(false)
      expect(result.error).toBe('TWILIO_SEND_FAILED')
    })
  })

  describe('language support', () => {
    it('uses Vietnamese template when language is VI', async () => {
      mockSendSms.mockResolvedValue({ success: true, sid: 'SM123' })

      await notifyStaffUpload({
        ...baseParams,
        language: 'VI',
      })

      expect(mockGenerateMessage).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'VI' })
      )
    })

    it('uses English template when language is EN', async () => {
      mockSendSms.mockResolvedValue({ success: true, sid: 'SM123' })

      await notifyStaffUpload({
        ...baseParams,
        language: 'EN',
      })

      expect(mockGenerateMessage).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'EN' })
      )
    })
  })

  describe('upload count variations', () => {
    it('handles single document upload', async () => {
      mockSendSms.mockResolvedValue({ success: true, sid: 'SM123' })

      await notifyStaffUpload({
        ...baseParams,
        uploadCount: 1,
      })

      expect(mockGenerateMessage).toHaveBeenCalledWith(
        expect.objectContaining({ uploadCount: 1 })
      )
    })

    it('handles large batch upload (100 documents)', async () => {
      mockSendSms.mockResolvedValue({ success: true, sid: 'SM123' })

      await notifyStaffUpload({
        ...baseParams,
        uploadCount: 100,
      })

      expect(mockGenerateMessage).toHaveBeenCalledWith(
        expect.objectContaining({ uploadCount: 100 })
      )
    })
  })

  describe('client name handling', () => {
    it('handles long client names', async () => {
      mockSendSms.mockResolvedValue({ success: true, sid: 'SM123' })

      await notifyStaffUpload({
        ...baseParams,
        clientName: 'This Is A Very Long Client Name That Might Exceed Normal Limits',
      })

      expect(mockGenerateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: 'This Is A Very Long Client Name That Might Exceed Normal Limits',
        })
      )
    })

    it('handles special characters in client name', async () => {
      mockSendSms.mockResolvedValue({ success: true, sid: 'SM123' })

      await notifyStaffUpload({
        ...baseParams,
        clientName: 'Nguyễn Văn A',
      })

      expect(mockGenerateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: 'Nguyễn Văn A',
        })
      )
    })
  })
})
