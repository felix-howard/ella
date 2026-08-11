import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'b'.repeat(64)
const ENV_NAME = 'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY'

describe('integration secrets', () => {
  const originalKey = process.env[ENV_NAME]

  beforeEach(() => {
    process.env[ENV_NAME] = KEY
    vi.resetModules()
  })

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env[ENV_NAME]
    } else {
      process.env[ENV_NAME] = originalKey
    }
  })

  it('encrypts and decrypts values without storing plaintext', async () => {
    const { decryptIntegrationSecret, encryptIntegrationSecret } =
      await import('../integration-secrets')
    const encrypted = encryptIntegrationSecret('refresh-token-value')

    expect(encrypted).not.toBe('refresh-token-value')
    expect(decryptIntegrationSecret(encrypted)).toBe('refresh-token-value')
  })

  it('does not require the key until encryption or decryption is used', async () => {
    delete process.env[ENV_NAME]
    const module = await import('../integration-secrets')

    expect(() => module.encryptIntegrationSecret('refresh-token-value')).toThrow(ENV_NAME)
  })
})
