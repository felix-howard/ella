/**
 * Filename Sanitization Utility Tests
 * Tests Vietnamese diacritic removal, PascalCase conversion, and document naming
 */
import { describe, it, expect } from 'vitest'
import {
  removeDiacritics,
  toPascalCase,
  sanitizeComponent,
  generateDocumentName,
  getDisplayNameFromKey,
} from '@ella/shared'

describe('Filename Sanitizer', () => {
  describe('removeDiacritics', () => {
    it('should remove Vietnamese diacritics from common names', () => {
      expect(removeDiacritics('Nguyễn')).toBe('Nguyen')
      expect(removeDiacritics('Trần')).toBe('Tran')
      expect(removeDiacritics('Phạm')).toBe('Pham')
      expect(removeDiacritics('Lê')).toBe('Le')
      expect(removeDiacritics('Võ')).toBe('Vo')
    })

    it('should handle Vietnamese đ character', () => {
      expect(removeDiacritics('Đặng')).toBe('Dang')
      expect(removeDiacritics('đồng')).toBe('dong')
      expect(removeDiacritics('Đinh')).toBe('Dinh')
    })

    it('should handle mixed text', () => {
      expect(removeDiacritics('Nguyễn Văn A')).toBe('Nguyen Van A')
      expect(removeDiacritics('Trần Thị Đẹp')).toBe('Tran Thi Dep')
    })

    it('should preserve ASCII characters', () => {
      expect(removeDiacritics('John Smith')).toBe('John Smith')
      expect(removeDiacritics('ABC123')).toBe('ABC123')
    })

    it('should handle empty string', () => {
      expect(removeDiacritics('')).toBe('')
    })

    it('should handle complex Vietnamese vowels', () => {
      // All tones on 'a'
      expect(removeDiacritics('à á ả ã ạ')).toBe('a a a a a')
      // Circumflex vowels
      expect(removeDiacritics('ầ ấ ẩ ẫ ậ')).toBe('a a a a a')
      // Breve vowels
      expect(removeDiacritics('ằ ắ ẳ ẵ ặ')).toBe('a a a a a')
      // e with circumflex
      expect(removeDiacritics('ề ế ể ễ ệ')).toBe('e e e e e')
      // o with horn
      expect(removeDiacritics('ờ ớ ở ỡ ợ')).toBe('o o o o o')
      // u with horn
      expect(removeDiacritics('ừ ứ ử ữ ự')).toBe('u u u u u')
    })
  })

  describe('toPascalCase', () => {
    it('should convert lowercase to PascalCase', () => {
      expect(toPascalCase('google')).toBe('Google')
      expect(toPascalCase('google llc')).toBe('GoogleLlc')
    })

    it('should convert UPPERCASE to PascalCase', () => {
      expect(toPascalCase('GOOGLE LLC')).toBe('GoogleLlc')
      expect(toPascalCase('IBM')).toBe('Ibm')
    })

    it('should handle mixed case', () => {
      expect(toPascalCase('Google LLC')).toBe('GoogleLlc')
      expect(toPascalCase('iPhone')).toBe('Iphone')
    })

    it('should handle separators (space, underscore, hyphen)', () => {
      expect(toPascalCase('google-llc')).toBe('GoogleLlc')
      expect(toPascalCase('google_llc')).toBe('GoogleLlc')
      expect(toPascalCase('google llc')).toBe('GoogleLlc')
    })

    it('should handle multiple separators', () => {
      expect(toPascalCase('google  llc')).toBe('GoogleLlc')
      expect(toPascalCase('google--llc')).toBe('GoogleLlc')
    })

    it('should handle empty string', () => {
      expect(toPascalCase('')).toBe('')
    })
  })

  describe('sanitizeComponent', () => {
    it('should sanitize Vietnamese names', () => {
      expect(sanitizeComponent('Nguyễn Văn A')).toBe('NguyenVanA')
      expect(sanitizeComponent('Trần Thị Đẹp')).toBe('TranThiDep')
    })

    it('should remove special characters', () => {
      expect(sanitizeComponent('Google, LLC.')).toBe('GoogleLlc')
      expect(sanitizeComponent("ABC's Inc.")).toBe('AbcsInc')
      expect(sanitizeComponent('Test & Co.')).toBe('TestCo')
    })

    it('should enforce max length', () => {
      const longName = 'A Very Long Company Name That Exceeds Limit'
      expect(sanitizeComponent(longName, 20).length).toBeLessThanOrEqual(20)
    })

    it('should handle null/undefined', () => {
      expect(sanitizeComponent(null)).toBe('')
      expect(sanitizeComponent(undefined)).toBe('')
    })

    it('should handle empty string', () => {
      expect(sanitizeComponent('')).toBe('')
      expect(sanitizeComponent('   ')).toBe('')
    })

    it('should use default maxLength of 30', () => {
      const longName = 'A'.repeat(50)
      expect(sanitizeComponent(longName).length).toBe(30)
    })
  })

  describe('generateDocumentName', () => {
    it('should generate name with all components', () => {
      const result = generateDocumentName({
        taxYear: 2025,
        docType: 'W2',
        source: 'Google LLC',
        recipientName: 'Nguyễn Văn A',
      })
      expect(result).toBe('2025_W2_GoogleLlc_NguyenVanA')
    })

    it('should use current year when taxYear is null', () => {
      const currentYear = new Date().getFullYear()
      const result = generateDocumentName({
        taxYear: null,
        docType: 'W2',
        source: 'Google',
        recipientName: 'John',
      })
      expect(result).toContain(String(currentYear))
    })

    it('should omit source when null', () => {
      const result = generateDocumentName({
        taxYear: 2025,
        docType: 'SSN_CARD',
        source: null,
        recipientName: 'John Smith',
      })
      expect(result).toBe('2025_SSN_CARD_JohnSmith')
    })

    it('should omit source when empty', () => {
      const result = generateDocumentName({
        taxYear: 2025,
        docType: 'PASSPORT',
        source: '',
        recipientName: 'John',
      })
      expect(result).toBe('2025_PASSPORT_John')
    })

    it('should handle empty client name', () => {
      const result = generateDocumentName({
        taxYear: 2025,
        docType: 'W2',
        source: 'Google',
        recipientName: '',
      })
      expect(result).toBe('2025_W2_Google')
    })

    it('should enforce max 60 chars total', () => {
      const result = generateDocumentName({
        taxYear: 2025,
        docType: 'FORM_1099_MISC',
        source: 'A Very Long Company Name',
        recipientName: 'Nguyễn Văn Extremely Long Name',
      })
      expect(result.length).toBeLessThanOrEqual(60)
    })

    it('should handle complex tax form types', () => {
      const result = generateDocumentName({
        taxYear: 2024,
        docType: 'SCHEDULE_K1_1065',
        source: 'Partnership Inc',
        recipientName: 'John',
      })
      expect(result).toBe('2024_SCHEDULE_K1_1065_PartnershipInc_John')
    })
  })

  describe('getDisplayNameFromKey', () => {
    it('should extract filename without extension', () => {
      expect(getDisplayNameFromKey('cases/abc123/docs/2025_W2_Google_John.pdf'))
        .toBe('2025_W2_Google_John')
    })

    it('should handle different extensions', () => {
      expect(getDisplayNameFromKey('cases/abc/docs/name.jpg')).toBe('name')
      expect(getDisplayNameFromKey('cases/abc/docs/name.png')).toBe('name')
      expect(getDisplayNameFromKey('cases/abc/docs/name.jpeg')).toBe('name')
    })

    it('should handle nested paths', () => {
      expect(getDisplayNameFromKey('a/b/c/d/file.pdf')).toBe('file')
    })

    it('should handle filenames with multiple dots', () => {
      expect(getDisplayNameFromKey('path/file.backup.pdf')).toBe('file.backup')
    })

    it('should handle empty string', () => {
      expect(getDisplayNameFromKey('')).toBe('')
    })

    it('should handle path without extension', () => {
      expect(getDisplayNameFromKey('path/filename')).toBe('filename')
    })
  })

  describe('Integration: Vietnamese Document Naming', () => {
    it('should correctly process Vietnamese tax document', () => {
      const result = generateDocumentName({
        taxYear: 2025,
        docType: 'FORM_1099_NEC',
        source: 'Công ty ABC',
        recipientName: 'Nguyễn Thị Đẹp',
      })
      // Verify no special chars or diacritics
      expect(result).toMatch(/^[A-Za-z0-9_]+$/)
      expect(result).toBe('2025_FORM_1099_NEC_CongTyAbc_NguyenThiDep')
    })

    it('should handle real-world company names', () => {
      expect(sanitizeComponent('Amazon.com, Inc.')).toBe('AmazoncomInc')
      expect(sanitizeComponent('AT&T Inc.')).toBe('AttInc')
      expect(sanitizeComponent("McDonald's Corporation")).toBe('McdonaldsCorporation')
    })
  })
})
