export type GoogleDriveConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR'

export type ClientDriveFolderStatus = 'NOT_STARTED' | 'CREATING' | 'READY' | 'FAILED'

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
  corpAdminFolderId: string | null
  corpAdminFolderWebUrl: string | null
  sharedFolderId: string | null
  sharedFolderWebUrl: string | null
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
}

export interface ClientDriveStructureOptionsDto {
  ownerClientId: string
  clientGroupId: string | null
  clientName: string
  clientEmail: string | null
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
  accountManagerStaffIds: string[]
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
