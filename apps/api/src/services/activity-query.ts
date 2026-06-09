import type { ActivityActorType, ActivityRiskLevel, Prisma } from '@ella/db'
import { buildClientScopeFilter, canSeeAllClients, verifyClientAccess } from '../lib/org-scope'
import { prisma } from '../lib/db'
import { resolveAvatarUrl } from './storage'
import { toActivityTimelineItem } from './activity-log'
import { ACTIVITY_ACTIONS, type ActivityCategory, type ActivityTargetType } from './activity-actions'
import type { AuthUser } from './auth'

const DEFAULT_LIMIT = 20
const TIMELINE_HIDDEN_ACTIONS = [
  ACTIVITY_ACTIONS.DOCUMENT.SIGNED_URL_CREATED,
  ACTIVITY_ACTIONS.DOCUMENT.FILE_PROXIED,
  ACTIVITY_ACTIONS.LEAD.MESSAGE_READ,
]

export class InvalidActivityCursorError extends Error {
  constructor() {
    super('Invalid activity cursor')
    this.name = 'InvalidActivityCursorError'
  }
}

export interface ActivityQueryFilters {
  limit?: number
  cursor?: string
  category?: ActivityCategory
  riskLevel?: ActivityRiskLevel
  actorStaffId?: string
}

export interface ActivityTimelineResponseItem {
  id: string
  createdAt: string
  category: ActivityCategory
  action: string
  riskLevel: ActivityRiskLevel
  summary: string
  actor: {
    type: ActivityActorType
    staffId: string | null
    name: string | null
    avatarUrl: string | null
  }
  target: {
    type: ActivityTargetType
    id: string | null
    label: string | null
  }
  clientId: string | null
  caseId: string | null
  route: string | null
  method: string | null
}

export interface ActivityTimelineResponse {
  data: ActivityTimelineResponseItem[]
  nextCursor: string | null
}

type ActivityRow = Awaited<ReturnType<typeof findActivityRows>>[number]

function isAdmin(user: AuthUser) {
  return canSeeAllClients(user)
}

function baseWhere(user: AuthUser): Prisma.ActivityLogWhereInput {
  if (!user.organizationId) return { id: '__NO_ACCESS__' }
  return {
    organizationId: user.organizationId,
    action: { notIn: TIMELINE_HIDDEN_ACTIONS },
  }
}

async function getAccessibleClientAndCaseIds(user: AuthUser) {
  const clients = await prisma.client.findMany({
    where: buildClientScopeFilter(user),
    select: { id: true },
  })
  const clientIds = clients.map((client) => client.id)

  return {
    clientIds,
    caseIds: [],
  }
}

function applyFilters(
  where: Prisma.ActivityLogWhereInput,
  filters: ActivityQueryFilters
): Prisma.ActivityLogWhereInput {
  return {
    ...where,
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.riskLevel ? { riskLevel: filters.riskLevel } : {}),
    ...(filters.actorStaffId ? { actorStaffId: filters.actorStaffId } : {}),
  }
}

async function findActivityRows(
  where: Prisma.ActivityLogWhereInput,
  limit: number,
  cursor?: string
) {
  if (cursor) {
    const cursorRow = await prisma.activityLog.findFirst({
      where: { ...where, id: cursor },
      select: { id: true },
    })
    if (!cursorRow) throw new InvalidActivityCursorError()
  }

  return prisma.activityLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      action: true,
      category: true,
      targetType: true,
      targetId: true,
      targetLabel: true,
      summary: true,
      actorType: true,
      actorStaffId: true,
      riskLevel: true,
      clientId: true,
      caseId: true,
      route: true,
      method: true,
      createdAt: true,
    },
  })
}

async function hydrateRows(
  rows: ActivityRow[],
  limit: number,
  organizationId: string | null | undefined
): Promise<ActivityTimelineResponse> {
  const pageRows = rows.slice(0, limit)
  const staffIds = [
    ...new Set(pageRows.map((row) => row.actorStaffId).filter(Boolean) as string[]),
  ]
  const staff = staffIds.length > 0
    ? await prisma.staff.findMany({
      where: {
        id: { in: staffIds },
        ...(organizationId ? { organizationId } : {}),
      },
      select: { id: true, name: true, avatarUrl: true },
    })
    : []

  const staffById = new Map(staff.map((item) => [item.id, item]))
  const data = await Promise.all(pageRows.map(async (row) => {
    const base = toActivityTimelineItem(row)
    const actorStaff = base.actorStaffId ? staffById.get(base.actorStaffId) : null

    return {
      id: base.id,
      createdAt: base.createdAt,
      category: base.category,
      action: base.action,
      riskLevel: base.riskLevel,
      summary: base.summary,
      actor: {
        type: base.actorType,
        staffId: base.actorStaffId,
        name: actorStaff?.name ?? null,
        avatarUrl: await resolveAvatarUrl(actorStaff?.avatarUrl),
      },
      target: {
        type: base.targetType,
        id: base.targetId,
        label: base.targetLabel,
      },
      clientId: row.clientId ?? null,
      caseId: row.caseId ?? null,
      route: null,
      method: row.method ?? null,
    }
  }))

  return {
    data,
    nextCursor: rows.length > limit ? rows[limit - 1]?.id ?? null : null,
  }
}

export async function listRecentActivity(
  user: AuthUser,
  filters: ActivityQueryFilters
): Promise<ActivityTimelineResponse> {
  const limit = filters.limit ?? DEFAULT_LIMIT
  let where = baseWhere(user)

  if (!isAdmin(user)) {
    const { clientIds, caseIds } = await getAccessibleClientAndCaseIds(user)
    where = {
      ...where,
      OR: [
        ...(clientIds.length > 0 ? [{ clientId: { in: clientIds } }] : []),
        ...(caseIds.length > 0 ? [{ caseId: { in: caseIds } }] : []),
        { clientId: null, caseId: null, actorStaffId: user.staffId ?? '__NO_STAFF__' },
      ],
    }
  }

  const rows = await findActivityRows(applyFilters(where, filters), limit, filters.cursor)
  return hydrateRows(rows, limit, user.organizationId)
}

export async function listClientActivity(
  user: AuthUser,
  clientId: string,
  filters: ActivityQueryFilters
): Promise<ActivityTimelineResponse | null> {
  const hasAccess = await verifyClientAccess(clientId, user)
  if (!hasAccess) return null

  const taxCases = await prisma.taxCase.findMany({
    where: { clientId },
    select: { id: true },
  })
  const caseIds = taxCases.map((taxCase) => taxCase.id)
  const limit = filters.limit ?? DEFAULT_LIMIT
  const where = applyFilters({
    ...baseWhere(user),
    OR: [
      { clientId },
      { targetType: 'CLIENT', targetId: clientId },
      ...(caseIds.length > 0 ? [{ caseId: { in: caseIds } }] : []),
    ],
  }, filters)

  const rows = await findActivityRows(where, limit, filters.cursor)
  return hydrateRows(rows, limit, user.organizationId)
}
