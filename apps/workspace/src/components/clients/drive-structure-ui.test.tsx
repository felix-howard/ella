import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { DriveStructureModal } from './drive-structure-modal'
import { DriveStructureStatus } from './drive-structure-status'

const options = {
  ownerClientId: 'owner_1',
  clientGroupId: null,
  clientName: 'Ada Lovelace',
  clientEmail: 'ada@example.com',
  currentYear: 2026,
  businessNames: ['Analytical Engines LLC'],
  defaultBusinessMode: 'MULTI' as const,
  defaultBusinessName: null,
  defaultState: 'tx',
  selectedAccountManagerStaffIds: ['staff_1'],
  staffOptions: [{ id: 'staff_1', name: 'Grace Hopper', email: 'grace@example.com', driveEmails: [] }],
  existingFolder: null,
}
type DriveOptionsFixture = Omit<typeof options, 'clientEmail'> & { clientEmail: string | null }
let currentOptions: DriveOptionsFixture = options

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: currentOptions, isLoading: false, isError: false }) }))

describe('Drive structure workspace UI', () => {
  it('hydrates modal defaults and previews the managed Drive structure', () => {
    currentOptions = options
    const markup = renderToStaticMarkup(
      <DriveStructureModal open clientId="client_1" isPending={false} onClose={vi.fn()} onSubmit={vi.fn()} />
    )

    expect(markup).toContain('value="tx"')
    expect(markup).toContain('ada@example.com')
    expect(markup).toContain('googleDrive.clientEmailSaved')
    expect(markup).not.toContain('type="email"')
    expect(markup).not.toContain('Grace Hopper')
    expect(markup).not.toContain('googleDrive.accountManagers')
    expect(markup).toContain('Analytical Engines LLC')
    expect(markup).toContain('googleDrive.folderTreeShared')
    expect(markup).toContain('googleDrive.folderTreeTaxDocs')
    expect(markup).toContain('googleDrive.folderTreeCashPlan')
    expect(markup).toContain('googleDrive.folderTreeAdminDocs')
    expect(markup).toContain('googleDrive.folderTreeLlcDocs')
    expect(markup).toContain('googleDrive.permissionAdmins')
    expect(markup).toContain('googleDrive.permissionManagers')
    expect(markup).toContain('checked=""')
    expect(markup).toContain('disabled=""')
  })

  it('disables creation when Drive is not connected and replaces the CTA with links when ready', () => {
    const disconnected = renderToStaticMarkup(
      <DriveStructureStatus folder={null} isLoading={false} isError={false} onCreate={vi.fn()} canManageClients isConnected={false} isAdmin />
    )
    const ready = renderToStaticMarkup(
      <DriveStructureStatus folder={{
        id: 'folder_1', organizationId: 'org_1', ownerClientId: 'owner_1', clientGroupId: null, folderName: 'Ada 1234-TX-Multi',
        rootFolderId: 'root_1', rootFolderWebUrl: 'https://drive.example/root', amWorkFolderId: 'am_1', amWorkFolderWebUrl: 'https://drive.example/am',
        officeAdminFolderId: 'admin_1', officeAdminFolderWebUrl: 'https://drive.example/admin', sharedFolderId: 'shared_1', sharedFolderWebUrl: 'https://drive.example/shared',
        status: 'READY', inputSnapshot: { ownerClientId: 'owner_1', clientGroupId: null, folderName: 'Ada 1234-TX-Multi', clientName: 'Ada Lovelace', ssnLast4: '1234', state: 'TX', entityLabel: 'Multi' },
        permissionSnapshot: { adminGroupEmail: null, adminEmails: [], accountManagerEmails: [], clientEmail: 'ada@example.com' }, lastErrorCode: null, lastErrorMessage: null, createdByStaffId: 'staff_1', createdAt: '', updatedAt: '',
      }} isLoading={false} isError={false} onCreate={vi.fn()} canManageClients isConnected isAdmin />
    )

    expect(disconnected).toContain('disabled=""')
    expect(disconnected).toContain('googleDrive.configureInSettings')
    expect(ready).toContain('https://drive.example/shared')
    expect(ready).toContain('googleDrive.open.officeAdmin')
    expect(ready).not.toContain('googleDrive.createStructure')
  })

  it('blocks submission without a client email', () => {
    currentOptions = { ...options, clientEmail: null }
    const markup = renderToStaticMarkup(
      <DriveStructureModal open clientId="client_1" isPending={false} onClose={vi.fn()} onSubmit={vi.fn()} onAddClientEmail={vi.fn()} />
    )

    expect(markup).toContain('googleDrive.clientEmailMissing')
    expect(markup).toContain('googleDrive.clientEmailMissingHelp')
    expect(markup).toContain('googleDrive.addClientEmail')
    expect(markup).not.toContain('type="email"')
    expect(markup).toContain('googleDrive.permissionClientMissing')
    expect(markup).toContain('disabled=""')
    currentOptions = options
  })

  it('keeps manager creation available and models creating and failed states', () => {
    const available = renderToStaticMarkup(
      <DriveStructureStatus folder={null} isLoading={false} isError={false} onCreate={vi.fn()} canManageClients isConnected isAdmin={false} />
    )
    const creating = renderToStaticMarkup(
      <DriveStructureStatus folder={{ ...folderFixture(), status: 'CREATING' }} isLoading={false} isError={false} onCreate={vi.fn()} canManageClients isConnected isAdmin={false} />
    )
    const failed = renderToStaticMarkup(
      <DriveStructureStatus folder={{ ...folderFixture(), status: 'FAILED' }} isLoading={false} isError={false} onCreate={vi.fn()} canManageClients isConnected isAdmin={false} />
    )

    expect(available).toContain('googleDrive.createStructure')
    expect(available).not.toContain('disabled=""')
    expect(creating).toContain('googleDrive.creating')
    expect(creating).toContain('disabled=""')
    expect(failed).toContain('googleDrive.retryStructure')
  })
})

function folderFixture() {
  return {
    id: 'folder_1', organizationId: 'org_1', ownerClientId: 'owner_1', clientGroupId: null, folderName: 'Ada 1234-TX-Multi',
    rootFolderId: 'root_1', rootFolderWebUrl: 'https://drive.example/root', amWorkFolderId: 'am_1', amWorkFolderWebUrl: 'https://drive.example/am',
    officeAdminFolderId: 'admin_1', officeAdminFolderWebUrl: 'https://drive.example/admin', sharedFolderId: 'shared_1', sharedFolderWebUrl: 'https://drive.example/shared',
    status: 'READY' as const, inputSnapshot: { ownerClientId: 'owner_1', clientGroupId: null, folderName: 'Ada 1234-TX-Multi', clientName: 'Ada Lovelace', ssnLast4: '1234', state: 'TX', entityLabel: 'Multi' },
    permissionSnapshot: { adminGroupEmail: null, adminEmails: [], accountManagerEmails: [], clientEmail: 'ada@example.com' }, lastErrorCode: null, lastErrorMessage: null, createdByStaffId: 'staff_1', createdAt: '', updatedAt: '',
  }
}
