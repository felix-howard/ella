import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ProfileResponse, StaffFileListItem } from '../../../lib/api-client'
import { StaffInvoiceMonthList } from '../staff-invoice-month-list'
import { StaffProfileTabs } from '../staff-profile-tabs'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}))

vi.mock('../profile-form', () => ({
  ProfileForm: () => <div>profile-form</div>,
}))

vi.mock('../assigned-clients-list', () => ({
  AssignedClientsList: () => <div>assigned-clients</div>,
}))

vi.mock('../staff-form-link-card', () => ({
  StaffFormLinkCard: () => <div>form-link-card</div>,
}))

vi.mock('../staff-documents-tab', () => ({
  StaffDocumentsTab: () => <div>documents-tab</div>,
}))

vi.mock('../staff-invoices-tab', () => ({
  StaffInvoicesTab: () => <div>invoices-tab</div>,
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
    _count: { managedClients: 0 },
    isActive: true,
    deactivatedAt: null,
    ...overrides,
  }
}

function renderTabs(canArchive: boolean) {
  return renderToStaticMarkup(
    <StaffProfileTabs
      staff={staff()}
      staffId="staff-1"
      managedClients={[]}
      managedCount={0}
      canEdit
      canChangeRole={false}
      canManageTeam={canArchive}
      isOwnProfile={false}
      canArchive={canArchive}
      isArchived={false}
      onRoleChange={async () => undefined}
      isRoleChangePending={false}
      onArchive={() => undefined}
      isArchivePending={false}
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
  it('renders profile tabs and overview danger zone for archive-capable admins', () => {
    const markup = renderTabs(true)

    expect(markup).toContain('profile.tabs.overview')
    expect(markup).toContain('profile.tabs.documents')
    expect(markup).toContain('profile.tabs.invoices')
    expect(markup).toContain('profile.tabs.formLink')
    expect(markup).not.toContain('profile.tabs.admin')
    expect(markup).toContain('team.dangerZone')
    expect(markup).toContain('team.archiveMember')
  })

  it('hides overview danger zone when archive controls are not available', () => {
    expect(renderTabs(false)).not.toContain('profile.tabs.admin')
    expect(renderTabs(false)).not.toContain('team.dangerZone')
  })

  it('hides staff file tabs when viewer cannot access staff files', () => {
    const markup = renderTabs(false)

    expect(markup).not.toContain('profile.tabs.documents')
    expect(markup).not.toContain('profile.tabs.invoices')
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
