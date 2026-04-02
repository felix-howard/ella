/**
 * Contractor CRUD routes
 * Nested under /clients/:clientId/contractors
 * All routes require auth + org scope via parent /clients/* middleware
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import { buildClientScopeFilter } from '../../lib/org-scope'
import { encryptSSN } from '../../services/crypto'
import { logProfileChanges } from '../../services/audit-logger'
import { parseNailSalonExcel } from '../../services/excel-parser'
import { createContractorSchema, updateContractorSchema, bulkSaveContractorsSchema } from './validators'
import type { AuthVariables } from '../../middleware/auth'

const contractorsRoute = new Hono<{ Variables: AuthVariables }>()

/**
 * GET /clients/:clientId/contractors - List contractors for a client
 */
contractorsRoute.get('/:clientId/contractors', async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  // Verify client access (org-scoped)
  const client = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    select: { id: true },
  })

  if (!client) {
    return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
  }

  const contractors = await prisma.contractor.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      ssnLast4: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      email: true,
      phone: true,
      tax1099RecipientId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return c.json({ data: contractors })
})

/**
 * POST /clients/:clientId/contractors - Create contractor
 */
contractorsRoute.post(
  '/:clientId/contractors',
  zValidator('json', createContractorSchema),
  async (c) => {
    const user = c.get('user')
    const { clientId } = c.req.param()
    const data = c.req.valid('json')

    // Verify client access + must be BUSINESS type
    const client = await prisma.client.findFirst({
      where: { id: clientId, ...buildClientScopeFilter(user) },
      select: { id: true, clientType: true },
    })

    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    if (client.clientType !== 'BUSINESS') {
      return c.json({ error: 'INVALID_CLIENT_TYPE', message: 'Contractors can only be added to BUSINESS clients' }, 400)
    }

    // Encrypt SSN and extract last 4
    const ssnDigits = data.ssn.replace(/\D/g, '')
    const ssnLast4 = ssnDigits.slice(-4)
    const ssnEncrypted = encryptSSN(data.ssn)

    const contractor = await prisma.contractor.create({
      data: {
        clientId,
        firstName: data.firstName,
        lastName: data.lastName,
        ssnEncrypted,
        ssnLast4,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        email: data.email,
        phone: data.phone,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        ssnLast4: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        email: true,
        phone: true,
        tax1099RecipientId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Audit log SSN encryption
    void logProfileChanges(
      clientId,
      [{ field: 'contractor_ssn_encrypted', oldValue: null, newValue: `[ENCRYPTED] contractor:${contractor.id}` }],
      user.staffId ?? undefined
    )

    console.log(`[Contractors] Created contractor ${contractor.id} for client ${clientId} by staff ${user.staffId}`)
    return c.json({ data: contractor }, 201)
  }
)

/**
 * PATCH /clients/:clientId/contractors/:id - Update contractor
 */
contractorsRoute.patch(
  '/:clientId/contractors/:id',
  zValidator('json', updateContractorSchema),
  async (c) => {
    const user = c.get('user')
    const { clientId, id } = c.req.param()
    const data = c.req.valid('json')

    // Verify client access
    const client = await prisma.client.findFirst({
      where: { id: clientId, ...buildClientScopeFilter(user) },
      select: { id: true },
    })

    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    // Verify contractor belongs to client
    const existing = await prisma.contractor.findFirst({
      where: { id, clientId },
      select: { id: true },
    })

    if (!existing) {
      return c.json({ error: 'NOT_FOUND', message: 'Contractor not found' }, 404)
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.lastName !== undefined) updateData.lastName = data.lastName
    if (data.address !== undefined) updateData.address = data.address
    if (data.city !== undefined) updateData.city = data.city
    if (data.state !== undefined) updateData.state = data.state
    if (data.zip !== undefined) updateData.zip = data.zip
    if (data.email !== undefined) updateData.email = data.email
    if (data.phone !== undefined) updateData.phone = data.phone

    // Re-encrypt SSN if changed
    if (data.ssn) {
      const ssnDigits = data.ssn.replace(/\D/g, '')
      updateData.ssnLast4 = ssnDigits.slice(-4)
      updateData.ssnEncrypted = encryptSSN(data.ssn)

      // Audit log SSN re-encryption
      void logProfileChanges(
        clientId,
        [{ field: 'contractor_ssn_updated', oldValue: '[ENCRYPTED]', newValue: `[RE-ENCRYPTED] contractor:${id}` }],
        user.staffId ?? undefined
      )
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'VALIDATION_ERROR', message: 'At least one field required' }, 400)
    }

    const contractor = await prisma.contractor.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        ssnLast4: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        email: true,
        phone: true,
        tax1099RecipientId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    console.log(`[Contractors] Updated contractor ${id} for client ${clientId} by staff ${user.staffId}`)
    return c.json({ data: contractor })
  }
)

/**
 * DELETE /clients/:clientId/contractors/:id - Delete contractor
 */
contractorsRoute.delete('/:clientId/contractors/:id', async (c) => {
  const user = c.get('user')
  const { clientId, id } = c.req.param()

  // Verify client access
  const client = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    select: { id: true },
  })

  if (!client) {
    return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
  }

  // Verify contractor belongs to client
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

/**
 * POST /clients/:clientId/contractors/upload-excel - Parse Excel file, return structured data
 */
contractorsRoute.post('/:clientId/contractors/upload-excel', async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  // Verify client access + must be BUSINESS type
  const client = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    select: { id: true, clientType: true },
  })

  if (!client) {
    return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
  }

  if (client.clientType !== 'BUSINESS') {
    return c.json({ error: 'INVALID_CLIENT_TYPE', message: 'Excel upload only for BUSINESS clients' }, 400)
  }

  const body = await c.req.parseBody()
  const file = body['file'] as File | undefined

  if (!file) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'No file uploaded' }, 400)
  }

  // Validate file extension
  const fileName = (file as File & { name?: string }).name || ''
  if (!fileName.match(/\.xlsx?$/i)) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid file type. Upload .xlsx or .xls file.' }, 400)
  }

  // Validate MIME type (if provided — some clients omit it)
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ]
  if (file.type && !validTypes.includes(file.type)) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid file type. Upload .xlsx or .xls file.' }, 400)
  }

  // Validate size (5MB max)
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

