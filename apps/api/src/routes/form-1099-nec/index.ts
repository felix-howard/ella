/**
 * 1099-NEC Form Routes
 * TaxBandits API integration: create, fetch PDFs, transmit, status
 * Nested under /clients/:clientId/1099-nec
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'
import { buildClientScopeFilter } from '../../lib/org-scope'
import { decryptSSN } from '../../services/crypto'
import { taxbanditsClient } from '../../services/taxbandits-client'
import { uploadFile, getSignedDownloadUrl } from '../../services/storage'
import type { AuthVariables } from '../../middleware/auth'
import { requireOrgAdmin } from '../../middleware/auth'
import type { Form1099Status, FilingStatus } from '@ella/db'

const form1099NecRoute = new Hono<{ Variables: AuthVariables }>()

/**
 * GET /clients/:clientId/1099-nec/status
 * Get form status counts for the actions panel
 */
form1099NecRoute.get('/:clientId/1099-nec/status', async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  const client = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    select: { id: true, clientType: true },
  })

  if (!client || client.clientType !== 'BUSINESS') {
    return c.json({ error: 'Business client not found' }, 404)
  }

  const forms = await prisma.form1099NEC.findMany({
    where: { contractor: { clientId } },
    select: { status: true },
  })

  const counts = {
    draft: 0,
    validated: 0,
    imported: 0,
    pdfReady: 0,
    submitted: 0,
    accepted: 0,
    rejected: 0,
    total: forms.length,
  }

  for (const form of forms) {
    switch (form.status) {
      case 'DRAFT': counts.draft++; break
      case 'VALIDATED': counts.validated++; break
      case 'IMPORTED': counts.imported++; break
      case 'PDF_READY': counts.pdfReady++; break
      case 'SUBMITTED': counts.submitted++; break
      case 'ACCEPTED': counts.accepted++; break
      case 'REJECTED': counts.rejected++; break
    }
  }

  return c.json({ data: counts })
})

/**
 * POST /clients/:clientId/1099-nec/create
 * Create all DRAFT forms in TaxBandits (unified: replaces old validate + import)
 */
form1099NecRoute.post('/:clientId/1099-nec/create', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  if (!config.taxbandits.isConfigured) {
    return c.json({ error: 'TaxBandits API is not configured' }, 503)
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    include: {
      contractors: {
        include: {
          forms: { where: { status: 'DRAFT' as Form1099Status } },
        },
      },
    },
  })

  if (!client || client.clientType !== 'BUSINESS') {
    return c.json({ error: 'Business client not found' }, 404)
  }

  if (!client.einEncrypted || !client.businessName || !client.businessAddress || !client.businessCity || !client.businessState || !client.businessZip) {
    return c.json({ error: 'Complete business info (name, EIN, address) required' }, 400)
  }

  const contractorsWithForms = client.contractors.filter((c) => c.forms.length > 0)
  if (contractorsWithForms.length === 0) {
    return c.json({ error: 'No draft forms to create' }, 400)
  }

  // All forms must be same tax year for a single submission
  const taxYears = [...new Set(contractorsWithForms.flatMap((c) => c.forms.map((f) => f.taxYear)))]
  if (taxYears.length > 1) {
    return c.json({ error: 'Cannot submit forms from multiple tax years' }, 400)
  }

  // Pre-flight auth check
  try {
    await taxbanditsClient.checkAuth()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TaxBandits authentication failed'
    console.error(`[TaxBandits] Pre-flight auth failed: ${message}`)
    return c.json({ error: `TaxBandits authentication failed: ${message}` }, 502)
  }

  // Build recipients list with form mapping (Sequence -> formId for correlation)
  const recipientMap: Array<{ formId: string; contractorId: string }> = []
  const recipients = contractorsWithForms.flatMap((contractor) =>
    contractor.forms.map((form) => {
      recipientMap.push({ formId: form.id, contractorId: contractor.id })
      return {
        name: `${contractor.firstName} ${contractor.lastName}`,
        tinType: 'SSN' as const,
        tin: decryptSSN(contractor.ssnEncrypted).replace(/-/g, ''),
        address1: contractor.address,
        city: contractor.city,
        state: contractor.state,
        zip: contractor.zip,
        email: contractor.email || undefined,
        amountBox1: Number(form.amountBox1),
        amountBox4: Number(form.amountBox4),
      }
    })
  )

  let response
  try {
    response = await taxbanditsClient.createForm1099NEC({
      taxYear: taxYears[0],
      payer: {
        businessName: client.businessName,
        ein: decryptSSN(client.einEncrypted).replace(/-/g, ''),
        address1: client.businessAddress,
        city: client.businessCity,
        state: client.businessState,
        zip: client.businessZip,
      },
      recipients,
    })
  } catch (error) {
    console.error('[1099-NEC] Create failed:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create forms in TaxBandits',
    }, 502)
  }

  // Create FilingBatch
  const batch = await prisma.filingBatch.create({
    data: {
      clientId,
      taxYear: taxYears[0],
      status: 'PENDING',
      totalForms: response.Form1099Records.SuccessRecords.length,
      taxbanditsSubmissionId: response.SubmissionId,
    },
  })

  // Update successful forms with RecordIds (correlate via Sequence index)
  if (response.Form1099Records.SuccessRecords.length > 0) {
    await prisma.$transaction(
      response.Form1099Records.SuccessRecords.map((record) => {
        const seqIndex = parseInt(record.Sequence, 10) - 1
        const mapping = recipientMap[seqIndex]
        return prisma.form1099NEC.update({
          where: { id: mapping.formId },
          data: {
            taxbanditsRecordId: record.RecordId,
            status: 'IMPORTED',
            batchId: batch.id,
          },
        })
      })
    )
  }

  // Collect errors for response
  const errors = response.Form1099Records.ErrorRecords.map((err) => ({
    sequence: err.Sequence,
    errors: err.Errors.map((e) => `${e.Code}: ${e.Message}${e.FieldName ? ` (${e.FieldName})` : ''}`),
  }))

  return c.json({
    success: true,
    batchId: batch.id,
    createdCount: response.Form1099Records.SuccessRecords.length,
    ...(errors.length > 0 ? { errors } : {}),
  })
})

