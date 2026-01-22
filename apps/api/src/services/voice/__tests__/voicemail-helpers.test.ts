/**
 * Tests for voicemail helper functions
 */
import { describe, it, expect } from 'vitest'
import {
  isValidE164Phone,
  sanitizePhone,
  sanitizeRecordingDuration,
  formatVoicemailDuration,
} from '../voicemail-helpers'

describe('Voicemail Helpers', () => {
  describe('isValidE164Phone', () => {
    it('accepts valid US phone numbers', () => {
      expect(isValidE164Phone('+14155551234')).toBe(true)
      expect(isValidE164Phone('+12025551234')).toBe(true)
    })

    it('accepts valid international phone numbers', () => {
      expect(isValidE164Phone('+441234567890')).toBe(true) // UK
      expect(isValidE164Phone('+8613800138000')).toBe(true) // China
      expect(isValidE164Phone('+84901234567')).toBe(true) // Vietnam
    })

    it('rejects phone numbers without + prefix', () => {
      expect(isValidE164Phone('14155551234')).toBe(false)
      expect(isValidE164Phone('4155551234')).toBe(false)
    })

    it('rejects phone numbers starting with +0', () => {
      expect(isValidE164Phone('+01234567890')).toBe(false)
    })

    it('rejects too short phone numbers', () => {
      expect(isValidE164Phone('+1234')).toBe(false)
      expect(isValidE164Phone('+123456789')).toBe(false) // 9 digits - too short
    })

    it('rejects too long phone numbers', () => {
      expect(isValidE164Phone('+1234567890123456')).toBe(false) // 16 digits
    })

    it('rejects empty or whitespace strings', () => {
      expect(isValidE164Phone('')).toBe(false)
      expect(isValidE164Phone(' ')).toBe(false)
      expect(isValidE164Phone('  ')).toBe(false)
    })

    it('rejects phone numbers with letters', () => {
      expect(isValidE164Phone('+1415555CALL')).toBe(false)
      expect(isValidE164Phone('+1abcdefghij')).toBe(false)
    })

    it('rejects phone numbers with special characters', () => {
      expect(isValidE164Phone('+1-415-555-1234')).toBe(false)
      expect(isValidE164Phone('+1 (415) 555-1234')).toBe(false)
      expect(isValidE164Phone('+1.415.555.1234')).toBe(false)
    })
  })

  describe('sanitizePhone', () => {
    it('passes through valid E.164 phone numbers unchanged', () => {
      expect(sanitizePhone('+14155551234')).toBe('+14155551234')
      expect(sanitizePhone('+84901234567')).toBe('+84901234567')
    })

    it('removes XSS attack vectors (script tags)', () => {
      // Script tag content stripped, only digits and + remain
      expect(sanitizePhone('+1<script>alert(1)</script>555')).toBe('+11555') // "1" from "alert(1)"
      expect(sanitizePhone('<script>evil()</script>+14155551234')).toBe('+14155551234')
    })

    it('removes HTML entities and special characters', () => {
      expect(sanitizePhone('+1&lt;415&gt;555-1234')).toBe('+14155551234')
      expect(sanitizePhone('+1 (415) 555-1234')).toBe('+14155551234')
      expect(sanitizePhone('+1-415-555-1234')).toBe('+14155551234')
    })

    it('removes letters and non-digit characters', () => {
      expect(sanitizePhone('+1ABCabc4155551234')).toBe('+14155551234')
      expect(sanitizePhone('+++++14155551234')).toBe('+14155551234')
    })

    it('truncates overly long strings to 16 characters', () => {
      // After sanitization: +123456789012345678901234567890 -> truncated to 16 chars
      expect(sanitizePhone('+123456789012345678901234567890')).toBe('+123456789012345')
    })

    it('handles empty and whitespace strings', () => {
      expect(sanitizePhone('')).toBe('')
      expect(sanitizePhone('   ')).toBe('')
      expect(sanitizePhone('  +14155551234  ')).toBe('+14155551234')
    })

    it('preserves + character as-is (Twilio provides valid format)', () => {
      // Note: sanitizePhone removes non-digits except +, doesn't reposition +
      // The function is for display safety, not format correction
      expect(sanitizePhone('1+4155551234')).toBe('1+4155551234')
      expect(sanitizePhone('++14155551234')).toBe('+14155551234')
    })
  })

  describe('sanitizeRecordingDuration', () => {
    it('parses valid duration strings', () => {
      expect(sanitizeRecordingDuration('30', 14400)).toBe(30)
      expect(sanitizeRecordingDuration('120', 14400)).toBe(120)
      expect(sanitizeRecordingDuration('0', 14400)).toBe(0)
    })

    it('clamps duration to maximum', () => {
      expect(sanitizeRecordingDuration('20000', 14400)).toBe(14400)
      expect(sanitizeRecordingDuration('99999', 120)).toBe(120)
    })

    it('returns 0 for undefined input', () => {
      expect(sanitizeRecordingDuration(undefined, 14400)).toBe(0)
    })

    it('returns 0 for empty string', () => {
      expect(sanitizeRecordingDuration('', 14400)).toBe(0)
    })

    it('returns 0 for negative values', () => {
      expect(sanitizeRecordingDuration('-10', 14400)).toBe(0)
      expect(sanitizeRecordingDuration('-1', 14400)).toBe(0)
    })

    it('returns 0 for non-numeric strings', () => {
      expect(sanitizeRecordingDuration('abc', 14400)).toBe(0)
      expect(sanitizeRecordingDuration('12abc', 14400)).toBe(12) // parseInt behavior
    })

    it('handles decimal strings by truncating', () => {
      expect(sanitizeRecordingDuration('30.5', 14400)).toBe(30)
      expect(sanitizeRecordingDuration('30.9', 14400)).toBe(30)
    })
  })

  describe('formatVoicemailDuration', () => {
    it('formats 0 seconds', () => {
      expect(formatVoicemailDuration(0)).toBe('0:00')
    })

    it('formats seconds under a minute', () => {
      expect(formatVoicemailDuration(5)).toBe('0:05')
      expect(formatVoicemailDuration(30)).toBe('0:30')
      expect(formatVoicemailDuration(59)).toBe('0:59')
    })

    it('formats exactly one minute', () => {
      expect(formatVoicemailDuration(60)).toBe('1:00')
    })

    it('formats minutes and seconds', () => {
      expect(formatVoicemailDuration(65)).toBe('1:05')
      expect(formatVoicemailDuration(90)).toBe('1:30')
      expect(formatVoicemailDuration(125)).toBe('2:05')
    })

    it('formats longer durations', () => {
      expect(formatVoicemailDuration(600)).toBe('10:00')
      expect(formatVoicemailDuration(3661)).toBe('61:01')
    })

    it('pads single-digit seconds with zero', () => {
      expect(formatVoicemailDuration(1)).toBe('0:01')
      expect(formatVoicemailDuration(61)).toBe('1:01')
      expect(formatVoicemailDuration(121)).toBe('2:01')
    })
  })
})
