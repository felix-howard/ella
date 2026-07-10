import type { Context } from 'hono'
import {
  ActivityRiskLevel,
  ClientServiceType,
  type Prisma,
} from '@ella/db'
import { prisma } from '../../lib/db'
import { buildClientScopeFilter } from '../../lib/org-scope'
import { sanitizeTextInput } from '../../lib/validation'
import type { AuthVariables } from '../../middleware/auth'
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_TARGET_TYPES,
} from '../../services/activity-actions'
import {
  getAuditRequestContext,
  logStaffActivity,
} from '../../services/activity-log'
import type { UpdateClientServiceLogInput } from './schemas'

export const serviceLogSelect = {
  id: true,
  clientId: true,
  serviceType: true,
  customServiceName: true,
  status: true,
  taxYear: true,
  serviceDate: true,
  note: true,
  createdBy: { select: { id: true, name: true, avatarUrl: true } },
  updatedBy: { select: { id: true, name: true, avatarUrl: true } },
  createdAt: true,
  updatedAt: true,
} as const

export const SERVICE_LABELS = {
  [ClientServiceType.INDIVIDUAL_TAX_RETURN]: 'Individual Tax Return',
  [ClientServiceType.BUSINESS_TAX_RETURN]: 'Business Tax Return',
  [ClientServiceType.BOOKKEEPING]: 'Bookkeeping',
  [ClientServiceType.PAYROLL]: 'Payroll',
  [ClientServiceType.TAX_PLANNING]: 'Tax Planning',
  [ClientServiceType.IRS_NOTICE]: 'IRS Notice',
  [ClientServiceType.AMENDMENT]: 'Amendment',
  [ClientServiceType.FORM_1099_FILING]: '1099 Filing',
  [ClientServiceType.CONSULTATION]: 'Consultation',
  [ClientServiceType.OTHER]: 'Other Service',
} satisfies Record<ClientServiceType, string>

type ServiceLogRecord = Prisma.ClientServiceLogGetPayload<{ select: typeof serviceLogSelect }>

export function serializeServiceLog(record: ServiceLogRecord) {
  return {
    id: record.id,
    clientId: record.clientId,
    serviceType: record.serviceType,
    customServiceName: record.customServiceName,
    status: record.status,
    taxYear: record.taxYear,
    serviceDate: record.serviceDate.toISOString(),
    note: record.note,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export function cleanText(value: string | null | undefined, maxLength: number) {
  if (value === undefined) return undefined
  if (value === null) return null
  return sanitizeTextInput(value, maxLength) || null
}

export function buildServiceLogUpdateData(
  body: UpdateClientServiceLogInput,
  staffId: string | null,
  nextCustomName: string | null,
  nextType: ClientServiceType
) {
  const data: Prisma.ClientServiceLogUncheckedUpdateManyInput = { updatedById: staffId }
  if (body.serviceType !== undefined) data.serviceType = body.serviceType
  if (body.status !== undefined) data.status = body.status
  if (body.taxYear !== undefined) data.taxYear = body.taxYear
  if (body.serviceDate !== undefined) data.serviceDate = new Date(body.serviceDate)
  if (body.note !== undefined) data.note = cleanText(body.note, 5000)
  if (body.serviceType !== undefined || body.customServiceName !== undefined) {
    data.customServiceName = nextType === ClientServiceType.OTHER ? nextCustomName : null
  }
  return data
}

export async function findAccessibleClient(clientId: string, user: AuthVariables['user']) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    select: { id: true, organizationId: true },
  })
  if (!client?.organizationId) return null
  return { id: client.id, organizationId: client.organizationId }
}

export async function findServiceLog(
  clientId: string,
  organizationId: string,
  serviceLogId: string,
  includeDeleted = false
) {
  return prisma.clientServiceLog.findFirst({
    where: includeDeleted
      ? { id: serviceLogId, clientId, organizationId }
      : serviceLogScopeWhere(clientId, organizationId, serviceLogId),
    select: serviceLogSelect,
  })
}

export function serviceLogScopeWhere(
  clientId: string,
  organizationId: string,
  serviceLogId: string
) {
  return { id: serviceLogId, clientId, organizationId, deletedAt: null }
}

export async function logServiceLogActivity(
  c: Context,
  input: {
    action: string
    clientId: string
    organizationId: string
    serviceLogId: string
    staffId: string | null
    summary: string
    metadata: Record<string, unknown>
  }
) {
  if (!input.staffId) return
  await logStaffActivity({
    organizationId: input.organizationId,
    clientId: input.clientId,
    actorStaffId: input.staffId,
    category: ACTIVITY_CATEGORIES.CLIENT,
    targetType: ACTIVITY_TARGET_TYPES.CLIENT_SERVICE_LOG,
    targetId: input.serviceLogId,
    targetLabel: input.summary,
    summary: input.summary,
    action: input.action,
    riskLevel: ActivityRiskLevel.LOW,
    metadata: input.metadata,
    request: getAuditRequestContext(c),
  })
}