/**
 * POST /clients/:clientId/1099-nec/fetch-pdfs
 * Fetch draft PDFs from TaxBandits and store in R2
 */
form1099NecRoute.post('/:clientId/1099-nec/fetch-pdfs', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  if (!config.taxbandits.isConfigured) {
    return c.json({ error: 'TaxBandits API is not configured' }, 503)
  }

  const accessCheck = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    select: { id: true },
  })
  if (!accessCheck) {
    return c.json({ error: 'Client not found' }, 404)
  }

  const forms = await prisma.form1099NEC.findMany({
    where: {
      contractor: { clientId },
      status: 'IMPORTED',
      taxbanditsRecordId: { not: null },
      batch: { taxbanditsSubmissionId: { not: null } },
    },
    include: { contractor: true, batch: true },
  })

  if (forms.length === 0) {
    return c.json({ error: 'No created forms to fetch PDFs for' }, 400)
  }

  let pdfCount = 0
  const errors: string[] = []

  // Process PDFs in parallel batches of 5
  const CONCURRENCY = 5
  for (let i = 0; i < forms.length; i += CONCURRENCY) {
    const batch = forms.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(async (form) => {
        const pdfResponse = await taxbanditsClient.requestDraftPdf(
          form.batch!.taxbanditsSubmissionId!,
          form.taxbanditsRecordId!
        )

        const pdfFetch = await fetch(pdfResponse.DraftPdfUrl)
        if (!pdfFetch.ok) {
          throw new Error(`PDF download failed: ${pdfFetch.status}`)
        }
        const pdfBuffer = Buffer.from(await pdfFetch.arrayBuffer())

        const key = `1099-nec/${clientId}/${form.taxYear}/${form.contractor.id}.pdf`
        await uploadFile(key, pdfBuffer, 'application/pdf')

        await prisma.form1099NEC.update({
          where: { id: form.id },
          data: { pdfStorageKey: key, status: 'PDF_READY' },
        })

        return form.id
      })
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      if (result.status === 'fulfilled') {
        pdfCount++
      } else {
        const msg = `Form ${batch[j].id}: ${result.reason instanceof Error ? result.reason.message : 'PDF fetch failed'}`
        console.error(`[1099-NEC] ${msg}`)
        errors.push(msg)
      }
    }
  }

  return c.json({
    success: pdfCount > 0,
    pdfCount,
    ...(errors.length > 0 ? { errors } : {}),
  })
})

