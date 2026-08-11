import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const prismaMocks = vi.hoisted(() => ({
  googleDriveConnection: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  staff: { findUnique: vi.fn() },
}))
const oauthMocks = vi.hoisted(() => ({
  buildGoogleDriveAuthUrl: vi.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth'),
  exchangeGoogleDriveCodeForConnection: vi.fn(),
  saveGoogleDriveConnection: vi.fn(),
}))
const clientMocks = vi.hoisted(() => ({
  createGoogleDriveClientFromRefreshToken: vi.fn(() => ({ files: {}, permissions: {} })),
  createGoogleDriveClientForConnection: vi.fn(() => ({ files: {}, permissions: {} })),
}))
const folderMocks = vi.hoisted(() => ({
  testGoogleDriveRootFolderAccess: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../../../services/google-drive/google-drive-oauth', () => oauthMocks)
vi.mock('../../../services/google-drive/google-drive-client', () => clientMocks)
vi.mock('../../../services/google-drive/google-drive-folders', () => folderMocks)
vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  getAuth: vi.fn(() => ({ userId: 'clerk_admin', orgId: 'org_clerk_1', orgRole: 'org:admin' })),
}))

import { googleDriveIntegrationsRoute } from '../google-drive'

function connectionRow() {
  return {
    id: 'conn_1',
    organizationId: 'org_1',
    rootFolderId: 'root_1',
    rootFolderName: 'Root',
    rootFolderWebUrl: 'https://drive.example/root',
    adminGroupEmail: null,
    googleAccountEmail: 'firm@test.com',
    refreshTokenEncrypted: 'encrypted',
    connectedByStaffId: 'staff_admin',
    status: 'CONNECTED',
    lastCheckedAt: null,
    disconnectedAt: null,
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    updatedAt: new Date('2026-08-10T00:00:00.000Z'),
  }
}

function buildApp() {
  const app = new Hono()
  app.route('/integrations/google-drive', googleDriveIntegrationsRoute)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMocks.staff.findUnique.mockResolvedValue({
    id: 'staff_admin',
    clerkId: 'clerk_admin',
    email: 'admin@test.com',
    name: 'Admin User',
    role: 'ADMIN',
    avatarUrl: null,
    organizationId: 'org_1',
    isActive: true,
    organization: { id: 'org_1', clerkOrgId: 'org_clerk_1' },
  })
  prismaMocks.googleDriveConnection.findUnique.mockResolvedValue(connectionRow())
  folderMocks.testGoogleDriveRootFolderAccess.mockResolvedValue({
    id: 'root_2',
    name: 'Root 2',
    webViewLink: 'https://drive.example/root-2',
  })
  oauthMocks.exchangeGoogleDriveCodeForConnection.mockResolvedValue({
    organizationId: 'org_1',
    staffId: 'staff_admin',
    rootFolderId: 'root_2',
    adminGroupEmail: 'admins@test.com',
    refreshToken: 'refresh-token',
    googleAccountEmail: 'firm@test.com',
  })
  oauthMocks.saveGoogleDriveConnection.mockResolvedValue({
    ...connectionRow(),
    rootFolderId: 'root_2',
    rootFolderName: 'Root 2',
    rootFolderWebUrl: 'https://drive.example/root-2',
    adminGroupEmail: 'admins@test.com',
  })
})

describe('Google Drive integration routes', () => {
  it('returns an ADMIN OAuth URL with root settings in state input', async () => {
    const response = await buildApp().request('/integrations/google-drive/oauth-url', {
      method: 'POST',
      body: JSON.stringify({ rootFolderId: 'root_2', adminGroupEmail: 'admins@test.com' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ url: 'https://accounts.google.com/o/oauth2/v2/auth' })
    expect(oauthMocks.buildGoogleDriveAuthUrl).toHaveBeenCalledWith({
      organizationId: 'org_1',
      staffId: 'staff_admin',
      rootFolderId: 'root_2',
      adminGroupEmail: 'admins@test.com',
    })
  })

  it('accepts OAuth callback through signed state without route auth middleware', async () => {
    const response = await buildApp().request('/integrations/google-drive/callback?code=abc&state=state')

    expect(response.status).toBe(200)
    expect(oauthMocks.saveGoogleDriveConnection).toHaveBeenCalledWith({
      organizationId: 'org_1',
      connectedByStaffId: 'staff_admin',
      rootFolderId: 'root_2',
      rootFolderName: 'Root 2',
      rootFolderWebUrl: 'https://drive.example/root-2',
      adminGroupEmail: 'admins@test.com',
      googleAccountEmail: 'firm@test.com',
      refreshToken: 'refresh-token',
    })
  })
})
