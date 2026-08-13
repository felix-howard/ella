import { ClientDriveFolderStatus, type Prisma, type PrismaClient } from '@ella/db'
import { prisma } from '../../lib/db'
import type {
  ClientDriveBusinessMode,
  ClientDriveFolderDto,
  ClientDriveFolderRole,
  ClientDriveInputSnapshot,
  ClientDrivePermissionSnapshot,
  ClientDriveStructureCreateInput,
  ClientDriveStructureOptionsDto,
  ClientDriveStructureResponseDto,
} from '@ella/shared'
import { createGoogleDriveClientForConnection } from './google-drive-client'
import {
  createGoogleDriveFolder,
  findGoogleDriveFolderByAppProperties,
  updateGoogleDriveFolder,
  type GoogleDriveFolderView,
} from './google-drive-folders'
import {
  grantGoogleDrivePermissionsSequentially,
  type GoogleDrivePermissionGrant,
} from './google-drive-permissions'
import { GoogleDriveServiceError, normalizeGoogleDriveError } from './google-drive-errors'
import {
  buildClientDriveFolderName,
  getClientDriveDisplayName,
  normalizeClientDriveState,
} from './client-drive-folder-name'
import { resolveClientDrivePermissionTargets } from './client-drive-permission-targets'
import {
  CLIENT_DRIVE_FOLDER_NAMES,
  CLIENT_DRIVE_FOLDER_ROLES,
  getClientDriveBusinessCashPlanFolderName,
  getClientDriveBusinessOtherDocsFolderName,
  getClientDriveSharedPaystubsFolderName,
  getClientDriveSharedReceiptsFolderName,
  getClientDriveSharedStatementsFolderName,
  getClientDriveSharedTaxDocsFolderName,
} from './client-drive-folder-tree'

const CREATING_LOCK_MS = 2 * 60 * 1000
const CORP_ADMIN_ROLE_ALIAS = 'CORP_ADMIN'

function getGoogleDriveErrorStatus(error: unknown): number | null {
  const candidate = error as {
    code?: unknown
    status?: unknown
    response?: { status?: unknown }
    cause?: unknown
  }
  const status = candidate.response?.status ?? candidate.status ?? candidate.code
  if (typeof status === 'number') return status
  if (candidate.cause && candidate.cause !== error) {
    return getGoogleDriveErrorStatus(candidate.cause)
  }
  return null
}

function isGoogleDriveNotFoundError(error: unknown): boolean {
  return getGoogleDriveErrorStatus(error) === 404
}

type ClientForDrive = {
  id: string
  firstName: string
  lastName: string | null
  name: string
  email: string | null
  clientType: string
  clientGroupId: string | null
  businessState: string | null
  managers: Array<{ staffId: string; staff: { id: string; name: string; email: string; isActive: boolean } }>
  managedBy: { id: string; name: string; email: string; isActive: boolean } | null
  clientGroup: {
    id: string
    clients: Array<{
      id: string
      firstName: string
      lastName: string | null
      name: string
      email: string | null
      clientType: string
      businessState: string | null
      managers: Array<{ staffId: string; staff: { id: string; name: string; email: string; isActive: boolean } }>
      managedBy: { id: string; name: string; email: string; isActive: boolean } | null
    }>
  } | null
}

type GroupClientForDrive = NonNullable<ClientForDrive['clientGroup']>['clients'][number]
type OwnerClientForDrive = ClientForDrive | GroupClientForDrive

type OwnerResolution = {
  requestedClient: ClientForDrive
  ownerClient: OwnerClientForDrive
  clientGroupId: string | null
  businessClients: GroupClientForDrive[]
}

interface ClientDriveStructureClaim {
  organizationId: string
  owner: OwnerResolution
  connection: NonNullable<Awaited<ReturnType<PrismaClient['googleDriveConnection']['findUnique']>>>
  row: Awaited<ReturnType<PrismaClient['clientDriveFolder']['findUniqueOrThrow']>>
  createdNewRow: boolean
  permissionTargets: Awaited<ReturnType<typeof resolveClientDrivePermissionTargets>>
  inputSnapshot: ClientDriveInputSnapshot
  permissionSnapshot: ClientDrivePermissionSnapshot
}

interface ClientDriveStructureClaimOptions {
  allowRecentCreating?: boolean
  expectedRow?: {
    id: string
    updatedAt: Date
  }
}

interface QueuedInputSnapshot {
  folderName: string
  ssnLast4: string | null
  state: string | null
  entityLabel: string
}

function assertOrganization(organizationId: string | null | undefined): string {
  if (!organizationId) {
    throw new GoogleDriveServiceError('DRIVE_NOT_CONNECTED', 'Organization required.')
  }
  return organizationId
}

