import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import type * as ReactI18next from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import type { OrgSettings, ProfileResponse, StaffFileListItem } from '../../../lib/api-client'
import { StaffInvoiceMonthList } from '../staff-invoice-month-list'
import { StaffProfileTabs } from '../staff-profile-tabs'

const mocks = vi.hoisted(() => ({
  profileFormProps: null as null | Record<string, unknown>,
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactI18next>()

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string | Record<string, unknown>) =>
        typeof fallback === 'string' ? fallback : key,
    }),
  }
})

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    search,
    to,
    ...props
  }: {
    children?: ReactNode
    search?: Record<string, string>
    to?: string
    className?: string
  }) => {
    const query = search ? `?${new URLSearchParams(search).toString()}` : ''
    return <a href={`${to ?? '#'}${query}`} {...props}>{children}</a>
  },
}))

vi.mock('../../../stores/toast-store', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../profile-form', () => ({
  ProfileForm: (props: Record<string, unknown>) => {
    mocks.profileFormProps = props
    return <div>profile-form</div>
  },
}))

vi.mock('../assigned-clients-list', () => ({
  AssignedClientsList: () => <div>assigned-clients</div>,
}))

vi.mock('../staff-documents-tab', () => ({
  StaffDocumentsTab: () => <div>documents-tab</div>,
}))

vi.mock('../staff-invoices-tab', () => ({
  StaffInvoicesTab: () => <div>invoices-tab</div>,
}))

vi.mock('../signature-pad-card', () => ({
  SignaturePadCard: () => <div>signature-card</div>,
}))

vi.mock('../staff-payment-info-card', () => ({
  StaffPaymentInfoCard: () => <div>payment-info-card</div>,
}))

function staff(overrides: Partial<ProfileResponse['staff']> = {}): ProfileResponse['staff'] {
  return {
    id: 'staff-1',
    name: 'Ada Admin',
    firstName: 'Ada',
    lastName: 'Admin',
    email: 'ada@example.com',
    role: 'STAFF',
    isContractorAgent: false,
    avatarUrl: null,
    phoneNumber: null,
    title: null,
    notifyOnUpload: false,
    notifyOnChat: false,
    notifyOnAgreementSigned: false,
    notifyOnClientPayment: false,
    formSlug: null,
    autoSendUploadLink: false,
    defaultUploadLinkTemplateId: null,
    useOrgUploadLinkDefaults: true,
    defaultUploadLinkLanguage: null,
    paymentInfos: [],
    _count: { managedClients: 0 },
    isActive: true,
    deactivatedAt: null,
    ...overrides,
  }
}

function renderTabs({
  canRemoveAccess = false,
  canEdit = true,
  isOwnProfile = false,
  canChangeRole = false,
  canManageAnyIntakeLink = canRemoveAccess,
  staffOverrides,
  orgSettings,
  isOrgSettingsLoading = false,
}: {
  canRemoveAccess?: boolean
  canEdit?: boolean
  isOwnProfile?: boolean
  canChangeRole?: boolean
  canManageAnyIntakeLink?: boolean
  staffOverrides?: Partial<ProfileResponse['staff']>
  orgSettings?: OrgSettings
  isOrgSettingsLoading?: boolean
} = {}) {
  mocks.profileFormProps = null

  return renderToStaticMarkup(
    <StaffProfileTabs
      staff={staff(staffOverrides)}
      staffId="staff-1"
      managedClients={[]}
      managedCount={0}
      canEdit={canEdit}
      canChangeRole={canChangeRole}
      canManageTeam={canRemoveAccess}
      canManageAnyIntakeLink={canManageAnyIntakeLink}
      isOwnProfile={isOwnProfile}
      canRemoveAccess={canRemoveAccess}
      orgSettings={orgSettings}
      isOrgSettingsLoading={isOrgSettingsLoading}
      onRoleChange={async () => undefined}
      isRoleChangePending={false}
      onRemoveAccess={() => undefined}
      isRemoveAccessPending={false}
    />
  )
}

function invoice(overrides: Partial<StaffFileListItem> = {}): StaffFileListItem {
  return {
    id: 'file-1',
    staffId: 'staff-1',
    uploadedByStaffId: 'staff-1',
    kind: 'INVOICE',
    title: 'June invoice',
    category: null,
    originalFilename: 'invoice.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    checksumSha256: null,
    invoiceYear: 2026,
    invoiceMonth: 6,
    invoiceStatus: 'PAID',
    replacedById: null,
    isActive: true,
    reviewedByStaffId: null,
    reviewedAt: null,
    paidAt: null,
    adminNote: null,
    deletedAt: null,
    createdAt: '2026-06-14T00:00:00.000Z',
    updatedAt: '2026-06-14T00:00:00.000Z',
    ...overrides,
  }
}

