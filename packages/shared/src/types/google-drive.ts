export type GoogleDriveConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR'

export type ClientDriveFolderStatus = 'NOT_STARTED' | 'CREATING' | 'READY' | 'FAILED'

export type ClientDriveFolderRole =
  | 'CLIENT_ROOT'
  | 'AM_WORK'
  | 'OFFICE_ADMIN_ONLY'
  | 'OFFICE_ADMIN_DOCS'
  | 'OFFICE_LLC_DOCS'
  | 'SHARED_TO_CLIENT'
  | 'SHARED_TAX_DOCS'
  | 'SHARED_PAYSTUBS'
  | 'SHARED_RECEIPTS'
  | 'SHARED_STATEMENTS'
  | 'SHARED_CASH_PLAN'
  | 'BUSINESS_ROOT'
  | 'BUSINESS_CASH_PLAN'
  | 'BUSINESS_OTHER_DOCS'

export interface GoogleDriveConnectionDto {
  id: string
  organizationId: string
  rootFolderId: string
  rootFolderName: string | null
  rootFolderWebUrl: string | null
  adminGroupEmail: string | null
  googleAccountEmail: string
  status: GoogleDriveConnectionStatus
  lastCheckedAt: string | null
  disconnectedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ClientDrivePermissionSnapshot {
  adminGroupEmail: string | null
  adminEmails: string[]
  accountManagerEmails: string[]
  clientEmail: string | null
  appliedPermissionKeys?: string[]
  sharedFolderSmsFolderId?: string | null
  sharedFolderSmsFolderWebUrl?: string
  sharedFolderSmsMessageId?: string
  sharedFolderSmsSentAt?: string
}

export interface ClientDriveInputSnapshot {
  ownerClientId: string
  clientGroupId: string | null
  folderName: string
  clientName: string
  ssnLast4: string | null
  state: string | null
  entityLabel: string
}

export interface ClientDriveFolderNodeDto {
  id: string
  clientDriveFolderId: string
  organizationId: string
  ownerClientId: string
  businessClientId: string | null
  role: ClientDriveFolderRole
  name: string
  driveFolderId: string | null
  webViewLink: string | null
  parentDriveFolderId: string | null
  createdAt: string
  updatedAt: string
}

export interface ClientDriveBusinessFolderSummary {
  businessClientId: string
  businessName: string
  folderId: string | null
  folderWebUrl: string | null
  cashPlanFolderId: string | null
  cashPlanFolderWebUrl: string | null
  otherDocsFolderId: string | null
  otherDocsFolderWebUrl: string | null
}

export interface ClientDriveFolderDto {
  id: string
  organizationId: string
  ownerClientId: string
  clientGroupId: string | null
  folderName: string
  rootFolderId: string | null
  rootFolderWebUrl: string | null
  amWorkFolderId: string | null
  amWorkFolderWebUrl: string | null
  officeAdminFolderId: string | null
  officeAdminFolderWebUrl: string | null
  sharedFolderId: string | null
  sharedFolderWebUrl: string | null
  folderNodes?: ClientDriveFolderNodeDto[]
  businessFolders?: ClientDriveBusinessFolderSummary[]
  status: ClientDriveFolderStatus
  inputSnapshot: ClientDriveInputSnapshot
  permissionSnapshot: ClientDrivePermissionSnapshot
  lastErrorCode: string | null
  lastErrorMessage: string | null
  createdByStaffId: string | null
  createdAt: string
  updatedAt: string
}

export type ClientDriveBusinessMode = 'MULTI' | 'SINGLE_BUSINESS'

export interface ClientDriveStaffOption {
  id: string
  name: string
  email: string
  driveEmails: string[]
}

export interface ClientDriveStructureOptionsDto {
  ownerClientId: string
  clientGroupId: string | null
  clientName: string
  clientEmail: string | null
  currentYear: number
  businessNames: string[]
  defaultBusinessMode: ClientDriveBusinessMode
  defaultBusinessName: string | null
  defaultState: string | null
  selectedAccountManagerStaffIds: string[]
  staffOptions: ClientDriveStaffOption[]
  existingFolder: ClientDriveFolderDto | null
}

export interface ClientDriveStructureCreateInput {
  ssnLast4: string
  state: string
  businessMode: ClientDriveBusinessMode
  businessName?: string
  accountManagerStaffIds?: string[]
  clientEmail: string
  sendNotificationEmail: boolean
}

export interface ClientDrivePermissionSummary {
  accountManagerEmails: string[]
  adminGroupEmail: string | null
  adminEmails: string[]
  clientEmail: string | null
}

export interface ClientDriveStructureResponseDto {
  created: boolean
  folder: ClientDriveFolderDto | null
  permissionSummary: ClientDrivePermissionSummary | null
  warnings: string[]
}
