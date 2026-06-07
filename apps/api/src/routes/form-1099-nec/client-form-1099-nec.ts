/**
 * 1099-NEC Form Routes (new: under /clients/:clientId/1099-nec)
 * clientId must be a BUSINESS-type Client (enforced by verifyBusinessClient)
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'
import { verifyBusinessClient } from '../../lib/org-scope'
import { taxbanditsClient } from '../../services/taxbandits-client'
import { getBusinessClientForFiling, createFormsInTaxBandits, fetchDraftPdfs } from './shared-helpers'
import type { AuthVariables } from '../../middleware/auth'
import { requireAdminOrManager } from '../../middleware/auth'
import type { Form1099Status } from '@ella/db'

const clientForm1099NecRoute = new Hono<{ Variables: AuthVariables }>()

/** GET /clients/:clientId/1099-nec/status */
clientForm1099NecRoute.get('/:clientId/1099-nec/status', async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  const client = await verifyBusinessClient(clientId, user)
  if (!client) return c.json({ error: 'Business client not found' }, 404)

  const forms = await prisma.form1099NEC.findMany({
    where: { contractor: { clientId } },
    select: { status: true },
  })

  const counts = {
    draft: 0, validated: 0, imported: 0, pdfReady: 0,
    submitted: 0, accepted: 0, rejected: 0, total: forms.length,
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

/** POST /clients/:clientId/1099-nec/create */
clientForm1099NecRoute.post('/:clientId/1099-nec/create', requireAdminOrManager, async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  if (!config.taxbandits.isConfigured) {
    return c.json({ error: 'TaxBandits API is not configured' }, 503)
  }

  const business = await getBusinessClientForFiling(clientId, user)
  if (!business) return c.json({ error: 'Business client not found or missing required fields' }, 404)

  const contractors = await prisma.contractor.findMany({
    where: { clientId },
    include: { forms: { where: { status: 'DRAFT' as Form1099Status } } },
  })

  const contractorsWithForms = contractors.filter((ct) => ct.forms.length > 0)
  if (contractorsWithForms.length === 0) return c.json({ error: 'No draft forms to create' }, 400)

  const taxYears = [...new Set(contractorsWithForms.flatMap((ct) => ct.forms.map((f) => f.taxYear)))]
  if (taxYears.length > 1) return c.json({ error: 'Cannot submit forms from multiple tax years' }, 400)

  try { await taxbanditsClient.checkAuth() } catch (error) {
    const message = error instanceof Error ? error.message : 'TaxBandits authentication failed'
    return c.json({ error: `TaxBandits authentication failed: ${message}` }, 502)
  }

  try {
    const result = await createFormsInTaxBandits(business, clientId, contractorsWithForms, taxYears[0])
    return c.json({
      success: true, batchId: result.batch.id, createdCount: result.createdCount,
      ...(result.errors.length > 0 ? { errors: result.errors } : {}),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create forms in TaxBandits'
    return c.json({ success: false, error: 'TaxBandits validation failed', message }, 502)
  }
})

/** POST /clients/:clientId/1099-nec/fetch-pdfs */
clientForm1099NecRoute.post('/:clientId/1099-nec/fetch-pdfs', requireAdminOrManager, async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  if (!config.taxbandits.isConfigured) {
    return c.json({ error: 'TaxBandits API is not configured' }, 503)
  }

  const client = await verifyBusinessClient(clientId, user)
  if (!client) return c.json({ error: 'Business client not found' }, 404)

  const { pdfCount, errors } = await fetchDraftPdfs(clientId)
  if (pdfCount === 0 && errors.length === 0) {
    return c.json({ error: 'No created forms to fetch PDFs for' }, 400)
  }

  return c.json({ success: pdfCount > 0, pdfCount, ...(errors.length > 0 ? { errors } : {}) })
})

export { clientForm1099NecRoute }