describe('StaffProfileTabs', () => {
  it('renders profile tabs and overview danger zone for remove-access-capable admins', () => {
    const markup = renderTabs({ canRemoveAccess: true })

    expect(markup).toContain('profile.tabs.overview')
    expect(markup).toContain('profile.tabs.documents')
    expect(markup).toContain('profile.tabs.invoices')
    expect(markup).not.toContain('profile.tabs.formLink')
    expect(markup).toContain('profile.personalIntakeLink')
    expect(markup).not.toContain('profile.tabs.admin')
    expect(markup).toContain('team.dangerZone')
    expect(markup).toContain('team.removeAccessMember')
    expect(markup).toContain('payment-info-card')
  })

  it('renders editable staff files and payment info for non-admin self-service profiles', () => {
    const markup = renderTabs({ canEdit: true, canRemoveAccess: false, isOwnProfile: false })

    expect(markup).toContain('profile.tabs.documents')
    expect(markup).toContain('profile.tabs.invoices')
    expect(markup).toContain('payment-info-card')
  })

  it('hides overview danger zone when archive controls are not available', () => {
    expect(renderTabs()).not.toContain('profile.tabs.admin')
    expect(renderTabs()).not.toContain('team.dangerZone')
  })

  it('hides staff file tabs when viewer cannot access staff files', () => {
    const markup = renderTabs({ canEdit: false })

    expect(markup).not.toContain('profile.tabs.documents')
    expect(markup).not.toContain('profile.tabs.invoices')
    expect(markup).not.toContain('payment-info-card')
  })

  it('renders signature setup only for the current user own profile', () => {
    expect(renderTabs({ isOwnProfile: true })).toContain('signature-card')
    expect(renderTabs({ isOwnProfile: false })).not.toContain('signature-card')
  })

  it('shows a neutral loading state while org settings are still loading', () => {
    const markup = renderTabs({
      isOrgSettingsLoading: true,
    })

    expect(markup).toContain('staff-form-link-loading')
    expect(markup).not.toContain('profile.noOrgSlug')
  })

  it('shows the full personal intake link and Settings shortcut for the current user', () => {
    const markup = renderTabs({
      canRemoveAccess: false,
      isOwnProfile: true,
      staffOverrides: { formSlug: 'ada-admin-long-staff-slug' },
      orgSettings: { slug: 'ella-tax-services' } as OrgSettings,
    })

    expect(markup).toContain('http://localhost:5173/form/ella-tax-services/ada-admin-long-staff-slug')
    expect(markup).toContain('break-all')
    expect(markup).not.toContain('truncate')
    expect(markup).toContain('/settings?tab=organization&amp;focus=client-intake')
    expect(markup).toContain('profile.manageInSettings')
  })

  it('shows setup states without the Settings shortcut when viewing another staff as non-admin', () => {
    expect(renderTabs({ orgSettings: { slug: 'ella-tax' } as OrgSettings })).toContain('profile.noFormSlug')

    const missingOrgMarkup = renderTabs({ staffOverrides: { formSlug: 'ada-admin' } })
    expect(missingOrgMarkup).toContain('profile.noOrgSlug')
    expect(missingOrgMarkup).not.toContain('profile.manageInSettings')
  })

  it('shows the Settings shortcut when an admin views another staff intake link', () => {
    const markup = renderTabs({
      canManageAnyIntakeLink: true,
      staffOverrides: { formSlug: 'ada-admin' },
      orgSettings: { slug: 'ella-tax' } as OrgSettings,
    })

    expect(markup).toContain('/settings?tab=organization&amp;focus=client-intake')
    expect(markup).toContain('profile.manageInSettings')
  })

  it('suppresses admin-only member controls for own profile', () => {
    const markup = renderTabs({ canRemoveAccess: true, canChangeRole: true, isOwnProfile: true })

    expect(markup).not.toContain('team.dangerZone')
    expect(markup).not.toContain('team.removeAccessMember')
    expect(mocks.profileFormProps).toMatchObject({
      canChangeRole: false,
      canManageContractorAgent: false,
    })
  })
})

describe('StaffInvoiceMonthList', () => {
  it('opens invoices from the display name instead of making the month row clickable', () => {
    const markup = renderToStaticMarkup(
      <StaffInvoiceMonthList
        staffId="staff-1"
        months={[
          {
            year: 2026,
            month: 6,
            active: invoice({ title: 'invoice-6', originalFilename: 'june-contractor-invoice.pdf' }),
            history: [],
            isCurrentMonth: true,
          },
        ]}
        isLoading={false}
        canDelete={() => true}
        onOpen={() => undefined}
        onOpenInNewTab={() => undefined}
        onDownload={() => undefined}
        onRename={() => undefined}
        onStartRename={() => undefined}
        onCancelRename={() => undefined}
        onDelete={() => undefined}
      />
    )

    expect(markup).toContain('type="button"')
    expect(markup).toContain('invoice-6')
    expect(markup).not.toContain('june-contractor-invoice.pdf')
    expect(markup).not.toContain('role="button"')
  })

  it('hides delete action when paid invoice cannot be deleted', () => {
    const markup = renderToStaticMarkup(
      <StaffInvoiceMonthList
        staffId="staff-1"
        months={[{ year: 2026, month: 6, active: invoice(), history: [], isCurrentMonth: true }]}
        isLoading={false}
        canDelete={() => false}
        onOpen={() => undefined}
        onOpenInNewTab={() => undefined}
        onDownload={() => undefined}
        onRename={() => undefined}
        onStartRename={() => undefined}
        onCancelRename={() => undefined}
        onDelete={() => undefined}
      />
    )

    expect(markup).not.toContain('profile.staffFiles.delete')
    expect(markup).not.toContain('profile.staffFiles.replace')
  })
})
