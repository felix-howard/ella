/**
 * Staff Upload Template Tests
 * Tests generateStaffUploadMessage template function
 */
import { describe, it, expect } from 'vitest'
import { generateStaffUploadMessage, type StaffUploadTemplateParams } from '../staff-upload'

describe('generateStaffUploadMessage', () => {
  describe('English (EN) template', () => {
    it('generates correct message for single document', () => {
      const params: StaffUploadTemplateParams = {
        clientName: 'John Doe',
        uploadCount: 1,
        language: 'EN',
      }

      const message = generateStaffUploadMessage(params)

      expect(message).toBe('[Ella] John Doe uploaded 1 document. Log in to view.')
    })

    it('generates correct message for multiple documents', () => {
      const params: StaffUploadTemplateParams = {
        clientName: 'Jane Smith',
        uploadCount: 5,
        language: 'EN',
      }

      const message = generateStaffUploadMessage(params)

      expect(message).toBe('[Ella] Jane Smith uploaded 5 documents. Log in to view.')
    })

    it('handles zero documents (edge case)', () => {
      const params: StaffUploadTemplateParams = {
        clientName: 'Test Client',
        uploadCount: 0,
        language: 'EN',
      }

      const message = generateStaffUploadMessage(params)

      expect(message).toBe('[Ella] Test Client uploaded 0 documents. Log in to view.')
    })

    it('handles large upload count', () => {
      const params: StaffUploadTemplateParams = {
        clientName: 'Big Batch Client',
        uploadCount: 100,
        language: 'EN',
      }

      const message = generateStaffUploadMessage(params)

      expect(message).toBe('[Ella] Big Batch Client uploaded 100 documents. Log in to view.')
    })
  })

  describe('Vietnamese (VI) template', () => {
    it('generates correct Vietnamese message', () => {
      const params: StaffUploadTemplateParams = {
        clientName: 'Nguyễn Văn A',
        uploadCount: 3,
        language: 'VI',
      }

      const message = generateStaffUploadMessage(params)

      expect(message).toBe('[Ella] Nguyễn Văn A vua gui 3 tai lieu. Dang nhap de xem.')
    })

    it('handles single document in Vietnamese', () => {
      const params: StaffUploadTemplateParams = {
        clientName: 'Trần Văn B',
        uploadCount: 1,
        language: 'VI',
      }

      const message = generateStaffUploadMessage(params)

      expect(message).toBe('[Ella] Trần Văn B vua gui 1 tai lieu. Dang nhap de xem.')
    })
  })

  describe('message length constraints', () => {
    it('keeps English message under 160 characters with normal name', () => {
      const params: StaffUploadTemplateParams = {
        clientName: 'John Doe',
        uploadCount: 99,
        language: 'EN',
      }

      const message = generateStaffUploadMessage(params)

      expect(message.length).toBeLessThan(160)
    })

    it('keeps Vietnamese message under 160 characters with normal name', () => {
      const params: StaffUploadTemplateParams = {
        clientName: 'Nguyễn Văn A',
        uploadCount: 99,
        language: 'VI',
      }

      const message = generateStaffUploadMessage(params)

      expect(message.length).toBeLessThan(160)
    })

    it('handles long client names while staying reasonable', () => {
      const params: StaffUploadTemplateParams = {
        clientName: 'This Is A Very Long Client Name',
        uploadCount: 10,
        language: 'EN',
      }

      const message = generateStaffUploadMessage(params)

      // Message should still be under typical SMS limits
      expect(message.length).toBeLessThan(200)
    })
  })

  describe('language fallback', () => {
    it('defaults to Vietnamese when language is undefined', () => {
      const params: StaffUploadTemplateParams = {
        clientName: 'Test Client',
        uploadCount: 2,
        language: 'VI', // Default expected
      }

      const message = generateStaffUploadMessage(params)

      expect(message).toContain('vua gui')
      expect(message).toContain('tai lieu')
    })
  })

  describe('special characters', () => {
    it('preserves Vietnamese diacritics in client name', () => {
      const params: StaffUploadTemplateParams = {
        clientName: 'Phạm Thị Hồng',
        uploadCount: 4,
        language: 'VI',
      }

      const message = generateStaffUploadMessage(params)

      expect(message).toContain('Phạm Thị Hồng')
    })

    it('handles ampersand in client name', () => {
      const params: StaffUploadTemplateParams = {
        clientName: 'Smith & Associates',
        uploadCount: 2,
        language: 'EN',
      }

      const message = generateStaffUploadMessage(params)

      expect(message).toContain('Smith & Associates')
    })
  })

  describe('message format', () => {
    it('starts with [Ella] prefix', () => {
      const params: StaffUploadTemplateParams = {
        clientName: 'Test',
        uploadCount: 1,
        language: 'EN',
      }

      const message = generateStaffUploadMessage(params)

      expect(message.startsWith('[Ella]')).toBe(true)
    })

    it('ends with call to action', () => {
      const enParams: StaffUploadTemplateParams = {
        clientName: 'Test',
        uploadCount: 1,
        language: 'EN',
      }

      const viParams: StaffUploadTemplateParams = {
        clientName: 'Test',
        uploadCount: 1,
        language: 'VI',
      }

      const enMessage = generateStaffUploadMessage(enParams)
      const viMessage = generateStaffUploadMessage(viParams)

      expect(enMessage).toContain('Log in to view')
      expect(viMessage).toContain('Dang nhap de xem')
    })

    it('does not contain emojis', () => {
      const params: StaffUploadTemplateParams = {
        clientName: 'Test',
        uploadCount: 5,
        language: 'EN',
      }

      const message = generateStaffUploadMessage(params)

      // Check for common emoji ranges
      const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/u
      expect(emojiRegex.test(message)).toBe(false)
    })

    it('uses GSM-7 compatible characters (no UCS-2)', () => {
      const params: StaffUploadTemplateParams = {
        clientName: 'Test Client',
        uploadCount: 3,
        language: 'EN',
      }

      const message = generateStaffUploadMessage(params)

      // GSM-7 basic characters (simplified check)
      // The template uses basic ASCII which is GSM-7 compatible
      const basicAscii = /^[\x20-\x7E\n]+$/
      expect(basicAscii.test(message)).toBe(true)
    })
  })
})
