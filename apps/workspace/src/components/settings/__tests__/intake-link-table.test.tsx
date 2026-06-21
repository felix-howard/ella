import { renderToStaticMarkup } from 'react-dom/server'
import type * as ReactI18next from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import { IntakeLinkTable } from '../intake-link-table'
import type { IntakeLinkStaffRow } from '../../../lib/api-client'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactI18next>()

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, string>) => {
        if (key === 'settings.uploadMessageSummary') return `${options?.language} / ${options?.template}`
        if (key === 'settings.usesOrganizationDefaultSummary') return `Uses organization default: ${options?.summary}`
        if (key === 'settings.useDefaultUploadMessage') return `Backend default: ${options?.template}`
        return {
          'confirmStep.templateOfficialChannel': 'Official Channel',
          'confirmStep.templateTaxDocuments': 'Tax Documents',
          'settings.assignmentUnassigned': 'Unassigned',
          'settings.generalIntakeDescription': 'Unassigned general link.',
          'settings.generalIntakeLink': 'General Intake Link',
          'settings.intakeLinkColumnActions': 'Actions',
          'settings.intakeLinkColumnAssignment': 'Assignment',
          'settings.intakeLinkColumnName': 'Name',
          'settings.intakeLinkColumnUploadMessage': 'Upload message',
          'settings.intakeLinkColumnUrl': 'URL',
          'settings.messageLanguageEnglishUs': 'English US',
          'settings.messageLanguageVietnamese': 'Vietnamese',
          'settings.staffSlugMissing': 'Staff slug missing',
          'settings.uploadMessageOff': 'Off',
        }[key] ?? key
      },
    }),
  }
})

vi.mock('../../../stores/toast-store', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function staffRow(overrides: Partial<IntakeLinkStaffRow> = {}): IntakeLinkStaffRow {
  return {
    id: 'staff-1',
    name: 'Ada Admin',
    role: 'STAFF',
    formSlug: 'ada',
    urlPath: '/form/ella-tax/ada',
    useOrgUploadLinkDefaults: false,
    autoSendUploadLink: true,
    defaultUploadLinkTemplateId: null,
    defaultUploadLinkLanguage: null,
    effectiveAutoSendUploadLink: true,
    effectiveDefaultUploadLinkTemplateId: 'tax-documents',
    effectiveDefaultUploadLinkLanguage: 'EN',
    ...overrides,
  }
}

describe('IntakeLinkTable', () => {
  it('summarizes custom staff links from effective upload-link settings', () => {
    const markup = renderToStaticMarkup(
      <IntakeLinkTable
        orgSlug="ella-tax"
        generalUrlPath="/form/ella-tax"
        generalAutoSend
        generalLanguage="EN"
        generalTemplateId={null}
        staffLinks={[staffRow()]}
        canManageClients
        onEditStaff={() => undefined}
      />
    )

    expect(markup).toContain('English US / Tax Documents')
    expect(markup).not.toContain('English US / Official Channel')
  })

  it('summarizes inherited staff links from effective organization settings', () => {
    const markup = renderToStaticMarkup(
      <IntakeLinkTable
        orgSlug="ella-tax"
        generalUrlPath="/form/ella-tax"
        generalAutoSend
        generalLanguage="EN"
        generalTemplateId="tax-documents"
        staffLinks={[
          staffRow({
            useOrgUploadLinkDefaults: true,
            defaultUploadLinkTemplateId: null,
            effectiveDefaultUploadLinkTemplateId: 'tax-documents',
          }),
        ]}
        canManageClients
        onEditStaff={() => undefined}
      />
    )

    expect(markup).toContain('Uses organization default: English US / Tax Documents')
  })

  it('summarizes unset templates as the current backend default template', () => {
    const markup = renderToStaticMarkup(
      <IntakeLinkTable
        orgSlug="ella-tax"
        generalUrlPath="/form/ella-tax"
        generalAutoSend
        generalLanguage="EN"
        generalTemplateId={null}
        staffLinks={[]}
        canManageClients
        onEditStaff={() => undefined}
      />
    )

    expect(markup).toContain('English US / Backend default: Official Channel')
    expect(markup).not.toContain('English US / Default message')
  })
})
