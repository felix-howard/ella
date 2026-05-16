import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsProfileTab } from '../settings-profile-tab'

const mocks = vi.hoisted(() => ({
  profileFormProps: null as null | Record<string, unknown>,
  useQuery: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mocks.useQuery(options),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}))

vi.mock('../../../hooks/use-org-role', () => ({
  useOrgRole: () => ({ isAdmin: false, staffId: 'staff-1', isLoading: false }),
}))

vi.mock('../../../lib/api-client', () => ({
  api: {
    team: { getProfile: vi.fn() },
    orgSettings: { get: vi.fn() },
  },
}))

vi.mock('../../profile/avatar-uploader', () => ({
  AvatarUploader: () => <div />,
}))

vi.mock('../../profile/staff-form-link-card', () => ({
  StaffFormLinkCard: () => <div />,
}))

vi.mock('../../profile/signature-pad-card', () => ({
  SignaturePadCard: () => <div />,
}))

vi.mock('../../profile/profile-form', () => ({
  ProfileForm: (props: Record<string, unknown>) => {
    mocks.profileFormProps = props
    return <div />
  },
}))

const staff = {
  id: 'staff-1',
  name: 'Olise Mandes',
  firstName: 'Olise',
  lastName: 'Mandes',
  email: 'olise@example.com',
  role: 'MEMBER',
  isContractorAgent: true,
  avatarUrl: null,
  phoneNumber: null,
  title: null,
  notifyOnUpload: false,
  notifyOnChat: false,
  formSlug: null,
  autoSendUploadLink: false,
  defaultUploadLinkTemplateId: null,
  _count: { managedClients: 0 },
  isActive: true,
  deactivatedAt: null,
}

describe('SettingsProfileTab', () => {
  beforeEach(() => {
    mocks.profileFormProps = null
    mocks.useQuery.mockReset()
    mocks.useQuery.mockImplementation((options: { queryKey: string[] }) => {
      if (options.queryKey[0] === 'team-member-profile') {
        return { data: { staff, canEdit: true }, isLoading: false, isError: false }
      }

      return {
        data: { slug: 'ella-tax', smsLanguage: 'EN' },
        isLoading: false,
        isError: false,
      }
    })
  })

  it('allows current user to view their contractor agreement in settings profile', () => {
    renderToStaticMarkup(<SettingsProfileTab />)

    expect(mocks.profileFormProps).toMatchObject({
      staffId: 'me',
      canViewContractorAgreement: true,
    })
  })
})
