/**
 * New Contractor routes under /clients/:clientId/contractors
 * clientId must be a BUSINESS-type Client (enforced by verifyBusinessClient)
 * All routes require auth via parent middleware
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import { verifyBusinessClient } from '../../lib/org-scope'
import { encryptSSN } from '../../services/crypto'
import { logProfileChanges } from '../../services/audit-logger'
import { parseNailSalonExcel } from '../../services/excel-parser'
import { createContractorSchema, updateContractorSchema, bulkSaveContractorsSchema } from './validators'
import { findBusinessIdForClient } from './find-business-id'
import type { AuthVariables } from '../../middleware/auth'

const clientContractorsRoute = new Hono<{ Variables: AuthVariables }>()

/** GET /clients/:clientId/contractors */
clientContractorsRoute.get('/:clientId/contractors', async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  const client = await verifyBusinessClient(clientId, user)
  if (!client) {
    return c.json({ error: 'NOT_FOUND', message: 'Business client not found' }, 404)
  }

  const contractors = await prisma.contractor.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, firstName: true, lastName: true, ssnLast4: true,
      address: true, city: true, state: true, zip: true,
      email: true, phone: true, createdAt: true, updatedAt: true,
      forms: {
        select: { id: true, status: true, pdfStorageKey: true, copyBStorageKey: true },
        orderBy: { taxYear: 'desc' },
        take: 1,
      },
    },
  })

  const mapped = contractors.map((ct) => {
    const form = ct.forms[0]
    return {
      id: ct.id, firstName: ct.firstName, lastName: ct.lastName, ssnLast4: ct.ssnLast4,
      address: ct.address, city: ct.city, state: ct.state, zip: ct.zip,
      email: ct.email, phone: ct.phone, createdAt: ct.createdAt, updatedAt: ct.updatedAt,
      formId: form?.id ?? null, formStatus: form?.status ?? null,
      hasCopyA: !!form?.pdfStorageKey, hasCopyB: !!form?.copyBStorageKey,
    }
  })

  return c.json({ data: mapped })
})

/** POST /clients/:clientId/contractors */
clientContractorsRoute.post(
  '/:clientId/contractors',
  zValidator('json', createContractorSchema),
  async (c) => {
    const user = c.get('user')
    const { clientId } = c.req.param()
    const data = c.req.valid('json')

    const client = await verifyBusinessClient(clientId, user)
    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Business client not found' }, 404)
    }

    // During transition, Contractor.businessId is still required
    const businessId = await findBusinessIdForClient(clientId)
    if (!businessId) {
      return c.json({ error: 'TRANSITION_ERROR', message: 'No legacy Business record found for this client. Required during transition.' }, 400)
    }

    const ssnDigits = data.ssn.replace(/\D/g, '')
    const ssnLast4 = ssnDigits.slice(-4)
    const ssnEncrypted = encryptSSN(data.ssn)

    const contractor = await prisma.contractor.create({
      data: {
        clientId, businessId,
        firstName: data.firstName, lastName: data.lastName, tinType: data.tinType,
        ssnEncrypted, ssnLast4,
        address: data.address, city: data.city, state: data.state, zip: data.zip,
        email: data.email, phone: data.phone,
      },
      select: {
        id: true, firstName: true, lastName: true, ssnLast4: true,
        address: true, city: true, state: true, zip: true,
        email: true, phone: true, createdAt: true, updatedAt: true,
      },
    })

    logProfileChanges(
      clientId,
      [{ field: 'contractor_ssn_encrypted', oldValue: null, newValue: `[ENCRYPTED] contractor:${contractor.id}` }],
      user.staffId ?? undefined
    ).catch((err) => console.error('[Contractors] Audit log error:', err))

    console.log(`[Contractors] Created contractor ${contractor.id} for client ${clientId} by staff ${user.staffId}`)
    return c.json({ data: contractor }, 201)
  }
)

/** PATCH /clients/:clientId/contractors/:id */
clientContractorsRoute.patch(
  '/:clientId/contractors/:id',
  zValidator('json', updateContractorSchema),
  async (c) => {
    const user = c.get('user')
    const { clientId, id } = c.req.param()
    const data = c.req.valid('json')

    const client = await verifyBusinessClient(clientId, user)
    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Business client not found' }, 404)
    }

    const existing = await prisma.contractor.findFirst({
      where: { id, clientId },
      select: { id: true },
    })
    if (!existing) {
      return c.json({ error: 'NOT_FOUND', message: 'Contractor not found' }, 404)
    }

    const updateData: Record<string, unknown> = {}
    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.lastName !== undefined) updateData.lastName = data.lastName
    if (data.tinType !== undefined) updateData.tinType = data.tinType
    if (data.address !== undefined) updateData.address = data.address
    if (data.city !== undefined) updateData.city = data.city
    if (data.state !== undefined) updateData.state = data.state
    if (data.zip !== undefined) updateData.zip = data.zip
    if (data.email !== undefined) updateData.email = data.email
    if (data.phone !== undefined) updateData.phone = data.phone

    if (data.ssn) {
      const ssnDigits = data.ssn.replace(/\D/g, '')
      updateData.ssnLast4 = ssnDigits.slice(-4)
      updateData.ssnEncrypted = encryptSSN(data.ssn)

      logProfileChanges(
        clientId,
        [{ field: 'contractor_ssn_updated', oldValue: '[ENCRYPTED]', newValue: `[RE-ENCRYPTED] contractor:${id}` }],
        user.staffId ?? undefined
      ).catch((err) => console.error('[Contractors] Audit log error:', err))
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'VALIDATION_ERROR', message: 'At least one field required' }, 400)
    }

    const contractor = await prisma.contractor.update({
      where: { id },
      data: updateData,
      select: {
        id: true, firstName: true, lastName: true, ssnLast4: true,
        address: true, city: true, state: true, zip: true,
        email: true, phone: true, createdAt: true, updatedAt: true,
      },
    })

    console.log(`[Contractors] Updated contractor ${id} for client ${clientId} by staff ${user.staffId}`)
    return c.json({ data: contractor })
  }
)

