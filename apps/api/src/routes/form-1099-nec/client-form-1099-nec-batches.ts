/**
 * 1099-NEC Transmit & Batch Routes (new: under /clients/:clientId/1099-nec)
 * clientId must be a BUSINESS-type Client (enforced by verifyBusinessClient)
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'
import { verifyBusinessClient } from '../../lib/org-scope'
import { taxbanditsClient } from '../../services/taxbandits-client'
import { fetchRecipientPdfs, mapTaxBanditsFormStatus, deriveBatchStatus } from './shared-helpers'
import type { AuthVariables } from '../../middleware/auth'
import { requireOrgAdmin } from '../../middleware/auth'
import type { Form1099Status } from '@ella/db'

const clientForm1099NecBatchesRoute = new Hono<{ Variables: AuthVariables }>()

/** POST /clients/:clientId/1099-nec/transmit */
clientForm1099NecBatchesRoute.post('/:clientId/1099-nec/transmit', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  if (!config.taxbandits.isConfigured) {
    return c.json({ error: 'TaxBandits API is not configured' }, 503)
  }

  const client = await verifyBusinessClient(clientId, user)
  if (!client) return c.json({ error: 'Business client not found' }, 404)

  const forms = await prisma.form1099NEC.findMany({
    where: {
      contractor: { clientId },
      status: 'PDF_READY' as Form1099Status,
      taxbanditsRecordId: { not: null },
    },
    include: { batch: true },
  })

  if (forms.length === 0) return c.json({ error: 'No forms ready for transmission' }, 400)

  const batchIds = [...new Set(forms.map((f) => f.batch?.id).filter(Boolean))]
  if (batchIds.length > 1) {
    return c.json({ error: 'Forms span multiple batches. Transmit one batch at a time.' }, 400)
  }

  const batch = forms[0].batch
  if (!batch?.taxbanditsSubmissionId) return c.json({ error: 'Batch submission ID missing' }, 500)

  const recordIds = forms.map((f) => f.taxbanditsRecordId!)

  try {
    await taxbanditsClient.transmit(batch.taxbanditsSubmissionId, recordIds)

    await prisma.filingBatch.update({
      where: { id: batch.id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    })

    await prisma.form1099NEC.updateMany({
      where: { id: { in: forms.map((f) => f.id) } },
      data: { status: 'SUBMITTED', efileSubmittedAt: new Date(), efileStatus: 'TRANSMITTED' },
    })

    const recipientResult = await fetchRecipientPdfs(clientId)

    return c.json({
      success: true, batchId: batch.id, transmittedCount: forms.length,
      recipientPdfCount: recipientResult.pdfCount,
      ...(recipientResult.errors.length > 0 ? { recipientErrors: recipientResult.errors } : {}),
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
    return c.json({
      success: false, batchId: batch.id,
      error: error instanceof Error ? error.message : 'Transmission failed',
    }, 500)
  }
})

/** GET /clients/:clientId/1099-nec/batches */
clientForm1099NecBatchesRoute.get('/:clientId/1099-nec/batches', async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  const client = await verifyBusinessClient(clientId, user)
  if (!client) return c.json({ error: 'Business client not found' }, 404)

  const batches = await prisma.filingBatch.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { forms: true } } },
  })

  return c.json({ data: batches })
})

/** GET /clients/:clientId/1099-nec/batches/:batchId */
clientForm1099NecBatchesRoute.get('/:clientId/1099-nec/batches/:batchId', async (c) => {
  const user = c.get('user')
  const { clientId, batchId } = c.req.param()

  const client = await verifyBusinessClient(clientId, user)
  if (!client) return c.json({ error: 'Business client not found' }, 404)

  const batch = await prisma.filingBatch.findFirst({
    where: { id: batchId, clientId },
    include: {
      forms: {
        include: { contractor: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
    },
  })

  if (!batch) return c.json({ error: 'Batch not found' }, 404)
  return c.json({ data: batch })
})

/** POST /clients/:clientId/1099-nec/batches/:batchId/refresh */
clientForm1099NecBatchesRoute.post('/:clientId/1099-nec/batches/:batchId/refresh', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { clientId, batchId } = c.req.param()

  if (!config.taxbandits.isConfigured) {
    return c.json({ error: 'TaxBandits API is not configured' }, 503)
  }

  const client = await verifyBusinessClient(clientId, user)
  if (!client) return c.json({ error: 'Business client not found' }, 404)

  const batch = await prisma.filingBatch.findFirst({
    where: { id: batchId, clientId },
    include: { forms: true },
  })

  if (!batch?.taxbanditsSubmissionId) {
    return c.json({ error: 'Batch not found or not submitted' }, 404)
  }

  const recordIds = batch.forms.filter((f) => f.taxbanditsRecordId).map((f) => f.taxbanditsRecordId!)
  if (recordIds.length === 0) return c.json({ error: 'No forms with record IDs to check' }, 400)

  const statusResponse = await taxbanditsClient.getStatus(batch.taxbanditsSubmissionId, recordIds)

  if (statusResponse.Form1099Records?.length > 0) {
    await prisma.$transaction(
      statusResponse.Form1099Records.map((record: { RecordId: string; FederalFilingStatus: string }) => {
        const mapped = mapTaxBanditsFormStatus(record.FederalFilingStatus)
        return prisma.form1099NEC.updateMany({
          where: { taxbanditsRecordId: record.RecordId, contractor: { clientId } },
          data: { efileStatus: record.FederalFilingStatus, status: mapped },
        })
      })
    )
  }

  const formStatuses = statusResponse.Form1099Records?.map((r: { FederalFilingStatus: string }) => r.FederalFilingStatus) || []
  const newBatchStatus = deriveBatchStatus(formStatuses)
  const acceptedCount = formStatuses.filter((s: string) => s === 'ACCEPTED').length
  const rejectedCount = formStatuses.filter((s: string) => s === 'REJECTED').length

  await prisma.filingBatch.update({
    where: { id: batchId },
    data: {
      status: newBatchStatus,
      acceptedForms: acceptedCount, rejectedForms: rejectedCount,
      acceptedAt: newBatchStatus === 'ACCEPTED' ? new Date() : batch.acceptedAt,
      rejectedAt: newBatchStatus === 'REJECTED' ? new Date() : batch.rejectedAt,
    },
  })

  return c.json({ success: true, status: newBatchStatus })
})

export { clientForm1099NecBatchesRoute }
