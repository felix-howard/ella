import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FirmInfoCard } from '../firm-info-card'
import { OrgSlugEditor } from '../org-slug-editor'
import { MissedCallTextBackCard } from '../settings-general-tab'

const mocks = vi.hoisted(() => ({
  canManageOrganizationSettings: false,
  orgSlug: null as string | null,
  missedCallTextBack: true,
  mutation: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@clerk/clerk-react', () => ({
  useOrganization: () => ({ organization: { reload: vi.fn() } }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
  useQuery: () => ({
    isLoading: false,
    data: {
      name: 'Ella Tax',
      slug: mocks.orgSlug,
      missedCallTextBack: mocks.missedCallTextBack,
      autoSendFormClientUploadLink: true,
      defaultUploadLinkTemplateId: null,
      defaultUploadLinkLanguage: 'EN',
      address: '10700 Richmond Ave',
      city: 'Houston',
      state: 'TX',
      zip: '77042',
      governingState: 'Texas',
      governingCounty: 'Harris',
      firmPhone: '+15551234567',
      twilioInboundNumber: '+15551234567',
      firmEmail: 'office@example.com',
      firmWebsite: 'https://example.com',
    },
  }),
  useMutation: () => ({ mutate: mocks.mutation, isPending: false }),
}))

vi.mock('../../../hooks/use-org-role', () => ({
  useOrgRole: () => ({
    canManageOrganizationSettings: mocks.canManageOrganizationSettings,
  }),
}))

vi.mock('../../agreements/use-nda-readiness', () => ({
  useInvalidateNdaReadiness: () => vi.fn(),
}))

describe('readonly organization controls', () => {
  beforeEach(() => {
    mocks.canManageOrganizationSettings = false
    mocks.orgSlug = null
    mocks.missedCallTextBack = true
    mocks.mutation.mockClear()
  })

  it('shows a readonly org slug warning for non-admins when the org slug is missing', () => {
    const markup = renderToStaticMarkup(<OrgSlugEditor />)

    expect(markup).toContain('settings.adminOnly')
    expect(markup).toContain('settings.organizationUrlSlugMissingAskAdmin')
    expect(markup).not.toContain('settings.setSlug')
  })

  it('shows firm information as readonly for non-admins', () => {
    const markup = renderToStaticMarkup(<FirmInfoCard />)

    expect(markup).toContain('settings.adminOnly')
    expect(markup).toContain('settings.firmInfoAdminOnlyDescription')
    expect(markup).toContain('Ella Tax')
    expect(markup).not.toContain('>Edit<')
  })

  it('disables missed-call text-back controls for non-admins', () => {
    const markup = renderToStaticMarkup(<MissedCallTextBackCard />)

    expect(markup).toContain('settings.adminOnly')
    expect(markup).toContain('role="switch"')
    expect(markup).toContain('disabled=""')
    expect(markup).toContain('settings.missedCallTextBackAdminOnly')
  })
})