/**
 * GET /clients/:clientId/1099-nec/:formId/pdf
 * Download PDF from R2 (returns signed URL, 5-min expiry for SSN docs)
 */
form1099NecRoute.get('/:clientId/1099-nec/:formId/pdf', async (c) => {
  const user = c.get('user')
  const { clientId, formId } = c.req.param()

  const accessCheck = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    select: { id: true },
  })
  if (!accessCheck) {
    return c.json({ error: 'Client not found' }, 404)
  }

  const form = await prisma.form1099NEC.findFirst({
    where: {
      id: formId,
      contractor: { clientId },
      pdfStorageKey: { not: null },
    },
    include: { contractor: true },
  })

  if (!form || !form.pdfStorageKey) {
    return c.json({ error: 'PDF not found' }, 404)
  }

  const signedUrl = await getSignedDownloadUrl(form.pdfStorageKey, 300)

  if (!signedUrl) {
    return c.json({ error: 'Failed to generate download URL' }, 500)
  }

  return c.json({
    url: signedUrl,
    filename: `1099-NEC-${form.taxYear}-${form.contractor.lastName}.pdf`,
  })
})

// ============================================
// Transmit & Filing Batch Endpoints
// ============================================

/**
 * POST /clients/:clientId/1099-nec/transmit
 * Transmit PDF-ready forms to IRS via TaxBandits
 */
form1099NecRoute.post('/:clientId/1099-nec/transmit', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  if (!config.taxbandits.isConfigured) {
    return c.json({ error: 'TaxBandits API is not configured' }, 503)
  }

  const accessCheck = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    select: { id: true },
  })
  if (!accessCheck) {
    return c.json({ error: 'Client not found' }, 404)
  }

  const forms = await prisma.form1099NEC.findMany({
    where: {
      contractor: { clientId },
      status: 'PDF_READY' as Form1099Status,
      taxbanditsRecordId: { not: null },
    },
    include: { batch: true },
  })

  if (forms.length === 0) {
    return c.json({ error: 'No forms ready for transmission' }, 400)
  }

  // Get unique batch (should be one)
  const batch = forms[0].batch
  if (!batch?.taxbanditsSubmissionId) {
    return c.json({ error: 'Batch submission ID missing' }, 500)
  }

  const recordIds = forms.map((f) => f.taxbanditsRecordId!)

  try {
    await taxbanditsClient.transmit(batch.taxbanditsSubmissionId, recordIds)

    await prisma.filingBatch.update({
      where: { id: batch.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    })

    const now = new Date()
    await prisma.form1099NEC.updateMany({
      where: { id: { in: forms.map((f) => f.id) } },
      data: {
        status: 'SUBMITTED',
        efileSubmittedAt: now,
        efileStatus: 'TRANSMITTED',
      },
    })

    return c.json({
      success: true,
      batchId: batch.id,
      transmittedCount: forms.length,
    })
  } catch (error) {
    await prisma.filingBatch.update({
      where: { id: batch.id },
      data: {
        status: 'REJECTED',
        rejectionReason: error instanceof Error ? error.message : 'Transmission failed',
        rejectedAt: new Date(),
      },
    })

    console.error('[1099-NEC] Transmit failed:', error)
    return c.json({
      success: false,
      batchId: batch.id,
      error: error instanceof Error ? error.message : 'Transmission failed',
    }, 500)
  }
})

/**
 * GET /clients/:clientId/1099-nec/batches
 * List filing batches for a client
 */
form1099NecRoute.get('/:clientId/1099-nec/batches', async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  const accessCheck = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    select: { id: true },
  })
  if (!accessCheck) {
    return c.json({ error: 'Client not found' }, 404)
  }

  const batches = await prisma.filingBatch.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { forms: true } },
    },
  })

  return c.json({ data: batches })
})

/**
 * GET /clients/:clientId/1099-nec/batches/:batchId
 * Get batch details with form statuses
 */
