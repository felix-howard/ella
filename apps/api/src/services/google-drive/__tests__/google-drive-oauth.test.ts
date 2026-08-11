import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@ella/db'
import { google } from 'googleapis'
import type { GoogleDriveConfig } from '../google-drive-config'
import {
  buildGoogleDriveAuthUrl,
  createGoogleDriveOAuthState,
  getGoogleDriveAccountEmail,
  saveGoogleDriveConnection,
  verifyGoogleDriveOAuthState,
} from '../google-drive-oauth'

const tokenKeyEnv = ['GOOGLE', 'DRIVE', 'TOKEN', 'ENCRYPTION', 'KEY'].join('_')
const encryptionKey = 'c'.repeat(64)
const driveConfig: GoogleDriveConfig = {
  clientId: 'google-client',
  clientSecret: 'google-client-secret',
  redirectUri: 'https://api.example.com/oauth/google-drive/callback',
  scopes: ['https://www.googleapis.com/auth/drive'],
}

describe('Google Drive OAuth helpers', () => {
  const originalKey = process.env[tokenKeyEnv]

  beforeEach(() => {
    process.env[tokenKeyEnv] = encryptionKey
  })

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env[tokenKeyEnv]
    } else {
      process.env[tokenKeyEnv] = originalKey
    }
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('creates and verifies signed opaque OAuth state', () => {
    vi.setSystemTime(new Date('2026-08-10T00:00:00.000Z'))

    const state = createGoogleDriveOAuthState(
      { organizationId: 'org_1', staffId: 'staff_1' },
      driveConfig
    )

    const [encodedPayload] = state.split('.')
    expect(Buffer.from(encodedPayload, 'base64url').toString('utf8')).not.toContain('org_1')
    expect(Buffer.from(encodedPayload, 'base64url').toString('utf8')).not.toContain('staff_1')
    expect(verifyGoogleDriveOAuthState(state, driveConfig)).toEqual({
      organizationId: 'org_1',
      staffId: 'staff_1',
    })
    expect(() => verifyGoogleDriveOAuthState(`${state}tampered`, driveConfig)).toThrow()
    expect(() => verifyGoogleDriveOAuthState(`${state}.extra`, driveConfig)).toThrow()
    expect(() => verifyGoogleDriveOAuthState('not-json.signature', driveConfig)).toThrow()
  })

  it('builds an offline consent URL with configured scopes and state', () => {
    const url = new URL(
      buildGoogleDriveAuthUrl({ organizationId: 'org_1', staffId: 'staff_1' }, driveConfig)
    )

    expect(url.hostname).toBe('accounts.google.com')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive')
    expect(url.searchParams.get('state')).toBeTruthy()
  })

  it('preserves root folder settings through signed OAuth state', () => {
    const state = createGoogleDriveOAuthState(
      {
        organizationId: 'org_1',
        staffId: 'staff_1',
        rootFolderId: 'root_1',
        adminGroupEmail: 'admins@example.com',
      },
      driveConfig
    )

    expect(verifyGoogleDriveOAuthState(state, driveConfig)).toEqual({
      organizationId: 'org_1',
      staffId: 'staff_1',
      rootFolderId: 'root_1',
      adminGroupEmail: 'admins@example.com',
    })
  })

  it('reads the connected Google account email through the Drive about endpoint', async () => {
    const auth = { setCredentials: vi.fn() } as never
    const aboutGet = vi.fn().mockResolvedValue({
      data: { user: { emailAddress: 'firm@example.com' } },
    })
    const driveSpy = vi.spyOn(google, 'drive').mockReturnValue({
      about: { get: aboutGet },
    } as never)

    await expect(getGoogleDriveAccountEmail(auth)).resolves.toBe('firm@example.com')

    expect(driveSpy).toHaveBeenCalledWith({ version: 'v3', auth })
    expect(aboutGet).toHaveBeenCalledWith({ fields: 'user(emailAddress)' })
  })

  it('rejects a Drive account lookup without an email address', async () => {
    const aboutGet = vi.fn().mockResolvedValue({ data: { user: {} } })
    vi.spyOn(google, 'drive').mockReturnValue({
      about: { get: aboutGet },
    } as never)

    await expect(getGoogleDriveAccountEmail({} as never)).rejects.toMatchObject({
      code: 'DRIVE_AUTH_EXPIRED',
    })
  })

  it('stores encrypted refresh tokens and connection metadata', async () => {
    const upsert = vi.fn(async (args) => args)
    const db = {
      googleDriveConnection: { upsert },
    } as unknown as PrismaClient

    await saveGoogleDriveConnection(
      {
        organizationId: 'org_1',
        connectedByStaffId: 'staff_1',
        rootFolderId: 'root_1',
        rootFolderName: 'Firm Root',
        rootFolderWebUrl: 'https://drive.example/root',
        adminGroupEmail: 'admins@example.com',
        googleAccountEmail: 'firm@example.com',
        refreshToken: 'refresh-token-value',
      },
      db
    )

    const args = upsert.mock.calls[0]?.[0]
    expect(args.where).toEqual({ organizationId: 'org_1' })
    expect(args.create).toMatchObject({
      organizationId: 'org_1',
      connectedByStaffId: 'staff_1',
      rootFolderId: 'root_1',
      rootFolderName: 'Firm Root',
      rootFolderWebUrl: 'https://drive.example/root',
      adminGroupEmail: 'admins@example.com',
      googleAccountEmail: 'firm@example.com',
      status: 'CONNECTED',
      disconnectedAt: null,
    })
    expect(args.create.refreshTokenEncrypted).not.toBe('refresh-token-value')
    expect(args.update.refreshTokenEncrypted).not.toBe('refresh-token-value')
  })

  it('normalizes missing encryption config while saving a connection', async () => {
    delete process.env[tokenKeyEnv]
    vi.resetModules()
    const { saveGoogleDriveConnection: saveWithoutKey } = await import('../google-drive-oauth')
    const upsert = vi.fn()
    const db = {
      googleDriveConnection: { upsert },
    } as unknown as PrismaClient

    await expect(
      saveWithoutKey(
        {
          organizationId: 'org_1',
          connectedByStaffId: 'staff_1',
          rootFolderId: 'root_1',
          googleAccountEmail: 'firm@example.com',
          refreshToken: 'refresh-token-value',
        },
        db
      )
    ).rejects.toMatchObject({ code: 'DRIVE_NOT_CONNECTED' })
    expect(upsert).not.toHaveBeenCalled()
  })
})
