import { afterEach, describe, expect, it, vi } from 'vitest'

const clientIdEnv = ['GOOGLE', 'DRIVE', 'CLIENT', 'ID'].join('_')
const clientSecretEnv = ['GOOGLE', 'DRIVE', 'CLIENT', 'SECRET'].join('_')
const redirectUriEnv = ['GOOGLE', 'DRIVE', 'REDIRECT', 'URI'].join('_')
const tokenKeyEnv = ['GOOGLE', 'DRIVE', 'TOKEN', 'ENCRYPTION', 'KEY'].join('_')

const originalEnv = {
  clientId: process.env[clientIdEnv],
  clientSecret: process.env[clientSecretEnv],
  redirectUri: process.env[redirectUriEnv],
  tokenKey: process.env[tokenKeyEnv],
}

describe('Google Drive config', () => {
  afterEach(() => {
    for (const [key, value] of [
      [clientIdEnv, originalEnv.clientId],
      [clientSecretEnv, originalEnv.clientSecret],
      [redirectUriEnv, originalEnv.redirectUri],
      [tokenKeyEnv, originalEnv.tokenKey],
    ] as const) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    vi.resetModules()
  })

  it('requires OAuth config and a valid token encryption key before use', async () => {
    process.env[clientIdEnv] = 'client-id'
    process.env[clientSecretEnv] = 'client-secret'
    process.env[redirectUriEnv] = 'https://api.example.com/oauth/google-drive/callback'
    delete process.env[tokenKeyEnv]
    vi.resetModules()

    const missingKeyModule = await import('../google-drive-config')
    expect(() => missingKeyModule.getGoogleDriveConfig()).toThrow(
      expect.objectContaining({ code: 'DRIVE_NOT_CONNECTED' })
    )

    process.env[tokenKeyEnv] = 'not-64-hex'
    vi.resetModules()

    const invalidKeyModule = await import('../google-drive-config')
    expect(() => invalidKeyModule.getGoogleDriveConfig()).toThrow(
      expect.objectContaining({ code: 'DRIVE_NOT_CONNECTED' })
    )

    process.env[tokenKeyEnv] = 'd'.repeat(64)
    vi.resetModules()

    const validModule = await import('../google-drive-config')
    expect(validModule.getGoogleDriveConfig()).toMatchObject({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://api.example.com/oauth/google-drive/callback',
    })
  })
})
