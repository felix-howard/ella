import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { ClientFormLinkCard } from '../client-form-link-card'
import type { IntakeLinkTable } from '../intake-link-table'
import type { UploadLinkMessageSettings } from '../upload-link-message-settings'

type OrgRoleMock = {
  canManageOrganizationSettings: boolean
  canManageOwnIntakeLink: boolean
  canManageAnyIntakeLink: boolean
  staffId: string | null
}

function createOrgRole(overrides: Partial<OrgRoleMock> = {}): OrgRoleMock {
  return {
    canManageOrganizationSettings: true,
    canManageOwnIntakeLink: true,
    canManageAnyIntakeLink: true,
    staffId: 'staff-1',
    ...overrides,
  }
}

const mocks = vi.hoisted(() => ({
  uploadSettingsProps: [] as Array<ComponentProps<typeof UploadLinkMessageSettings>>,
  intakeTableProps: [] as Array<ComponentProps<typeof IntakeLinkTable>>,
  queryOptions: [] as Array<{ queryKey: string[]; enabled?: boolean }>,
  mutation: vi.fn(),
  orgRole: createOrgRole(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
  useQuery: ({ queryKey, enabled }: { queryKey: string[]; enabled?: boolean }) => {
    mocks.queryOptions.push({ queryKey, enabled })
    if (queryKey[0] === 'org-settings') {
      return {
        isLoading: false,
        data: {
          autoSendFormClientUploadLink: true,
          defaultUploadLinkTemplateId: null,
          defaultUploadLinkLanguage: 'EN',
          slug: 'ella-tax',
        },
      }
    }

    return {
      isLoading: false,
      isError: false,
      data: {
        organization: {
          id: 'org-1',
          name: 'Ella Tax',
          slug: 'ella-tax',
          autoSendUploadLink: true,
          defaultUploadLinkTemplateId: 'official-channel',
          defaultUploadLinkLanguage: 'EN',
        },
        generalLink: {
          urlPath: '/form/ella-tax',
          autoSendUploadLink: true,
          defaultUploadLinkTemplateId: null,
          defaultUploadLinkLanguage: 'EN',
        },
        staffLinks: [
          {
            id: 'staff-1',
            name: 'Self Staff',
            role: 'STAFF',
            formSlug: 'self',
            urlPath: '/form/ella-tax/self',
            useOrgUploadLinkDefaults: true,
            autoSendUploadLink: false,
            defaultUploadLinkTemplateId: null,
            defaultUploadLinkLanguage: null,
            effectiveAutoSendUploadLink: true,
            effectiveDefaultUploadLinkTemplateId: 'official-channel',
            effectiveDefaultUploadLinkLanguage: 'EN',
          },
          {
            id: 'staff-2',
            name: 'Other Staff',
            role: 'STAFF',
            formSlug: 'other',
            urlPath: '/form/ella-tax/other',
            useOrgUploadLinkDefaults: true,
            autoSendUploadLink: false,
            defaultUploadLinkTemplateId: null,
            defaultUploadLinkLanguage: null,
            effectiveAutoSendUploadLink: true,
            effectiveDefaultUploadLinkTemplateId: 'official-channel',
            effectiveDefaultUploadLinkLanguage: 'EN',
          },
        ],
      },
    }
  },
  useMutation: () => ({ mutate: mocks.mutation, isPending: false }),
}))

vi.mock('../../../hooks/use-org-role', () => ({
  useOrgRole: () => mocks.orgRole,
}))

vi.mock('../../../stores/toast-store', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../org-slug-editor', () => ({
  OrgSlugEditor: () => <div>org-slug-editor</div>,
}))

vi.mock('../intake-link-table', () => ({
  formatUploadSummary: () => 'English US / Official Channel',
  IntakeLinkTable: (props: ComponentProps<typeof IntakeLinkTable>) => {
    mocks.intakeTableProps.push(props)
    return <div>intake-link-table</div>
  },
}))

vi.mock('../intake-link-settings-modal', () => ({
  IntakeLinkSettingsModal: () => null,
}))

vi.mock('../upload-link-message-settings', () => ({
  UploadLinkMessageSettings: (props: ComponentProps<typeof UploadLinkMessageSettings>) => {
    mocks.uploadSettingsProps.push(props)
    return <div>upload-link-message-settings</div>
  },
}))

describe('ClientFormLinkCard', () => {
  beforeEach(() => {
    mocks.uploadSettingsProps = []
    mocks.intakeTableProps = []
    mocks.queryOptions = []
    mocks.mutation.mockClear()
    mocks.orgRole = createOrgRole()
  })

  it('lets org default upload-link templates stay unset', () => {
    renderToStaticMarkup(<ClientFormLinkCard />)

    expect(mocks.uploadSettingsProps[0]).toMatchObject({
      allowDefaultTemplate: true,
      templateId: null,
    })
  })

  it('shows only the current staff row in personal self-service mode', () => {
    mocks.orgRole = createOrgRole({
      canManageOrganizationSettings: false,
      canManageAnyIntakeLink: false,
    })

    const markup = renderToStaticMarkup(<ClientFormLinkCard />)

    expect(markup).toContain('settings.yourPersonalIntakeLink')
    expect(markup).not.toContain('upload-link-message-settings')
    expect(mocks.intakeTableProps[0]).toMatchObject({
      includeGeneralLink: false,
      canEditStaffLinks: true,
      missingOrgSlugLabelKey: 'settings.organizationUrlSlugMissingAskAdmin',
    })
    expect(mocks.intakeTableProps[0].staffLinks.map((staff: { id: string }) => staff.id)).toEqual(['staff-1'])
    expect(mocks.queryOptions).toContainEqual({
      queryKey: ['org-intake-links'],
      enabled: true,
    })
  })

  it('does not enable intake-link loading without admin or own-staff capability', () => {
    mocks.orgRole = createOrgRole({
      canManageOrganizationSettings: false,
      canManageOwnIntakeLink: false,
      canManageAnyIntakeLink: false,
      staffId: null,
    })

    renderToStaticMarkup(<ClientFormLinkCard />)

    expect(mocks.queryOptions).toContainEqual({
      queryKey: ['org-intake-links'],
      enabled: false,
    })
    expect(mocks.intakeTableProps).toHaveLength(0)
  })

  it('keeps all intake rows and organization defaults editable for admins', () => {
    renderToStaticMarkup(<ClientFormLinkCard />)

    expect(mocks.uploadSettingsProps[0]).toMatchObject({ disabled: false })
    expect(mocks.intakeTableProps[0]).toMatchObject({
      includeGeneralLink: true,
      canEditStaffLinks: true,
    })
    expect(mocks.intakeTableProps[0].staffLinks.map((staff: { id: string }) => staff.id)).toEqual(['staff-1', 'staff-2'])
  })
})
