import { describe, expect, it } from 'vitest'
import { deriveOrgRoleCapabilities } from './use-org-role'

type StaffMe = NonNullable<Parameters<typeof deriveOrgRoleCapabilities>[0]>

function staff(overrides: Partial<StaffMe> = {}): StaffMe {
  return {
    id: 'staff-1',
    name: 'Ada Admin',
    email: 'ada@example.com',
    role: 'STAFF',
    language: 'EN',
    orgRole: null,
    avatarUrl: null,
    formSlug: null,
    autoSendUploadLink: false,
    defaultUploadLinkTemplateId: null,
    useOrgUploadLinkDefaults: true,
    defaultUploadLinkLanguage: null,
    ...overrides,
  }
}

describe('deriveOrgRoleCapabilities', () => {
  it('gives admins organization and all-staff intake management', () => {
    expect(deriveOrgRoleCapabilities(staff({ role: 'ADMIN' }))).toMatchObject({
      isAdmin: true,
      canManageClients: true,
      canManageOrganizationSettings: true,
      canManageOwnIntakeLink: true,
      canManageAnyIntakeLink: true,
      canManageTeam: true,
    })
  })

  it('treats Clerk org admins as admins even before app role catches up', () => {
    expect(deriveOrgRoleCapabilities(staff({ orgRole: 'org:admin' }))).toMatchObject({
      isAdmin: true,
      canManageOrganizationSettings: true,
      canManageAnyIntakeLink: true,
    })
  })

  it('keeps managers out of organization-wide settings while allowing client management and own intake', () => {
    expect(deriveOrgRoleCapabilities(staff({ role: 'MANAGER' }))).toMatchObject({
      isAdmin: false,
      isManager: true,
      canManageClients: true,
      canManageOrganizationSettings: false,
      canManageOwnIntakeLink: true,
      canManageAnyIntakeLink: false,
    })
  })

  it('allows staff own intake editing without broader management capabilities', () => {
    expect(deriveOrgRoleCapabilities(staff({ role: 'STAFF' }))).toMatchObject({
      canManageClients: false,
      canManageOrganizationSettings: false,
      canManageOwnIntakeLink: true,
      canManageAnyIntakeLink: false,
      canViewTeam: true,
    })
  })

  it('does not expose self-service capabilities without an active staff record', () => {
    expect(deriveOrgRoleCapabilities()).toMatchObject({
      orgRole: null,
      hasStaffRecord: false,
      canManageClients: false,
      canManageOrganizationSettings: false,
      canManageOwnIntakeLink: false,
      canManageAnyIntakeLink: false,
      canViewTeam: false,
    })
  })
})
