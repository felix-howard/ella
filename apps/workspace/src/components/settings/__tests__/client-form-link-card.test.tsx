import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { ClientFormLinkCard } from '../client-form-link-card'
import type { UploadLinkMessageSettings } from '../upload-link-message-settings'

const mocks = vi.hoisted(() => ({
  uploadSettingsProps: [] as Array<ComponentProps<typeof UploadLinkMessageSettings>>,
  mutation: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
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
        staffLinks: [],
      },
    }
  },
  useMutation: () => ({ mutate: mocks.mutation, isPending: false }),
}))

vi.mock('../../../hooks/use-org-role', () => ({
  useOrgRole: () => ({ canManageClients: true }),
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
  IntakeLinkTable: () => <div>intake-link-table</div>,
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
    mocks.mutation.mockClear()
  })

  it('lets org default upload-link templates stay unset', () => {
    renderToStaticMarkup(<ClientFormLinkCard />)

    expect(mocks.uploadSettingsProps[0]).toMatchObject({
      allowDefaultTemplate: true,
      templateId: null,
    })
  })
})
