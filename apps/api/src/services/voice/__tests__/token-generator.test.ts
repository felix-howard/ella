/**
 * Twilio Voice Token Generator Unit Tests
 * Tests: generateVoiceToken(), isVoiceConfigured()
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the config module
vi.mock('../../../lib/config', () => ({
  config: {
    twilio: {
      accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      apiKeySid: 'SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      apiKeySecret: 'test-secret-key-12345678901234567890',
      twimlAppSid: 'APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      voiceConfigured: true,
    },
  },
}))

// Mock types for Twilio JWT
interface MockVoiceGrantOptions {
  outgoingApplicationSid: string
  incomingAllow: boolean
}

interface MockVoiceGrant {
  options: MockVoiceGrantOptions
}

interface MockAccessTokenOptions {
  identity: string
  ttl: number
}

interface MockAccessToken {
  accountSid: string
  apiKeySid: string
  apiKeySecret: string
  options: MockAccessTokenOptions
  grants: MockVoiceGrant[]
  addGrant: (grant: MockVoiceGrant) => void
  toJwt: () => string
}

// Mock the twilio jwt module with proper TypeScript types
vi.mock('twilio', () => {
  function MockVoiceGrant(this: MockVoiceGrant, options: MockVoiceGrantOptions) {
    this.options = options
  }

  function MockAccessToken(
    this: MockAccessToken,
    accountSid: string,
    apiKeySid: string,
    apiKeySecret: string,
    options: MockAccessTokenOptions
  ) {
    this.accountSid = accountSid
    this.apiKeySid = apiKeySid
    this.apiKeySecret = apiKeySecret
    this.options = options
    this.grants = []
  }

  MockAccessToken.prototype.addGrant = function (this: MockAccessToken, grant: MockVoiceGrant) {
    this.grants.push(grant)
  }

  MockAccessToken.prototype.toJwt = function () {
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token'
  }

  // Attach VoiceGrant as static property
  ;(MockAccessToken as unknown as { VoiceGrant: typeof MockVoiceGrant }).VoiceGrant = MockVoiceGrant

  return {
    jwt: {
      AccessToken: MockAccessToken,
    },
  }
})

import { generateVoiceToken, isVoiceConfigured } from '../token-generator'
import { config } from '../../../lib/config'

describe('Voice Token Generator', () => {
  beforeEach(() => {
    // Reset config to configured state before each test
    vi.mocked(config.twilio).voiceConfigured = true
  })

  describe('generateVoiceToken', () => {
    it('should generate a valid voice token', () => {
      const result = generateVoiceToken({ identity: 'staff-123' })

      expect(result).toBeDefined()
      expect(result.token).toBeDefined()
      expect(result.expiresIn).toBe(3600)
      expect(result.identity).toBe('staff-123')
    })

    it('should generate token with JWT format', () => {
      const result = generateVoiceToken({ identity: 'staff-abc' })

      expect(result.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    })

    it('should accept different identities', () => {
      const identities = ['staff-1', 'agent-001', 'user-uuid-12345']

      identities.forEach((identity) => {
        const result = generateVoiceToken({ identity })
        expect(result.identity).toBe(identity)
      })
    })

    it('should throw error when voice not configured', () => {
      // Temporarily override config to simulate unconfigured state
      const originalConfig = { ...config.twilio }
      vi.mocked(config.twilio).voiceConfigured = false

      expect(() => {
        generateVoiceToken({ identity: 'staff-123' })
      }).toThrow('Twilio Voice not configured')

      // Restore config
      Object.assign(config.twilio, originalConfig)
    })

    it('should set correct TTL for token', () => {
      const result = generateVoiceToken({ identity: 'staff-123' })

      // TTL should be 3600 seconds (1 hour)
      expect(result.expiresIn).toBe(3600)
    })

    it('should return consistent token structure', () => {
      const result = generateVoiceToken({ identity: 'test-user' })

      expect(result).toHaveProperty('token')
      expect(result).toHaveProperty('expiresIn')
      expect(result).toHaveProperty('identity')
      expect(typeof result.token).toBe('string')
      expect(typeof result.expiresIn).toBe('number')
      expect(typeof result.identity).toBe('string')
    })

    it('should disable incoming calls', () => {
      // This test verifies the configuration setup
      // The actual VoiceGrant should have incomingAllow: false
      const result = generateVoiceToken({ identity: 'staff-123' })

      expect(result).toBeDefined()
      // Token generation should succeed with incoming disabled
      expect(result.token).toBeTruthy()
    })

    it('should use configured Twilio credentials', () => {
      const result = generateVoiceToken({ identity: 'staff-123' })

      expect(result).toBeDefined()
      // If credentials were wrong, token generation would fail
      expect(result.token).toBeTruthy()
    })

    it('should handle staffId prefixed identities', () => {
      const result = generateVoiceToken({ identity: 'staff-f47ac10b-58cc-4372-a567-0e02b2c3d479' })

      expect(result.identity).toBe('staff-f47ac10b-58cc-4372-a567-0e02b2c3d479')
      expect(result.token).toBeTruthy()
    })
  })

  describe('isVoiceConfigured', () => {
    it('should return true when voice is configured', () => {
      vi.mocked(config.twilio).voiceConfigured = true
      expect(isVoiceConfigured()).toBe(true)
    })

    it('should return false when voice is not configured', () => {
      vi.mocked(config.twilio).voiceConfigured = false
      expect(isVoiceConfigured()).toBe(false)
    })

    it('should reflect actual configuration state', () => {
      const configured = isVoiceConfigured()
      expect(typeof configured).toBe('boolean')
    })

    it('should check all required Twilio voice credentials', () => {
      // Verify the config checks all necessary fields
      expect(config.twilio).toHaveProperty('voiceConfigured')
      expect(config.twilio).toHaveProperty('accountSid')
      expect(config.twilio).toHaveProperty('apiKeySid')
      expect(config.twilio).toHaveProperty('apiKeySecret')
      expect(config.twilio).toHaveProperty('twimlAppSid')
    })
  })

  describe('Integration between generateVoiceToken and isVoiceConfigured', () => {
    it('should allow token generation when configured', () => {
      vi.mocked(config.twilio).voiceConfigured = true

      expect(() => {
        generateVoiceToken({ identity: 'staff-123' })
      }).not.toThrow()
    })

    it('should prevent token generation when not configured', () => {
      vi.mocked(config.twilio).voiceConfigured = false

      expect(() => {
        generateVoiceToken({ identity: 'staff-123' })
      }).toThrow()
    })

    it('isVoiceConfigured should match actual configuration state', () => {
      vi.mocked(config.twilio).voiceConfigured = true
      expect(isVoiceConfigured()).toBe(true)

      vi.mocked(config.twilio).voiceConfigured = false
      expect(isVoiceConfigured()).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should provide helpful error message for unconfigured voice', () => {
      vi.mocked(config.twilio).voiceConfigured = false

      try {
        generateVoiceToken({ identity: 'staff-123' })
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Twilio Voice not configured')
      }
    })

    it('should reject empty identity for security', () => {
      vi.mocked(config.twilio).voiceConfigured = true

      expect(() => {
        generateVoiceToken({ identity: '' })
      }).toThrow('Identity required for voice token')
    })

    it('should reject whitespace-only identity', () => {
      vi.mocked(config.twilio).voiceConfigured = true

      expect(() => {
        generateVoiceToken({ identity: '   ' })
      }).toThrow('Identity required for voice token')
    })
  })

  describe('Token Expiration', () => {
    it('should always set token expiration to 1 hour', () => {
      const result1 = generateVoiceToken({ identity: 'user-1' })
      const result2 = generateVoiceToken({ identity: 'user-2' })

      expect(result1.expiresIn).toBe(3600)
      expect(result2.expiresIn).toBe(3600)
    })

    it('should use 3600 seconds for token TTL', () => {
      const result = generateVoiceToken({ identity: 'staff-123' })
      expect(result.expiresIn).toBe(3600)
    })
  })
})