/**
 * DELETE /clients/:clientId/contractors/all
 * MUST be registered before /:id route to avoid "all" being matched as an ID
 */
clientContractorsRoute.delete('/:clientId/contractors/all', async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  const client = await verifyBusinessClient(clientId, user)
  if (!client) {
    return c.json({ error: 'NOT_FOUND', message: 'Business client not found' }, 404)
  }

  const result = await prisma.contractor.deleteMany({ where: { clientId } })

  console.log(`[Contractors] Bulk deleted ${result.count} contractors for client ${clientId} by staff ${user.staffId}`)
  return c.json({ success: true, count: result.count })
})

/** DELETE /clients/:clientId/contractors/:id */
clientContractorsRoute.delete('/:clientId/contractors/:id', async (c) => {
  const user = c.get('user')
  const { clientId, id } = c.req.param()

  const client = await verifyBusinessClient(clientId, user)
  if (!client) {
    return c.json({ error: 'NOT_FOUND', message: 'Business client not found' }, 404)
  }

  const existing = await prisma.contractor.findFirst({
    where: { id, clientId },
    select: { id: true },
  })
  if (!existing) {
    return c.json({ error: 'NOT_FOUND', message: 'Contractor not found' }, 404)
  }

  await prisma.contractor.delete({ where: { id } })

  console.log(`[Contractors] Deleted contractor ${id} for client ${clientId} by staff ${user.staffId}`)
  return c.json({ success: true, message: 'Contractor deleted' })
})

/** POST /clients/:clientId/contractors/upload-excel */
clientContractorsRoute.post('/:clientId/contractors/upload-excel', async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  const client = await verifyBusinessClient(clientId, user)
  if (!client) {
    return c.json({ error: 'NOT_FOUND', message: 'Business client not found' }, 404)
  }

  const body = await c.req.parseBody()
  const file = body['file'] as File | undefined
  if (!file) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'No file uploaded' }, 400)
  }

  const fileName = (file as File & { name?: string }).name || ''
  if (!fileName.match(/\.xlsx?$/i)) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid file type. Upload .xlsx or .xls file.' }, 400)
  }

  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ]
  if (file.type && !validTypes.includes(file.type)) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid file type. Upload .xlsx or .xls file.' }, 400)
  }

  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'File too large. Max 5MB.' }, 400)
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await parseNailSalonExcel(buffer)
    console.log(`[Contractors] Parsed Excel: ${result.contractors.length} contractors for client ${clientId} by staff ${user.staffId}`)
    return c.json({ success: true, data: result })
  } catch (err) {
    console.error('[Contractors] Excel parse error:', err)
    return c.json({ error: 'PARSE_ERROR', message: 'Failed to parse Excel file. Check format.' }, 400)
  }
})

/** POST /clients/:clientId/contractors/bulk-save */
clientContractorsRoute.post(
  '/:clientId/contractors/bulk-save',
  zValidator('json', bulkSaveContractorsSchema),
  async (c) => {
    const user = c.get('user')
    const { clientId } = c.req.param()
    const { contractors, taxYear } = c.req.valid('json')

    const client = await verifyBusinessClient(clientId, user)
    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Business client not found' }, 404)
    }

    const businessId = await findBusinessIdForClient(clientId)
    if (!businessId) {
      return c.json({ error: 'TRANSITION_ERROR', message: 'No legacy Business record found for this client. Required during transition.' }, 400)
    }

    try {
      const saved = await prisma.$transaction(async (tx) => {
        const results = []
        for (const contractor of contractors) {
          const ssnDigits = contractor.ssn.replace(/\D/g, '')
          const ssnLast4 = ssnDigits.slice(-4)
          const ssnEncrypted = encryptSSN(ssnDigits)

          const created = await tx.contractor.create({
            data: {
              clientId, businessId,
              firstName: contractor.firstName, lastName: contractor.lastName,
              tinType: contractor.tinType, ssnEncrypted, ssnLast4,
              address: contractor.address, city: contractor.city,
              state: contractor.state, zip: contractor.zip,
              email: contractor.email || null,
            },
            select: { id: true, firstName: true, lastName: true, ssnLast4: true },
          })

          if (contractor.amountPaid > 0) {
            await tx.form1099NEC.create({
              data: { contractorId: created.id, taxYear, amountBox1: contractor.amountPaid },
            })
          }

          results.push(created)
        }
        return results
      })

      logProfileChanges(
        clientId,
        saved.map((s) => ({
          field: 'contractor_ssn_encrypted',
          oldValue: null,
          newValue: `[ENCRYPTED] contractor:${s.id}`,
        })),
        user.staffId ?? undefined
      ).catch((err) => console.error('[Contractors] Audit log error:', err))

      console.log(`[Contractors] Bulk saved ${saved.length} contractors (year ${taxYear}) for client ${clientId} by staff ${user.staffId}`)
      return c.json({ success: true, count: saved.length, data: saved }, 201)
    } catch (err) {
      console.error('[Contractors] Bulk save error:', err)
      return c.json({ error: 'SAVE_ERROR', message: 'Failed to save contractors' }, 500)
    }
  }
)

export { clientContractorsRoute }