function mapDriveFolderDto(row: {
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
  status: ClientDriveFolderStatus
  inputSnapshot: unknown
  permissionSnapshot: unknown
  lastErrorCode: string | null
  lastErrorMessage: string | null
  createdByStaffId: string | null
  createdAt: Date
  updatedAt: Date
  nodes?: Array<{
    id: string
    clientDriveFolderId: string
    organizationId: string
    ownerClientId: string
    businessClientId: string | null
    role: string
    name: string
    driveFolderId: string | null
    webViewLink: string | null
    parentDriveFolderId: string | null
    createdAt: Date
    updatedAt: Date
  }>
}): ClientDriveFolderDto {
  const folderNodes = row.nodes?.map((node) => ({
    id: node.id,
    clientDriveFolderId: node.clientDriveFolderId,
    organizationId: node.organizationId,
    ownerClientId: node.ownerClientId,
    businessClientId: node.businessClientId,
    role: node.role as ClientDriveFolderRole,
    name: node.name,
    driveFolderId: node.driveFolderId,
    webViewLink: node.webViewLink,
    parentDriveFolderId: node.parentDriveFolderId,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
  }))
  const businessFolders = folderNodes
    ?.filter((node) => node.role === CLIENT_DRIVE_FOLDER_ROLES.BUSINESS_ROOT && node.businessClientId)
    .map((rootNode) => {
      const cashPlanNode = folderNodes.find((node) =>
        node.businessClientId === rootNode.businessClientId &&
        node.role === CLIENT_DRIVE_FOLDER_ROLES.BUSINESS_CASH_PLAN
      )
      const otherDocsNode = folderNodes.find((node) =>
        node.businessClientId === rootNode.businessClientId &&
        node.role === CLIENT_DRIVE_FOLDER_ROLES.BUSINESS_OTHER_DOCS
      )

      return {
        businessClientId: rootNode.businessClientId ?? '',
        businessName: rootNode.name,
        folderId: rootNode.driveFolderId,
        folderWebUrl: rootNode.webViewLink,
        cashPlanFolderId: cashPlanNode?.driveFolderId ?? null,
        cashPlanFolderWebUrl: cashPlanNode?.webViewLink ?? null,
        otherDocsFolderId: otherDocsNode?.driveFolderId ?? null,
        otherDocsFolderWebUrl: otherDocsNode?.webViewLink ?? null,
      }
    })

  return {
    id: row.id,
    organizationId: row.organizationId,
    ownerClientId: row.ownerClientId,
    clientGroupId: row.clientGroupId,
    folderName: row.folderName,
    rootFolderId: row.rootFolderId,
    rootFolderWebUrl: row.rootFolderWebUrl,
    amWorkFolderId: row.amWorkFolderId,
    amWorkFolderWebUrl: row.amWorkFolderWebUrl,
    officeAdminFolderId: row.officeAdminFolderId,
    officeAdminFolderWebUrl: row.officeAdminFolderWebUrl,
    sharedFolderId: row.sharedFolderId,
    sharedFolderWebUrl: row.sharedFolderWebUrl,
    ...(folderNodes ? { folderNodes } : {}),
    ...(businessFolders ? { businessFolders } : {}),
    status: row.status,
    inputSnapshot: row.inputSnapshot as ClientDriveInputSnapshot,
    permissionSnapshot: row.permissionSnapshot as ClientDrivePermissionSnapshot,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    createdByStaffId: row.createdByStaffId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function defaultBusinessMode(owner: OwnerResolution): ClientDriveBusinessMode {
  if (owner.businessClients.length === 1) return 'SINGLE_BUSINESS'
  if (!owner.clientGroupId && owner.requestedClient.clientType === 'BUSINESS') return 'SINGLE_BUSINESS'
  return 'MULTI'
}

function defaultBusinessName(
  mode: ClientDriveBusinessMode,
  owner: OwnerResolution,
  businesses: OwnerResolution['businessClients']
): string | null {
  if (mode !== 'SINGLE_BUSINESS') return null
  if (!owner.clientGroupId && owner.requestedClient.clientType === 'BUSINESS') {
    return getClientDriveDisplayName(owner.requestedClient)
  }
  const business = businesses[0]
  return business ? getClientDriveDisplayName(business) : null
}

function selectedManagerIds(ownerClient: OwnerClientForDrive): string[] {
  const ids = [
    ownerClient.managedBy?.isActive ? ownerClient.managedBy.id : null,
    ...ownerClient.managers
      .filter((manager) => manager.staff.isActive)
      .map((manager) => manager.staffId),
  ]
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))))
}

