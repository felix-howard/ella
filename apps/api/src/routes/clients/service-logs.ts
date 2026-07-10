// Staff-facing client service log endpoints mounted under `/clients`.
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { ClientServiceType, type Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import type { AuthVariables } from '../../middleware/auth'
import { ACTIVITY_ACTIONS } from '../../services/activity-actions'
import { getChangedFieldNames } from '../../services/activity-log'
import {
  buildServiceLogUpdateData,
  cleanText,
  findAccessibleClient,
  findServiceLog,
  logServiceLogActivity,
  serializeServiceLog,
  SERVICE_LABELS,
  serviceLogSelect,
  serviceLogScopeWhere,
} from './service-log-route-helpers'
import {
  clientIdParamSchema,
  clientServiceLogIdParamSchema,
  createClientServiceLogSchema,
  listClientServiceLogsQuerySchema,
  updateClientServiceLogSchema,
} from './schemas'

const clientsServiceLogsRoute = new Hono<{ Variables: AuthVariables }>()

clientsServiceLogsRoute.get(
  '/:id/service-logs',
  zValidator('param', clientIdParamSchema),
  zValidator('query', listClientServiceLogsQuerySchema),
  async (c) => {
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const { limit, status } = c.req.valid('query')
    const client = await findAccessibleClient(id, user)
    if (!client) return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)

    const records = await prisma.clientServiceLog.findMany({
      where: {
        clientId: id,
        organizationId: client.organizationId,
        deletedAt: null,
        ...(status?.length ? { status: { in: status } } : {}),
      },
      orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: serviceLogSelect,
    })

    return c.json({ success: true, data: records.map(serializeServiceLog) })
  }
)

clientsServiceLogsRoute.post(
  '/:id/service-logs',
  zValidator('param', clientIdParamSchema),
  zValidator('json', createClientServiceLogSchema),
  async (c) => {
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const client = await findAccessibleClient(id, user)
    if (!client) return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)

    const customName = body.serviceType === ClientServiceType.OTHER
      ? cleanText(body.customServiceName, 100)
      : null
    if (body.serviceType === ClientServiceType.OTHER && !customName) {
      return c.json({ error: 'VALIDATION_ERROR', message: 'Custom service name is required' }, 400)
    }

    const data: Prisma.ClientServiceLogUncheckedCreateInput = {
      organizationId: client.organizationId,
      clientId: id,
      serviceType: body.serviceType,
      customServiceName: customName,
      status: body.status,
      taxYear: body.taxYear ?? null,
      serviceDate: new Date(body.serviceDate),
      note: cleanText(body.note, 5000) ?? null,
      createdById: user.staffId,
      updatedById: user.staffId,
    }
    const created = await prisma.clientServiceLog.create({ data, select: serviceLogSelect })
    const summary = `Added service log: ${SERVICE_LABELS[created.serviceType]}`

    await logServiceLogActivity(c, {
      action: ACTIVITY_ACTIONS.CLIENT.SERVICE_LOG_CREATED,
      clientId: id,
      organizationId: client.organizationId,
      serviceLogId: created.id,
      staffId: user.staffId,
      summary,
      metadata: { serviceType: created.serviceType, status: created.status, taxYear: created.taxYear },
    })

    return c.json({ success: true, data: serializeServiceLog(created) }, 201)
  }
)

clientsServiceLogsRoute.patch(
  '/:id/service-logs/:serviceLogId',
  zValidator('param', clientServiceLogIdParamSchema),
  zValidator('json', updateClientServiceLogSchema),
  async (c) => {
    const user = c.get('user')
    const { id, serviceLogId } = c.req.valid('param')
    const body = c.req.valid('json')
    const client = await findAccessibleClient(id, user)
    if (!client) return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)

    const existing = await findServiceLog(id, client.organizationId, serviceLogId)
    if (!existing) return c.json({ error: 'NOT_FOUND', message: 'Service log not found' }, 404)

    const nextType = body.serviceType ?? existing.serviceType
    const nextCustomName = body.customServiceName !== undefined
      ? cleanText(body.customServiceName, 100) ?? null
      : existing.customServiceName
    if (nextType === ClientServiceType.OTHER && !nextCustomName) {
      return c.json({ error: 'VALIDATION_ERROR', message: 'Custom service name is required' }, 400)
    }

    const result = await prisma.clientServiceLog.updateMany({
      where: serviceLogScopeWhere(id, client.organizationId, serviceLogId),
      data: buildServiceLogUpdateData(body, user.staffId, nextCustomName, nextType),
    })
    if (result.count === 0) {
      return c.json({ error: 'NOT_FOUND', message: 'Service log not found' }, 404)
    }

    const updated = await findServiceLog(id, client.organizationId, serviceLogId)
    if (!updated) return c.json({ error: 'NOT_FOUND', message: 'Service log not found' }, 404)
    const changedFields = getChangedFieldNames(body)

    await logServiceLogActivity(c, {
      action: ACTIVITY_ACTIONS.CLIENT.SERVICE_LOG_UPDATED,
      clientId: id,
      organizationId: client.organizationId,
      serviceLogId: updated.id,
      staffId: user.staffId,
      summary: `Updated service log: ${SERVICE_LABELS[updated.serviceType]}`,
      metadata: {
        changedFields,
        serviceType: updated.serviceType,
        status: updated.status,
        taxYear: updated.taxYear,
      },
    })

    return c.json({ success: true, data: serializeServiceLog(updated) })
  }
)

clientsServiceLogsRoute.delete(
  '/:id/service-logs/:serviceLogId',
  zValidator('param', clientServiceLogIdParamSchema),
  async (c) => {
    const user = c.get('user')
    const { id, serviceLogId } = c.req.valid('param')
    const client = await findAccessibleClient(id, user)
    if (!client) return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)

    const existing = await findServiceLog(id, client.organizationId, serviceLogId)
    if (!existing) return c.json({ error: 'NOT_FOUND', message: 'Service log not found' }, 404)

    const result = await prisma.clientServiceLog.updateMany({
      where: serviceLogScopeWhere(id, client.organizationId, serviceLogId),
      data: { deletedAt: new Date(), deletedById: user.staffId, updatedById: user.staffId },
    })
    if (result.count === 0) {
      return c.json({ error: 'NOT_FOUND', message: 'Service log not found' }, 404)
    }

    const deleted = await findServiceLog(id, client.organizationId, serviceLogId, true)
    if (!deleted) return c.json({ error: 'NOT_FOUND', message: 'Service log not found' }, 404)

    await logServiceLogActivity(c, {
      action: ACTIVITY_ACTIONS.CLIENT.SERVICE_LOG_DELETED,
      clientId: id,
      organizationId: client.organizationId,
      serviceLogId,
      staffId: user.staffId,
      summary: `Deleted service log: ${SERVICE_LABELS[existing.serviceType]}`,
      metadata: {
        serviceType: existing.serviceType,
        status: existing.status,
        taxYear: existing.taxYear,
      },
    })

    return c.json({ success: true, data: serializeServiceLog(deleted) })
  }
)

export { clientsServiceLogsRoute }