form1099NecRoute.get('/:clientId/1099-nec/batches/:batchId', async (c) => {
  const user = c.get('user')
  const { clientId, batchId } = c.req.param()

  const accessCheck = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    select: { id: true },
  })
  if (!accessCheck) {
    return c.json({ error: 'Client not found' }, 404)
  }

  const batch = await prisma.filingBatch.findFirst({
    where: { id: batchId, clientId },
    include: {
      forms: {
        include: {
          contractor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  })

  if (!batch) {
    return c.json({ error: 'Batch not found' }, 404)
  }

  return c.json({ data: batch })
})

/**
 * POST /clients/:clientId/1099-nec/batches/:batchId/refresh
 * Refresh batch status from TaxBandits API
 */
form1099NecRoute.post('/:clientId/1099-nec/batches/:batchId/refresh', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { clientId, batchId } = c.req.param()

  if (!config.taxbandits.isConfigured) {
    return c.json({ error: 'TaxBandits API is not configured' }, 503)
  }

  const accessCheck = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    select: { id: true },
  })
  if (!accessCheck) {
    return c.json({ error: 'Client not found' }, 404)
  }

  const batch = await prisma.filingBatch.findFirst({
    where: { id: batchId, clientId },
    include: { forms: true },
  })

  if (!batch?.taxbanditsSubmissionId) {
    return c.json({ error: 'Batch not found or not submitted' }, 404)
  }

  const recordIds = batch.forms
    .filter((f) => f.taxbanditsRecordId)
    .map((f) => f.taxbanditsRecordId!)

  if (recordIds.length === 0) {
    return c.json({ error: 'No forms with record IDs to check' }, 400)
  }

  const statusResponse = await taxbanditsClient.getStatus(
    batch.taxbanditsSubmissionId,
    recordIds
  )

  // Update individual form statuses from response
  if (statusResponse.Form1099Records?.length > 0) {
    await prisma.$transaction(
      statusResponse.Form1099Records.map((record) => {
        const mapped = mapTaxBanditsFormStatus(record.FederalFilingStatus)
        return prisma.form1099NEC.updateMany({
          where: { taxbanditsRecordId: record.RecordId },
          data: { efileStatus: record.FederalFilingStatus, status: mapped },
        })
      })
    )
  }

  // Derive batch status from form statuses
  const formStatuses = statusResponse.Form1099Records?.map((r) => r.FederalFilingStatus) || []
  const newBatchStatus = deriveBatchStatus(formStatuses)
  const acceptedCount = formStatuses.filter((s) => s === 'ACCEPTED').length
  const rejectedCount = formStatuses.filter((s) => s === 'REJECTED').length

  await prisma.filingBatch.update({
    where: { id: batchId },
    data: {
      status: newBatchStatus,
      acceptedForms: acceptedCount,
      rejectedForms: rejectedCount,
      acceptedAt: newBatchStatus === 'ACCEPTED' ? new Date() : batch.acceptedAt,
      rejectedAt: newBatchStatus === 'REJECTED' ? new Date() : batch.rejectedAt,
    },
  })

  return c.json({ success: true, status: newBatchStatus })
})

function mapTaxBanditsFormStatus(status: string): Form1099Status {
  switch (status.toUpperCase()) {
    case 'ACCEPTED': return 'ACCEPTED'
    case 'REJECTED': return 'REJECTED'
    case 'TRANSMITTED':
    case 'UNDER_PROCESSING':
    case 'SENT_TO_AGENCY': return 'SUBMITTED'
    case 'CREATED': return 'IMPORTED'
    default:
      console.warn(`[TaxBandits] Unknown form status: ${status}`)
      return 'SUBMITTED'
  }
}

function deriveBatchStatus(statuses: string[]): FilingStatus {
  if (statuses.length === 0) return 'SUBMITTED'
  const upper = statuses.map((s) => s.toUpperCase())
  if (upper.every((s) => s === 'ACCEPTED')) return 'ACCEPTED'
  if (upper.every((s) => s === 'REJECTED')) return 'REJECTED'
  if (upper.some((s) => s === 'ACCEPTED') && upper.some((s) => s === 'REJECTED')) return 'PARTIALLY_ACCEPTED'
  if (upper.some((s) => ['TRANSMITTED', 'UNDER_PROCESSING', 'SENT_TO_AGENCY'].includes(s))) return 'PROCESSING'
  return 'SUBMITTED'
}

export { form1099NecRoute }