async function resolveOwnerClient(
  db: PrismaClient,
  input: { organizationId: string; clientId: string }
): Promise<OwnerResolution> {
  const requestedClient = await db.client.findFirst({
    where: { id: input.clientId, organizationId: input.organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      clientType: true,
      clientGroupId: true,
      businessState: true,
      managedBy: { select: { id: true, name: true, email: true, isActive: true } },
      managers: {
        orderBy: { createdAt: 'asc' },
        select: {
          staffId: true,
          staff: { select: { id: true, name: true, email: true, isActive: true } },
        },
      },
      clientGroup: {
        select: {
          id: true,
          clients: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true,
              email: true,
              clientType: true,
              businessState: true,
              managedBy: { select: { id: true, name: true, email: true, isActive: true } },
              managers: {
                orderBy: { createdAt: 'asc' },
                select: {
                  staffId: true,
                  staff: { select: { id: true, name: true, email: true, isActive: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!requestedClient) {
    throw new GoogleDriveServiceError('DRIVE_NOT_CONNECTED', 'Client not found.')
  }

  const groupClients = requestedClient.clientGroup?.clients ?? []
  const individualOwner = groupClients.find((client) => client.clientType === 'INDIVIDUAL')
  const businessClients = groupClients.filter((client) => client.clientType === 'BUSINESS')
  const ownerClient = individualOwner ?? requestedClient

  return {
    requestedClient,
    ownerClient,
    clientGroupId: requestedClient.clientGroupId,
    businessClients,
  }
}

async function findExistingFolder(
  db: PrismaClient,
  organizationId: string,
  ownerClientId: string
) {
  return db.clientDriveFolder.findUnique({
    where: {
      ownerClientId_organizationId: { ownerClientId, organizationId },
    },
    include: {
      nodes: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  })
}

function isRecentCreating(row: { status: ClientDriveFolderStatus; updatedAt: Date }): boolean {
  return row.status === ClientDriveFolderStatus.CREATING &&
    Date.now() - row.updatedAt.getTime() < CREATING_LOCK_MS
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
}

async function heartbeatDriveFolderRow(db: PrismaClient, rowId: string): Promise<void> {
  await db.clientDriveFolder.update({
    where: { id: rowId },
    data: {
      status: ClientDriveFolderStatus.CREATING,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  })
}

function appProperties(input: {
  organizationId: string
  ownerClientId: string
  clientGroupId: string | null
  role: string
  businessClientId?: string | null
}) {
  return {
    ellaOrgId: input.organizationId,
    ellaOwnerClientId: input.ownerClientId,
    ellaClientGroupId: input.clientGroupId,
    ellaBusinessClientId: input.businessClientId,
    ellaFolderRole: input.role,
  }
}

async function persistDriveFolderNode(input: {
  db: PrismaClient
  rowId: string
  organizationId: string
  ownerClientId: string
  businessClientId: string | null
  role: string
  name: string
  parentFolderId: string
  folder: GoogleDriveFolderView
}) {
  await heartbeatDriveFolderRow(input.db, input.rowId)
  const existingNode = await input.db.clientDriveFolderNode.findFirst({
    where: {
      clientDriveFolderId: input.rowId,
      role: input.role,
      businessClientId: input.businessClientId,
    },
  })
  const data = {
    organizationId: input.organizationId,
    ownerClientId: input.ownerClientId,
    businessClientId: input.businessClientId,
    role: input.role,
    name: input.name,
    driveFolderId: input.folder.id,
    webViewLink: input.folder.webViewLink,
    parentDriveFolderId: input.parentFolderId,
  }

  if (existingNode) {
    await input.db.clientDriveFolderNode.update({
      where: { id: existingNode.id },
      data,
    })
    return
  }

  await input.db.clientDriveFolderNode.create({
    data: {
      clientDriveFolderId: input.rowId,
      ...data,
    },
  })
}

async function ensureDriveFolderNode(input: {
  db: PrismaClient
  drive: Parameters<typeof findGoogleDriveFolderByAppProperties>[0]
  rowId: string
  organizationId: string
  ownerClientId: string
  clientGroupId: string | null
  businessClientId?: string | null
  parentFolderId: string
  role: string
  roleAliases?: string[]
  name: string
  savedFolderId?: string | null
  savedFolderWebUrl?: string | null
  updateData?: { idKey: string; urlKey: string }
  renameSavedFolder?: boolean
}): Promise<GoogleDriveFolderView> {
  const businessClientId = input.businessClientId ?? null
  const node = await input.db.clientDriveFolderNode.findFirst({
    where: {
      clientDriveFolderId: input.rowId,
      role: input.role,
      businessClientId,
    },
  })

  let folder: GoogleDriveFolderView | null = null
  let savedFolderUpdateError: unknown = null
  const properties = appProperties({
    organizationId: input.organizationId,
    ownerClientId: input.ownerClientId,
    clientGroupId: input.clientGroupId,
    businessClientId,
    role: input.role,
  })

  if (node?.driveFolderId) {
    folder = {
      id: node.driveFolderId,
      name: node.name,
      webViewLink: node.webViewLink,
    }
  } else if (input.savedFolderId) {
    folder = {
      id: input.savedFolderId,
      name: input.name,
      webViewLink: input.savedFolderWebUrl ?? null,
    }
  }

  if (folder && input.renameSavedFolder) {
    try {
      await heartbeatDriveFolderRow(input.db, input.rowId)
      folder = await updateGoogleDriveFolder(input.drive, {
        folderId: folder.id,
        name: input.name,
        appProperties: properties,
      })
    } catch (error) {
      savedFolderUpdateError = isGoogleDriveNotFoundError(error) ? null : error
      folder = null
    }
  }

  const rolesToSearch = [input.role, ...(input.roleAliases ?? [])]
  for (const role of rolesToSearch) {
    if (folder) break
    await heartbeatDriveFolderRow(input.db, input.rowId)
    const existing = await findGoogleDriveFolderByAppProperties(input.drive, {
      parentFolderId: input.parentFolderId,
      appProperties: appProperties({
        organizationId: input.organizationId,
        ownerClientId: input.ownerClientId,
        clientGroupId: input.clientGroupId,
        businessClientId,
        role,
      }),
    })
    if (existing && role !== input.role) {
      folder = await updateGoogleDriveFolder(input.drive, {
        folderId: existing.id,
        name: input.name,
        appProperties: properties,
      })
    } else {
      folder = existing
    }
  }

  if (!folder && savedFolderUpdateError) {
    throw savedFolderUpdateError
  }

  await heartbeatDriveFolderRow(input.db, input.rowId)
  folder ??= await createGoogleDriveFolder(input.drive, {
    parentFolderId: input.parentFolderId,
    name: input.name,
    appProperties: properties,
  })

  await persistDriveFolderNode({
    db: input.db,
    rowId: input.rowId,
    organizationId: input.organizationId,
    ownerClientId: input.ownerClientId,
    businessClientId,
    role: input.role,
    name: input.name,
    parentFolderId: input.parentFolderId,
    folder,
  })

  if (input.updateData) {
    await input.db.clientDriveFolder.update({
      where: { id: input.rowId },
      data: {
        [input.updateData.idKey]: folder.id,
        [input.updateData.urlKey]: folder.webViewLink,
        status: ClientDriveFolderStatus.CREATING,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    })
  }

  return folder
}

function getBusinessFolderClients(owner: OwnerResolution): GroupClientForDrive[] {
  if (owner.businessClients.length > 0) return owner.businessClients
  if (!owner.clientGroupId && owner.requestedClient.clientType === 'BUSINESS') {
    return [owner.requestedClient as GroupClientForDrive]
  }
  return []
}

function readClientDriveInputSnapshot(value: unknown): Partial<ClientDriveInputSnapshot> {
  return typeof value === 'object' && value !== null
    ? value as Partial<ClientDriveInputSnapshot>
    : {}
}

function getFolderNodeByRole(input: {
  nodes?: Array<{ role: string; driveFolderId: string | null; webViewLink: string | null }>
}, role: string) {
  return input.nodes?.find((node) => node.role === role) ?? null
}

function getMultiBusinessRootFolderUpdate(input: {
  owner: OwnerResolution
  existingFolder: {
    folderName: string
    inputSnapshot: unknown
  }
}): { folderName: string; inputSnapshot: ClientDriveInputSnapshot } | null {
  if (input.owner.businessClients.length < 2) return null

  const currentSnapshot = readClientDriveInputSnapshot(input.existingFolder.inputSnapshot)
  const ssnLast4 = typeof currentSnapshot.ssnLast4 === 'string' ? currentSnapshot.ssnLast4 : null
  const state = typeof currentSnapshot.state === 'string' ? currentSnapshot.state : null
  if (!ssnLast4 || !state) return null

  const clientName = getClientDriveDisplayName(input.owner.ownerClient)
  const folderName = buildClientDriveFolderName({
    clientName,
    ssnLast4,
    state,
    businessMode: 'MULTI',
  })

  if (folderName === input.existingFolder.folderName) return null

  return {
    folderName,
    inputSnapshot: {
      ownerClientId: input.owner.ownerClient.id,
      clientGroupId: input.owner.clientGroupId,
      folderName,
      clientName,
      ssnLast4,
      state: normalizeClientDriveState(state),
      entityLabel: 'Multi',
    },
  }
}

async function ensureDriveBusinessFolderNodes(input: {
  db: PrismaClient
  drive: Parameters<typeof findGoogleDriveFolderByAppProperties>[0]
  rowId: string
  organizationId: string
  ownerClientId: string
  clientGroupId: string | null
  amWorkFolderId: string
  businessClients: GroupClientForDrive[]
  currentYear: number
}) {
  for (const business of input.businessClients) {
    const businessFolder = await ensureDriveFolderNode({
      db: input.db,
      drive: input.drive,
      rowId: input.rowId,
      organizationId: input.organizationId,
      ownerClientId: input.ownerClientId,
      clientGroupId: input.clientGroupId,
      businessClientId: business.id,
      parentFolderId: input.amWorkFolderId,
      role: CLIENT_DRIVE_FOLDER_ROLES.BUSINESS_ROOT,
      name: getClientDriveDisplayName(business),
    })
    await ensureDriveFolderNode({
      db: input.db,
      drive: input.drive,
      rowId: input.rowId,
      organizationId: input.organizationId,
      ownerClientId: input.ownerClientId,
      clientGroupId: input.clientGroupId,
      businessClientId: business.id,
      parentFolderId: businessFolder.id,
      role: CLIENT_DRIVE_FOLDER_ROLES.BUSINESS_CASH_PLAN,
      name: getClientDriveBusinessCashPlanFolderName(input.currentYear),
    })
    await ensureDriveFolderNode({
      db: input.db,
      drive: input.drive,
      rowId: input.rowId,
      organizationId: input.organizationId,
      ownerClientId: input.ownerClientId,
      clientGroupId: input.clientGroupId,
      businessClientId: business.id,
      parentFolderId: businessFolder.id,
      role: CLIENT_DRIVE_FOLDER_ROLES.BUSINESS_OTHER_DOCS,
      name: getClientDriveBusinessOtherDocsFolderName(input.currentYear),
    })
  }
}

function getAllowedClientEmails(owner: OwnerResolution): Set<string> {
  return new Set([
    owner.requestedClient.email,
    owner.ownerClient.email,
    ...owner.businessClients.map((client) => client.email),
  ].filter((email): email is string => Boolean(email)).map(normalizeEmail))
}

function assertClientEmailAllowed(owner: OwnerResolution, clientEmail: string): void {
  const allowedEmails = getAllowedClientEmails(owner)
  if (!allowedEmails.has(normalizeEmail(clientEmail))) {
    throw new GoogleDriveServiceError(
      'DRIVE_PERMISSION_FAILED',
      'Client email must match an org-scoped client email.'
    )
  }
}

function getPermissionGrantKey(grant: GoogleDrivePermissionGrant): string {
  return [grant.folderId, grant.type, normalizeEmail(grant.email), grant.role].join(':')
}

function getAppliedPermissionKeys(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== 'object' || !('appliedPermissionKeys' in snapshot)) {
    return []
  }
  const keys = (snapshot as { appliedPermissionKeys?: unknown }).appliedPermissionKeys
  return Array.isArray(keys) ? keys.filter((key): key is string => typeof key === 'string') : []
}

function toPermissionSummary(snapshot: ClientDrivePermissionSnapshot): ClientDriveStructureResponseDto['permissionSummary'] {
  return {
    adminGroupEmail: snapshot.adminGroupEmail,
    adminEmails: snapshot.adminEmails,
    accountManagerEmails: snapshot.accountManagerEmails,
    clientEmail: snapshot.clientEmail,
  }
}

function toQueuedInputSnapshot(snapshot: ClientDriveInputSnapshot): QueuedInputSnapshot {
  return {
    folderName: snapshot.folderName,
    ssnLast4: snapshot.ssnLast4,
    state: snapshot.state,
    entityLabel: snapshot.entityLabel,
  }
}

function queuedInputSnapshotMatches(current: unknown, queued: QueuedInputSnapshot): boolean {
  const snapshot = readClientDriveInputSnapshot(current)
  return snapshot.folderName === queued.folderName &&
    snapshot.ssnLast4 === queued.ssnLast4 &&
    snapshot.state === queued.state &&
    snapshot.entityLabel === queued.entityLabel
}

async function claimClientDriveStructureRow(
  input: {
    organizationId?: string | null
    clientId: string
    actorStaffId?: string | null
    payload: ClientDriveStructureCreateInput
  },
  db: PrismaClient,
  options: ClientDriveStructureClaimOptions = {}
): Promise<ClientDriveStructureClaim> {
  const organizationId = assertOrganization(input.organizationId)
  const owner = await resolveOwnerClient(db, { organizationId, clientId: input.clientId })
  const connection = await db.googleDriveConnection.findUnique({ where: { organizationId } })

  if (!connection || connection.status !== 'CONNECTED') {
    throw new GoogleDriveServiceError('DRIVE_NOT_CONNECTED')
  }

  const readyFolder = await findExistingFolder(db, organizationId, owner.ownerClient.id)
  const createdNewRow = !readyFolder

  if (readyFolder && options.expectedRow) {
    const matchesExpectedRow = readyFolder.id === options.expectedRow.id &&
      readyFolder.updatedAt.getTime() === options.expectedRow.updatedAt.getTime()
    if (!matchesExpectedRow) {
      throw new GoogleDriveServiceError('DRIVE_STRUCTURE_IN_PROGRESS')
    }
  }

  const folderName = buildClientDriveFolderName({
    clientName: getClientDriveDisplayName(owner.ownerClient),
    ssnLast4: input.payload.ssnLast4,
    state: normalizeClientDriveState(input.payload.state),
    businessMode: input.payload.businessMode,
    businessName: input.payload.businessName,
  })
  assertClientEmailAllowed(owner, input.payload.clientEmail)
  const permissionTargets = await resolveClientDrivePermissionTargets({
    organizationId,
    accountManagerStaffIds: input.payload.accountManagerStaffIds ?? [],
    clientEmail: input.payload.clientEmail,
    adminGroupEmail: connection.adminGroupEmail,
  }, db)

  const inputSnapshot: ClientDriveInputSnapshot = {
    ownerClientId: owner.ownerClient.id,
    clientGroupId: owner.clientGroupId,
    folderName,
    clientName: getClientDriveDisplayName(owner.ownerClient),
    ssnLast4: input.payload.ssnLast4,
    state: normalizeClientDriveState(input.payload.state),
    entityLabel: input.payload.businessMode === 'MULTI' ? 'Multi' : input.payload.businessName ?? '',
  }
  const permissionSnapshot: ClientDrivePermissionSnapshot = {
    adminGroupEmail: permissionTargets.adminGroupEmail,
    adminEmails: permissionTargets.admins.map((admin) => admin.email),
    accountManagerEmails: permissionTargets.accountManagers.map((staff) => staff.email),
    clientEmail: permissionTargets.clientEmail,
  }

  if (readyFolder && isRecentCreating(readyFolder) && !options.allowRecentCreating) {
    throw new GoogleDriveServiceError('DRIVE_STRUCTURE_IN_PROGRESS')
  }

  let row
  if (readyFolder) {
    const claim = await db.clientDriveFolder.updateMany({
      where: {
        id: readyFolder.id,
        status: readyFolder.status,
        updatedAt: readyFolder.updatedAt,
      },
      data: {
        folderName,
        clientGroupId: owner.clientGroupId,
        status: ClientDriveFolderStatus.CREATING,
        inputSnapshot: inputSnapshot as unknown as Prisma.InputJsonObject,
        permissionSnapshot: {
          ...permissionSnapshot,
          appliedPermissionKeys: getAppliedPermissionKeys(readyFolder.permissionSnapshot),
        } as unknown as Prisma.InputJsonObject,
        lastErrorCode: null,
        lastErrorMessage: null,
        createdByStaffId: input.actorStaffId ?? readyFolder.createdByStaffId ?? null,
      },
    })
    if (claim.count !== 1) {
      throw new GoogleDriveServiceError('DRIVE_STRUCTURE_IN_PROGRESS')
    }
    row = await db.clientDriveFolder.findUniqueOrThrow({ where: { id: readyFolder.id } })
  } else {
    try {
      row = await db.clientDriveFolder.create({
        data: {
          organizationId,
          ownerClientId: owner.ownerClient.id,
          clientGroupId: owner.clientGroupId,
          folderName,
          status: ClientDriveFolderStatus.CREATING,
          inputSnapshot: inputSnapshot as unknown as Prisma.InputJsonObject,
          permissionSnapshot: {
            ...permissionSnapshot,
            appliedPermissionKeys: [],
          } as unknown as Prisma.InputJsonObject,
          createdByStaffId: input.actorStaffId ?? null,
        },
      })
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error
      const concurrentRow = await findExistingFolder(db, organizationId, owner.ownerClient.id)
      if (!concurrentRow || (isRecentCreating(concurrentRow) && !options.allowRecentCreating)) {
        throw new GoogleDriveServiceError('DRIVE_STRUCTURE_IN_PROGRESS')
      }
      const claim = await db.clientDriveFolder.updateMany({
        where: {
          id: concurrentRow.id,
          status: concurrentRow.status,
          updatedAt: concurrentRow.updatedAt,
        },
        data: {
          folderName,
          clientGroupId: owner.clientGroupId,
          status: ClientDriveFolderStatus.CREATING,
          inputSnapshot: inputSnapshot as unknown as Prisma.InputJsonObject,
          permissionSnapshot: {
            ...permissionSnapshot,
            appliedPermissionKeys: getAppliedPermissionKeys(concurrentRow.permissionSnapshot),
          } as unknown as Prisma.InputJsonObject,
          lastErrorCode: null,
          lastErrorMessage: null,
          createdByStaffId: input.actorStaffId ?? concurrentRow.createdByStaffId ?? null,
        },
      })
      if (claim.count !== 1) {
        throw new GoogleDriveServiceError('DRIVE_STRUCTURE_IN_PROGRESS')
      }
      row = await db.clientDriveFolder.findUniqueOrThrow({ where: { id: concurrentRow.id } })
    }
  }

  return {
    organizationId,
    owner,
    connection,
    row,
    createdNewRow,
    permissionTargets,
    inputSnapshot,
    permissionSnapshot,
  }
}

export async function getClientDriveStructureOptions(
  input: { organizationId?: string | null; clientId: string },
  db: PrismaClient = prisma
): Promise<ClientDriveStructureOptionsDto> {
  const organizationId = assertOrganization(input.organizationId)
  const owner = await resolveOwnerClient(db, { organizationId, clientId: input.clientId })
  const mode = defaultBusinessMode(owner)
  const existingFolder = await findExistingFolder(db, organizationId, owner.ownerClient.id)
  const staffOptions = await db.staff.findMany({
    where: { organizationId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, driveEmails: true },
  })

  return {
    ownerClientId: owner.ownerClient.id,
    clientGroupId: owner.clientGroupId,
    clientName: getClientDriveDisplayName(owner.ownerClient),
    clientEmail: owner.ownerClient.email ?? owner.requestedClient.email,
    currentYear: new Date().getFullYear(),
    businessNames: getBusinessFolderClients(owner).map(getClientDriveDisplayName),
    defaultBusinessMode: mode,
    defaultBusinessName: defaultBusinessName(mode, owner, owner.businessClients),
    defaultState: owner.requestedClient.businessState ?? owner.businessClients[0]?.businessState ?? null,
    selectedAccountManagerStaffIds: selectedManagerIds(owner.ownerClient),
    staffOptions,
    existingFolder: existingFolder ? mapDriveFolderDto(existingFolder) : null,
  }
}

export async function getClientDriveStructureStatus(
  input: { organizationId?: string | null; clientId: string },
  db: PrismaClient = prisma
): Promise<ClientDriveStructureResponseDto> {
  const organizationId = assertOrganization(input.organizationId)
  const owner = await resolveOwnerClient(db, { organizationId, clientId: input.clientId })
  const existingFolder = await findExistingFolder(db, organizationId, owner.ownerClient.id)

  return {
    created: false,
    folder: existingFolder ? mapDriveFolderDto(existingFolder) : null,
    permissionSummary: existingFolder
      ? toPermissionSummary(existingFolder.permissionSnapshot as unknown as ClientDrivePermissionSnapshot)
      : null,
    warnings: [],
  }
}

export async function queueClientDriveStructureCreation(
  input: {
    organizationId?: string | null
    clientId: string
    actorStaffId?: string | null
    payload: ClientDriveStructureCreateInput
  },
  db: PrismaClient = prisma
): Promise<ClientDriveStructureResponseDto & {
  queuedEvent: {
    rowId: string
    rowUpdatedAt: string
    inputSnapshot: QueuedInputSnapshot
  }
}> {
  const claim = await claimClientDriveStructureRow(input, db)
  const rowWithNodes = await db.clientDriveFolder.findUniqueOrThrow({
    where: { id: claim.row.id },
    include: {
      nodes: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  })

  return {
    created: claim.createdNewRow,
    folder: mapDriveFolderDto(rowWithNodes),
    permissionSummary: toPermissionSummary(claim.permissionSnapshot),
    warnings: claim.permissionTargets.admins.length === 0 && !claim.permissionTargets.adminGroupEmail
      ? ['NO_ACTIVE_ADMIN_EMAILS']
      : [],
    queuedEvent: {
      rowId: claim.row.id,
      rowUpdatedAt: claim.row.updatedAt.toISOString(),
      inputSnapshot: toQueuedInputSnapshot(claim.inputSnapshot),
    },
  }
}

export async function markQueuedClientDriveStructureDispatchFailed(
  input: { organizationId?: string | null; rowId: string; message: string },
  db: PrismaClient = prisma
): Promise<void> {
  const organizationId = assertOrganization(input.organizationId)
  await db.clientDriveFolder.updateMany({
    where: { id: input.rowId, organizationId, status: ClientDriveFolderStatus.CREATING },
    data: {
      status: ClientDriveFolderStatus.FAILED,
      lastErrorCode: 'DRIVE_STRUCTURE_IN_PROGRESS',
      lastErrorMessage: input.message,
    },
  })
}

export async function createClientDriveStructure(
  input: {
    organizationId?: string | null
    clientId: string
    actorStaffId?: string | null
    payload: ClientDriveStructureCreateInput
  },
  db: PrismaClient = prisma,
  options: ClientDriveStructureClaimOptions = {}
): Promise<ClientDriveStructureResponseDto> {
  const {
    organizationId,
    owner,
    connection,
    row: claimedRow,
    createdNewRow,
    permissionTargets,
    inputSnapshot,
    permissionSnapshot,
  } = await claimClientDriveStructureRow(input, db, options)
  let row = claimedRow

  try {
    const drive = createGoogleDriveClientForConnection(connection)
    const currentYear = new Date().getFullYear()
    const rootFolder = await ensureDriveFolderNode({
      db,
      drive,
      rowId: row.id,
      organizationId,
      ownerClientId: owner.ownerClient.id,
      clientGroupId: owner.clientGroupId,
      parentFolderId: connection.rootFolderId,
      role: CLIENT_DRIVE_FOLDER_ROLES.CLIENT_ROOT,
      name: inputSnapshot.folderName,
      savedFolderId: row.rootFolderId,
      savedFolderWebUrl: row.rootFolderWebUrl,
      updateData: { idKey: 'rootFolderId', urlKey: 'rootFolderWebUrl' },
    })

    row = await db.clientDriveFolder.findUniqueOrThrow({ where: { id: row.id } })
    const amWorkFolder = await ensureDriveFolderNode({
      db,
      drive,
      rowId: row.id,
      organizationId,
      ownerClientId: owner.ownerClient.id,
      clientGroupId: owner.clientGroupId,
      parentFolderId: rootFolder.id,
      role: CLIENT_DRIVE_FOLDER_ROLES.AM_WORK,
      name: CLIENT_DRIVE_FOLDER_NAMES.AM_WORK,
      savedFolderId: row.amWorkFolderId,
      savedFolderWebUrl: row.amWorkFolderWebUrl,
      updateData: { idKey: 'amWorkFolderId', urlKey: 'amWorkFolderWebUrl' },
    })

    row = await db.clientDriveFolder.findUniqueOrThrow({ where: { id: row.id } })
    const officeAdminFolder = await ensureDriveFolderNode({
      db,
      drive,
      rowId: row.id,
      organizationId,
      ownerClientId: owner.ownerClient.id,
      clientGroupId: owner.clientGroupId,
      parentFolderId: rootFolder.id,
      role: CLIENT_DRIVE_FOLDER_ROLES.OFFICE_ADMIN_ONLY,
      roleAliases: [CORP_ADMIN_ROLE_ALIAS],
      name: CLIENT_DRIVE_FOLDER_NAMES.OFFICE_ADMIN_ONLY,
      savedFolderId: row.officeAdminFolderId,
      savedFolderWebUrl: row.officeAdminFolderWebUrl,
      updateData: { idKey: 'officeAdminFolderId', urlKey: 'officeAdminFolderWebUrl' },
      renameSavedFolder: true,
    })

    row = await db.clientDriveFolder.findUniqueOrThrow({ where: { id: row.id } })
    const sharedFolder = await ensureDriveFolderNode({
      db,
      drive,
      rowId: row.id,
      organizationId,
      ownerClientId: owner.ownerClient.id,
      clientGroupId: owner.clientGroupId,
      parentFolderId: amWorkFolder.id,
      role: CLIENT_DRIVE_FOLDER_ROLES.SHARED_TO_CLIENT,
      name: CLIENT_DRIVE_FOLDER_NAMES.SHARED_TO_CLIENT,
      savedFolderId: row.sharedFolderId,
      savedFolderWebUrl: row.sharedFolderWebUrl,
      updateData: { idKey: 'sharedFolderId', urlKey: 'sharedFolderWebUrl' },
    })

    await ensureDriveFolderNode({
      db,
      drive,
      rowId: row.id,
      organizationId,
      ownerClientId: owner.ownerClient.id,
      clientGroupId: owner.clientGroupId,
      parentFolderId: officeAdminFolder.id,
      role: CLIENT_DRIVE_FOLDER_ROLES.OFFICE_ADMIN_DOCS,
      name: CLIENT_DRIVE_FOLDER_NAMES.OFFICE_ADMIN_DOCS,
    })
    await ensureDriveFolderNode({
      db,
      drive,
      rowId: row.id,
      organizationId,
      ownerClientId: owner.ownerClient.id,
      clientGroupId: owner.clientGroupId,
      parentFolderId: officeAdminFolder.id,
      role: CLIENT_DRIVE_FOLDER_ROLES.OFFICE_LLC_DOCS,
      name: CLIENT_DRIVE_FOLDER_NAMES.OFFICE_LLC_DOCS,
    })

    const sharedYearFolders = [
      {
        role: CLIENT_DRIVE_FOLDER_ROLES.SHARED_TAX_DOCS,
        name: getClientDriveSharedTaxDocsFolderName(currentYear),
      },
      {
        role: CLIENT_DRIVE_FOLDER_ROLES.SHARED_PAYSTUBS,
        name: getClientDriveSharedPaystubsFolderName(currentYear),
      },
      {
        role: CLIENT_DRIVE_FOLDER_ROLES.SHARED_RECEIPTS,
        name: getClientDriveSharedReceiptsFolderName(currentYear),
      },
      {
        role: CLIENT_DRIVE_FOLDER_ROLES.SHARED_STATEMENTS,
        name: getClientDriveSharedStatementsFolderName(currentYear),
      },
    ]

    for (const folder of sharedYearFolders) {
      await ensureDriveFolderNode({
        db,
        drive,
        rowId: row.id,
        organizationId,
        ownerClientId: owner.ownerClient.id,
        clientGroupId: owner.clientGroupId,
        parentFolderId: sharedFolder.id,
        role: folder.role,
        name: folder.name,
      })
    }

    const latestOwner = await resolveOwnerClient(db, {
      organizationId,
      clientId: input.clientId,
    })
    if (latestOwner.clientGroupId !== row.clientGroupId) {
      await db.clientDriveFolder.update({
        where: { id: row.id },
        data: { clientGroupId: latestOwner.clientGroupId },
      })
    }

    await ensureDriveBusinessFolderNodes({
      db,
      drive,
      rowId: row.id,
      organizationId,
      ownerClientId: latestOwner.ownerClient.id,
      clientGroupId: latestOwner.clientGroupId,
      amWorkFolderId: amWorkFolder.id,
      businessClients: getBusinessFolderClients(latestOwner),
      currentYear,
    })

    const grants: GoogleDrivePermissionGrant[] = [
      ...permissionTargets.admins.map((admin) => ({
        folderId: amWorkFolder.id,
        email: admin.email,
        role: 'writer' as const,
        type: 'user' as const,
        sendNotificationEmail: input.payload.sendNotificationEmail,
      })),
      ...permissionTargets.accountManagers.map((staff) => ({
        folderId: amWorkFolder.id,
        email: staff.email,
        role: 'writer' as const,
        type: 'user' as const,
        sendNotificationEmail: input.payload.sendNotificationEmail,
      })),
      ...(permissionTargets.adminGroupEmail
        ? [{
            folderId: officeAdminFolder.id,
            email: permissionTargets.adminGroupEmail,
            role: 'writer' as const,
            type: 'group' as const,
            sendNotificationEmail: input.payload.sendNotificationEmail,
          }]
        : []),
      ...permissionTargets.admins.map((admin) => ({
            folderId: officeAdminFolder.id,
            email: admin.email,
            role: 'writer' as const,
            type: 'user' as const,
            sendNotificationEmail: input.payload.sendNotificationEmail,
          })),
      {
        folderId: sharedFolder.id,
        email: permissionTargets.clientEmail,
        role: 'writer' as const,
        type: 'user' as const,
        sendNotificationEmail: input.payload.sendNotificationEmail,
      },
    ]
    row = await db.clientDriveFolder.findUniqueOrThrow({ where: { id: row.id } })
    const appliedPermissionKeys = new Set(getAppliedPermissionKeys(row.permissionSnapshot))
    for (const grant of grants) {
      const permissionKey = getPermissionGrantKey(grant)
      if (appliedPermissionKeys.has(permissionKey)) continue
      await grantGoogleDrivePermissionsSequentially(drive, [grant])
      appliedPermissionKeys.add(permissionKey)
      await db.clientDriveFolder.update({
        where: { id: row.id },
        data: {
          permissionSnapshot: {
            ...permissionSnapshot,
            appliedPermissionKeys: Array.from(appliedPermissionKeys),
          } as unknown as Prisma.InputJsonObject,
        },
      })
    }

    await db.clientDriveFolder.update({
      where: { id: row.id },
      data: {
        status: ClientDriveFolderStatus.READY,
        permissionSnapshot: {
          ...permissionSnapshot,
          appliedPermissionKeys: Array.from(appliedPermissionKeys),
        } as unknown as Prisma.InputJsonObject,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    })
    const updated = await db.clientDriveFolder.findUniqueOrThrow({
      where: { id: row.id },
      include: {
        nodes: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    })

    return {
      created: createdNewRow,
      folder: mapDriveFolderDto(updated),
      permissionSummary: toPermissionSummary(permissionSnapshot),
      warnings: permissionTargets.admins.length === 0 && !permissionTargets.adminGroupEmail
        ? ['NO_ACTIVE_ADMIN_EMAILS']
        : [],
    }
  } catch (error) {
    const driveError = error instanceof GoogleDriveServiceError
      ? error
      : new GoogleDriveServiceError('DRIVE_ROOT_INVALID', undefined, error)
    await db.clientDriveFolder.update({
      where: { id: row.id },
      data: {
        status: ClientDriveFolderStatus.FAILED,
        lastErrorCode: driveError.code,
        lastErrorMessage: driveError.message,
      },
    })
    throw driveError
  }
}

export async function executeQueuedClientDriveStructureCreation(
  input: {
    organizationId?: string | null
    clientId: string
    actorStaffId?: string | null
    payload: ClientDriveStructureCreateInput
    rowId: string
    rowUpdatedAt: string
    inputSnapshot: QueuedInputSnapshot
  },
  db: PrismaClient = prisma
): Promise<ClientDriveStructureResponseDto | { skipped: true; reason: string }> {
  const organizationId = assertOrganization(input.organizationId)
  const row = await db.clientDriveFolder.findUnique({ where: { id: input.rowId } })

  if (!row || row.organizationId !== organizationId) {
    return { skipped: true, reason: 'ROW_NOT_FOUND' }
  }
  if (row.status === ClientDriveFolderStatus.READY) {
    return { skipped: true, reason: 'ALREADY_READY' }
  }
  if (!queuedInputSnapshotMatches(row.inputSnapshot, input.inputSnapshot)) {
    return { skipped: true, reason: 'STALE_EVENT' }
  }
  if (
    row.status === ClientDriveFolderStatus.CREATING &&
    row.updatedAt.toISOString() !== input.rowUpdatedAt
  ) {
    return { skipped: true, reason: 'STALE_EVENT' }
  }

  const expectedRow = row.status === ClientDriveFolderStatus.CREATING
    ? { id: row.id, updatedAt: row.updatedAt }
    : undefined

  return createClientDriveStructure({
    organizationId,
    clientId: input.clientId,
    actorStaffId: input.actorStaffId,
    payload: input.payload,
  }, db, {
    allowRecentCreating: true,
    expectedRow,
  })
}

export async function syncClientDriveBusinessFolders(
  input: {
    organizationId?: string | null
    ownerOrRequestedClientId: string
    actorStaffId?: string | null
    businessClientIds?: string[]
  },
  db: PrismaClient = prisma
): Promise<{ synced: boolean; businessClientIds: string[] }> {
  const organizationId = assertOrganization(input.organizationId)
  const owner = await resolveOwnerClient(db, {
    organizationId,
    clientId: input.ownerOrRequestedClientId,
  })
  const connection = await db.googleDriveConnection.findUnique({ where: { organizationId } })
  if (!connection || connection.status !== 'CONNECTED') {
    return { synced: false, businessClientIds: [] }
  }

  const existingFolder = await findExistingFolder(db, organizationId, owner.ownerClient.id)
  if (!existingFolder) {
    return { synced: false, businessClientIds: [] }
  }

  const requestedBusinessIds = new Set(input.businessClientIds ?? [])
  const businessClients = getBusinessFolderClients(owner).filter((business) =>
    requestedBusinessIds.size === 0 || requestedBusinessIds.has(business.id)
  )
  const amWorkFolderId = existingFolder.amWorkFolderId ??
    existingFolder.nodes?.find((node) => node.role === CLIENT_DRIVE_FOLDER_ROLES.AM_WORK)?.driveFolderId ??
    null
  if (!amWorkFolderId || businessClients.length === 0) {
    return { synced: false, businessClientIds: [] }
  }
  if (isRecentCreating(existingFolder)) {
    return { synced: false, businessClientIds: [] }
  }

  const claim = await db.clientDriveFolder.updateMany({
    where: {
      id: existingFolder.id,
      status: existingFolder.status,
      updatedAt: existingFolder.updatedAt,
    },
    data: {
      clientGroupId: owner.clientGroupId,
      status: ClientDriveFolderStatus.CREATING,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdByStaffId: input.actorStaffId ?? existingFolder.createdByStaffId ?? null,
    },
  })
  if (claim.count !== 1) {
    return { synced: false, businessClientIds: [] }
  }

  try {
    const drive = createGoogleDriveClientForConnection(connection)
    const rootNode = getFolderNodeByRole(existingFolder, CLIENT_DRIVE_FOLDER_ROLES.CLIENT_ROOT)
    const rootFolderId = existingFolder.rootFolderId ?? rootNode?.driveFolderId ?? null
    const rootFolderWebUrl = existingFolder.rootFolderWebUrl ?? rootNode?.webViewLink ?? null
    const rootFolderUpdate = getMultiBusinessRootFolderUpdate({ owner, existingFolder })

    if (rootFolderUpdate && rootFolderId) {
      const rootFolder = await ensureDriveFolderNode({
        db,
        drive,
        rowId: existingFolder.id,
        organizationId,
        ownerClientId: owner.ownerClient.id,
        clientGroupId: owner.clientGroupId,
        parentFolderId: connection.rootFolderId,
        role: CLIENT_DRIVE_FOLDER_ROLES.CLIENT_ROOT,
        name: rootFolderUpdate.folderName,
        savedFolderId: rootFolderId,
        savedFolderWebUrl: rootFolderWebUrl,
        updateData: { idKey: 'rootFolderId', urlKey: 'rootFolderWebUrl' },
        renameSavedFolder: true,
      })
      await db.clientDriveFolder.update({
        where: { id: existingFolder.id },
        data: {
          folderName: rootFolderUpdate.folderName,
          rootFolderId: rootFolder.id,
          rootFolderWebUrl: rootFolder.webViewLink,
          inputSnapshot: rootFolderUpdate.inputSnapshot as unknown as Prisma.InputJsonObject,
          status: ClientDriveFolderStatus.CREATING,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      })
    }

    await ensureDriveBusinessFolderNodes({
      db,
      drive,
      rowId: existingFolder.id,
      organizationId,
      ownerClientId: owner.ownerClient.id,
      clientGroupId: owner.clientGroupId,
      amWorkFolderId,
      businessClients,
      currentYear: new Date().getFullYear(),
    })
    await db.clientDriveFolder.update({
      where: { id: existingFolder.id },
      data: {
        status: ClientDriveFolderStatus.READY,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    })
    return { synced: true, businessClientIds: businessClients.map((business) => business.id) }
  } catch (error) {
    const driveError = normalizeGoogleDriveError(error, 'DRIVE_ROOT_INVALID')
    await db.clientDriveFolder.update({
      where: { id: existingFolder.id },
      data: {
        status: ClientDriveFolderStatus.FAILED,
        lastErrorCode: driveError.code,
        lastErrorMessage: driveError.message,
      },
    })
    throw driveError
  }
}
