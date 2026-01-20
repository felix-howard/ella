/**
 * TwiML Voice Response Generator Unit Tests
 * Tests: generateTwimlVoiceResponse(), generateEmptyTwimlResponse()
 */
import { describe, it, expect } from 'vitest'
import {
  generateTwimlVoiceResponse,
  generateEmptyTwimlResponse,
  type TwimlVoiceOptions,
} from '../twiml-generator'

describe('TwiML Voice Response Generator', () => {
  describe('generateEmptyTwimlResponse', () => {
    it('should generate valid empty TwiML response', () => {
      const result = generateEmptyTwimlResponse()

      expect(result).toContain('<?xml version="1.0"')
      expect(result).toContain('<Response>')
      expect(result).toContain('</Response>')
    })

    it('should return consistent empty response', () => {
      const result1 = generateEmptyTwimlResponse()
      const result2 = generateEmptyTwimlResponse()

      expect(result1).toBe(result2)
    })

    it('should be valid XML', () => {
      const result = generateEmptyTwimlResponse()

      // Basic XML structure validation
      expect(result.trim()).toMatch(/^<\?xml.*\?>/)
      expect(result).toContain('<Response>')
      expect(result).toContain('</Response>')
    })

    it('should have proper XML declaration', () => {
      const result = generateEmptyTwimlResponse()
      expect(result).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
    })
  })

  describe('generateTwimlVoiceResponse', () => {
    it('should generate basic voice response without optional fields', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: false,
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('<?xml version="1.0"')
      expect(result).toContain('<Response>')
      expect(result).toContain('<Dial')
      expect(result).toContain('+15551234567')
      expect(result).toContain('+15559876543')
      expect(result).toContain('</Response>')
    })

    it('should include callerId in Dial attributes', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: false,
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('callerId="+15559876543"')
    })

    it('should include phone number to dial', () => {
      const options: TwimlVoiceOptions = {
        to: '+14155552671',
        callerId: '+15559876543',
        record: false,
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('<Number>+14155552671</Number>')
    })

    it('should add recording when enabled', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: true,
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('record="record-from-answer-dual"')
    })

    it('should not include recording when disabled', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: false,
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).not.toContain('record=')
    })

    it('should include recording status callback when provided', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: true,
        recordingStatusCallback: 'https://example.com/webhooks/recording',
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('recordingStatusCallback="https://example.com/webhooks/recording"')
    })

    it('should include recording status callback events', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: true,
        recordingStatusCallback: 'https://example.com/webhooks/recording',
        recordingStatusCallbackEvent: ['completed', 'in-progress'],
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('recordingStatusCallbackEvent="completed in-progress"')
    })

    it('should default recording callback event to completed', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: true,
        recordingStatusCallback: 'https://example.com/webhooks/recording',
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('recordingStatusCallbackEvent="completed"')
    })

    it('should include call status callback when provided', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: false,
        statusCallback: 'https://example.com/webhooks/call-status',
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('statusCallback="https://example.com/webhooks/call-status"')
    })

    it('should include call status callback events', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: false,
        statusCallback: 'https://example.com/webhooks/call-status',
        statusCallbackEvent: ['initiated', 'completed'],
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('statusCallbackEvent="initiated completed"')
    })

    it('should default call status callback event to completed', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: false,
        statusCallback: 'https://example.com/webhooks/call-status',
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('statusCallbackEvent="completed"')
    })

    it('should include all callbacks together', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: true,
        recordingStatusCallback: 'https://example.com/webhooks/recording',
        recordingStatusCallbackEvent: ['completed'],
        statusCallback: 'https://example.com/webhooks/call-status',
        statusCallbackEvent: ['completed'],
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('recordingStatusCallback')
      expect(result).toContain('statusCallback')
      expect(result).toContain('record="record-from-answer-dual"')
    })

    it('should escape XML special characters in phone numbers', () => {
      const options: TwimlVoiceOptions = {
        to: '+1555<TEST>1234567',
        callerId: '+1555"TEST"9876543',
        record: false,
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('&lt;TEST&gt;')
      expect(result).toContain('&quot;TEST&quot;')
    })

    it('should escape XML special characters in URLs', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: true,
        recordingStatusCallback: 'https://example.com/webhook?status=<completed>&timeout=true',
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('&lt;completed&gt;')
      expect(result).toContain('&amp;')
    })

    it('should escape ampersand in callerId', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+1555&9876543',
        record: false,
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('callerId="+1555&amp;9876543"')
    })

    it('should handle apostrophes in XML attributes', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: "+1555'9876543",
        record: false,
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('&apos;')
    })

    it('should return valid XML structure', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: false,
      }

      const result = generateTwimlVoiceResponse(options)

      // Basic XML validation
      expect(result).toMatch(/^<\?xml.*\?>/)
      expect(result).toMatch(/<Response>.*<\/Response>/s)
      expect(result).toMatch(/<Dial.*>.*<\/Dial>/s)
    })

    it('should handle international phone numbers', () => {
      const options: TwimlVoiceOptions = {
        to: '+442071838750', // UK number
        callerId: '+33123456789', // France number
        record: false,
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('+442071838750')
      expect(result).toContain('+33123456789')
    })

    it('should build correct Dial element', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: false,
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toMatch(/<Dial\s+[^>]*>/)
      expect(result).toMatch(/<\/Dial>/)
    })
  })

  describe('XML Escaping', () => {
    it('should escape all five XML special characters', () => {
      const options: TwimlVoiceOptions = {
        to: '+1555&<>"\'1234567',
        callerId: '+1555&<>"\'9876543',
        record: false,
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('&amp;')
      expect(result).toContain('&lt;')
      expect(result).toContain('&gt;')
      expect(result).toContain('&quot;')
      expect(result).toContain('&apos;')
    })

    it('should preserve normal characters unchanged', () => {
      const phoneNumber = '+15551234567'
      const options: TwimlVoiceOptions = {
        to: phoneNumber,
        callerId: '+15559876543',
        record: false,
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain(phoneNumber)
    })

    it('should escape callback URLs with special characters', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: true,
        recordingStatusCallback: 'https://example.com/record?id=<123>&name="test"&extra=\'value\'',
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('&lt;123&gt;')
      expect(result).toContain('&quot;test&quot;')
      expect(result).toContain('&apos;value&apos;')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty callback event arrays', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: true,
        recordingStatusCallback: 'https://example.com/webhooks/recording',
        recordingStatusCallbackEvent: [],
      }

      const result = generateTwimlVoiceResponse(options)

      // With empty array, join returns '', but || operator falls back to 'completed'
      expect(result).toContain('recordingStatusCallbackEvent="completed"')
      expect(result).toContain('recordingStatusCallback')
    })

    it('should handle callback without event specification', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: true,
        recordingStatusCallback: 'https://example.com/webhooks/recording',
        // No recordingStatusCallbackEvent provided
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('recordingStatusCallbackEvent="completed"')
    })

    it('should handle recording with multiple callback events', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: true,
        recordingStatusCallback: 'https://example.com/webhooks/recording',
        recordingStatusCallbackEvent: ['completed', 'in-progress', 'failed'],
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('recordingStatusCallbackEvent="completed in-progress failed"')
    })

    it('should not include recording callback when recording disabled', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: false,
        recordingStatusCallback: 'https://example.com/webhooks/recording',
        recordingStatusCallbackEvent: ['completed'],
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).not.toContain('recordingStatusCallback')
      expect(result).not.toContain('recordingStatusCallbackEvent')
    })
  })

  describe('Real-World Scenarios', () => {
    it('should support outbound call without recording', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+1-800-TWILIO',
        record: false,
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('<Number>+15551234567</Number>')
      expect(result).not.toContain('record=')
    })

    it('should support recorded call with status webhooks', () => {
      const options: TwimlVoiceOptions = {
        to: '+15551234567',
        callerId: '+15559876543',
        record: true,
        recordingStatusCallback: 'https://api.example.com/recording-status',
        recordingStatusCallbackEvent: ['completed', 'in-progress'],
        statusCallback: 'https://api.example.com/call-status',
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toBeTruthy()
      expect(result).toContain('record="record-from-answer-dual"')
      expect(result).toContain('recordingStatusCallback')
      expect(result).toContain('statusCallback')
    })

    it('should support international outbound calls', () => {
      const options: TwimlVoiceOptions = {
        to: '+441234567890', // UK
        callerId: '+442071838750', // Twilio UK number
        record: true,
      }

      const result = generateTwimlVoiceResponse(options)

      expect(result).toContain('+441234567890')
      expect(result).toContain('record="record-from-answer-dual"')
    })
  })
})
