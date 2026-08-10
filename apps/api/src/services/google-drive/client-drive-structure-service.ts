import { ClientDriveFolderStatus, type Prisma, type PrismaClient } from '@ella/db'
import { prisma } from '../../lib/db'
import type {
  ClientDriveBusinessMode,
  ClientDriveFolderDto,
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
  type GoogleDriveFolderView,
} from './google-drive-folders'
import {
  grantGoogleDrivePermissionsSequentially,
  type GoogleDrivePermissionGrant,
} from './google-drive-permissions'
import { GoogleDriveServiceError } from './google-drive-errors'
import {
  buildClientDriveFolderName,
  getClientDriveDisplayName,
  normalizeClientDriveState,
} from './client-drive-folder-name'
import { resolveClientDrivePermissionTargets } from './client-drive-permission-targets'

const ROOT_ROLE = 'CLIENT_ROOT'
const AM_WORK_ROLE = 'AM_WORK'
const CORP_ADMIN_ROLE = 'CORP_ADMIN'
const SHARED_TO_CLIENT_ROLE = 'SHARED_TO_CLIENT'
const CREATING_LOCK_MS = 2 * 60 * 1000

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
  corpAdminFolderId: string | null
  corpAdminFolderWebUrl: string | null
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
}): ClientDriveFolderDto {
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
    corpAdminFolderId: row.corpAdminFolderId,
    corpAdminFolderWebUrl: row.corpAdminFolderWebUrl,
    sharedFolderId: row.sharedFolderId,
    sharedFolderWebUrl: row.sharedFolderWebUrl,
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

function appProperties(input: {
  organizationId: string
  ownerClientId: string
  clientGroupId: string | null
  role: string
}) {
  return {
    ellaOrgId: input.organizationId,
    ellaOwnerClientId: input.ownerClientId,
    ellaClientGroupId: input.clientGroupId,
    ellaFolderRole: input.role,
  }
}

async function ensureFolder(input: {
  db: PrismaClient
  drive: Parameters<typeof findGoogleDriveFolderByAppProperties>[0]
  rowId: string
  organizationId: string
  ownerClientId: string
  clientGroupId: string | null
  parentFolderId: string
  role: string
  name: string
  savedFolderId: string | null
  savedFolderWebUrl: string | null
  updateData: { idKey: string; urlKey: string }
}): Promise<GoogleDriveFolderView> {
  if (input.savedFolderId) {
    return {
      id: input.savedFolderId,
      name: input.name,
      webViewLink: input.savedFolderWebUrl,
    }
  }

  const properties = appProperties({
    organizationId: input.organizationId,
    ownerClientId: input.ownerClientId,
    clientGroupId: input.clientGroupId,
    role: input.role,
  })
  const existing = await findGoogleDriveFolderByAppProperties(input.drive, {
    parentFolderId: input.parentFolderId,
    appProperties: properties,
  })
  const folder = existing ?? await createGoogleDriveFolder(input.drive, {
    parentFolderId: input.parentFolderId,
    name: input.name,
    appProperties: properties,
  })

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

  return folder
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
    select: { id: true, name: true, email: true },
  })

  return {
    ownerClientId: owner.ownerClient.id,
    clientGroupId: owner.clientGroupId,
    clientName: getClientDriveDisplayName(owner.ownerClient),
    clientEmail: owner.ownerClient.email ?? owner.requestedClient.email,
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

export async function createClientDriveStructure(
  input: {
    organizationId?: string | null
    clientId: string
    actorStaffId?: string | null
    payload: ClientDriveStructureCreateInput
  },
  db: PrismaClient = prisma
): Promise<ClientDriveStructureResponseDto> {
  const organizationId = assertOrganization(input.organizationId)
  const owner = await resolveOwnerClient(db, { organizationId, clientId: input.clientId })
  const connection = await db.googleDriveConnection.findUnique({ where: { organizationId } })

  if (!connection || connection.status !== 'CONNECTED') {
    throw new GoogleDriveServiceError('DRIVE_NOT_CONNECTED')
  }

  const readyFolder = await findExistingFolder(db, organizationId, owner.ownerClient.id)
  if (readyFolder?.status === ClientDriveFolderStatus.READY) {
    return {
      created: false,
      folder: mapDriveFolderDto(readyFolder),
      permissionSummary: toPermissionSummary(readyFolder.permissionSnapshot as unknown as ClientDrivePermissionSnapshot),
      warnings: [],
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
    accountManagerStaffIds: input.payload.accountManagerStaffIds,
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

  if (readyFolder && isRecentCreating(readyFolder)) {
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
      if (!concurrentRow || isRecentCreating(concurrentRow)) {
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

  try {
    const drive = createGoogleDriveClientForConnection(connection)
    const rootFolder = await ensureFolder({
      db,
      drive,
      rowId: row.id,
      organizationId,
      ownerClientId: owner.ownerClient.id,
      clientGroupId: owner.clientGroupId,
      parentFolderId: connection.rootFolderId,
      role: ROOT_ROLE,
      name: folderName,
      savedFolderId: row.rootFolderId,
      savedFolderWebUrl: row.rootFolderWebUrl,
      updateData: { idKey: 'rootFolderId', urlKey: 'rootFolderWebUrl' },
    })

    row = await db.clientDriveFolder.findUniqueOrThrow({ where: { id: row.id } })
    const amWorkFolder = await ensureFolder({
      db,
      drive,
      rowId: row.id,
      organizationId,
      ownerClientId: owner.ownerClient.id,
      clientGroupId: owner.clientGroupId,
      parentFolderId: rootFolder.id,
      role: AM_WORK_ROLE,
      name: 'AM WORK',
      savedFolderId: row.amWorkFolderId,
      savedFolderWebUrl: row.amWorkFolderWebUrl,
      updateData: { idKey: 'amWorkFolderId', urlKey: 'amWorkFolderWebUrl' },
    })

    row = await db.clientDriveFolder.findUniqueOrThrow({ where: { id: row.id } })
    const corpAdminFolder = await ensureFolder({
      db,
      drive,
      rowId: row.id,
      organizationId,
      ownerClientId: owner.ownerClient.id,
      clientGroupId: owner.clientGroupId,
      parentFolderId: rootFolder.id,
      role: CORP_ADMIN_ROLE,
      name: 'CORP ADMIN',
      savedFolderId: row.corpAdminFolderId,
      savedFolderWebUrl: row.corpAdminFolderWebUrl,
      updateData: { idKey: 'corpAdminFolderId', urlKey: 'corpAdminFolderWebUrl' },
    })

    row = await db.clientDriveFolder.findUniqueOrThrow({ where: { id: row.id } })
    const sharedFolder = await ensureFolder({
      db,
      drive,
      rowId: row.id,
      organizationId,
      ownerClientId: owner.ownerClient.id,
      clientGroupId: owner.clientGroupId,
      parentFolderId: amWorkFolder.id,
      role: SHARED_TO_CLIENT_ROLE,
      name: 'SHARED TO CLIENT',
      savedFolderId: row.sharedFolderId,
      savedFolderWebUrl: row.sharedFolderWebUrl,
      updateData: { idKey: 'sharedFolderId', urlKey: 'sharedFolderWebUrl' },
    })

    const grants: GoogleDrivePermissionGrant[] = [
      ...permissionTargets.accountManagers.map((staff) => ({
        folderId: amWorkFolder.id,
        email: staff.email,
        role: 'writer' as const,
        type: 'user' as const,
        sendNotificationEmail: input.payload.sendNotificationEmail,
      })),
      ...(permissionTargets.adminGroupEmail
        ? [{
            folderId: corpAdminFolder.id,
            email: permissionTargets.adminGroupEmail,
            role: 'writer' as const,
            type: 'group' as const,
            sendNotificationEmail: input.payload.sendNotificationEmail,
          }]
        : permissionTargets.admins.map((admin) => ({
            folderId: corpAdminFolder.id,
            email: admin.email,
            role: 'writer' as const,
            type: 'user' as const,
            sendNotificationEmail: input.payload.sendNotificationEmail,
          }))),
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

    const updated = await db.clientDriveFolder.update({
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

    return {
      created: true,
      folder: mapDriveFolderDto(updated),
      permissionSummary: toPermissionSummary(permissionSnapshot),
      warnings: permissionTargets.admins.length === 0 && !permissionTargets.adminGroupEmail
        ? ['NO_ACTIVE_ADMIN_EMAILS']
        : [],
    }
  } catch (error) {
    const driveError = error instanceof GoogleDriveServiceError
      ? error
      : new GoogleDriveServiceError('DRIVE_ROOT_INVALID')
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