/**
 * POST /clients/:clientId/contractors/bulk-save - Save reviewed contractors from Excel
 */
contractorsRoute.post(
  '/:clientId/contractors/bulk-save',
  zValidator('json', bulkSaveContractorsSchema),
  async (c) => {
    const user = c.get('user')
    const { clientId } = c.req.param()
    const { contractors, taxYear } = c.req.valid('json')

    // Verify client access + must be BUSINESS type
    const client = await prisma.client.findFirst({
      where: { id: clientId, ...buildClientScopeFilter(user) },
      select: { id: true, clientType: true },
    })

    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    if (client.clientType !== 'BUSINESS') {
      return c.json({ error: 'INVALID_CLIENT_TYPE', message: 'Bulk save only for BUSINESS clients' }, 400)
    }

    try {
      const saved = await prisma.$transaction(
        contractors.map((contractor) => {
          const ssnDigits = contractor.ssn.replace(/\D/g, '')
          const ssnLast4 = ssnDigits.slice(-4)
          const ssnEncrypted = encryptSSN(ssnDigits)

          return prisma.contractor.create({
            data: {
              clientId,
              firstName: contractor.firstName,
              lastName: contractor.lastName,
              ssnEncrypted,
              ssnLast4,
              address: contractor.address,
              city: contractor.city,
              state: contractor.state,
              zip: contractor.zip,
              email: contractor.email || null,
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              ssnLast4: true,
            },
          })
        })
      )

      // Audit log bulk SSN encryption
      void logProfileChanges(
        clientId,
        saved.map((s) => ({
          field: 'contractor_ssn_encrypted',
          oldValue: null,
          newValue: `[ENCRYPTED] contractor:${s.id}`,
        })),
        user.staffId ?? undefined
      )

      console.log(`[Contractors] Bulk saved ${saved.length} contractors (year ${taxYear}) for client ${clientId} by staff ${user.staffId}`)
      return c.json({ success: true, count: saved.length, data: saved }, 201)
    } catch (err) {
      console.error('[Contractors] Bulk save error:', err)
      return c.json({ error: 'SAVE_ERROR', message: 'Failed to save contractors' }, 500)
    }
  }
)

export { contractorsRoute }
