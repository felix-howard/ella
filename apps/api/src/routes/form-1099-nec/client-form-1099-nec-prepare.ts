/**
 * 1099-NEC Prepare Route (combined Create + Fetch PDFs)
 * New: under /clients/:clientId/1099-nec/prepare
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'
import { verifyBusinessClient } from '../../lib/org-scope'
import { taxbanditsClient } from '../../services/taxbandits-client'
import { findBusinessIdForClient } from '../contractors/find-business-id'
import { createFormsInTaxBandits, fetchDraftPdfs } from './shared-helpers'
import type { AuthVariables } from '../../middleware/auth'
import { requireOrgAdmin } from '../../middleware/auth'
import type { Form1099Status } from '@ella/db'

const clientForm1099NecPrepareRoute = new Hono<{ Variables: AuthVariables }>()

/** POST /clients/:clientId/1099-nec/prepare — One-click: Create + Fetch PDFs */
clientForm1099NecPrepareRoute.post('/:clientId/1099-nec/prepare', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  if (!config.taxbandits.isConfigured) {
    return c.json({ error: 'TaxBandits API is not configured' }, 503)
  }

  const client = await verifyBusinessClient(clientId, user)
  if (!client) return c.json({ error: 'Business client not found' }, 404)

  const businessId = await findBusinessIdForClient(clientId)
  if (!businessId) return c.json({ error: 'No linked business record found' }, 404)

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, einEncrypted: true, address: true, city: true, state: true, zip: true },
  })
  if (!business) return c.json({ error: 'Business record not found' }, 404)

  const contractors = await prisma.contractor.findMany({
    where: { clientId },
    include: { forms: { where: { status: 'DRAFT' as Form1099Status } } },
  })

  const contractorsWithForms = contractors.filter((ct) => ct.forms.length > 0)
  if (contractorsWithForms.length === 0) return c.json({ error: 'No draft forms to prepare' }, 400)

  const taxYears = [...new Set(contractorsWithForms.flatMap((ct) => ct.forms.map((f) => f.taxYear)))]
  if (taxYears.length > 1) return c.json({ error: 'Cannot submit forms from multiple tax years' }, 400)

  try { await taxbanditsClient.checkAuth() } catch (error) {
    const message = error instanceof Error ? error.message : 'TaxBandits authentication failed'
    return c.json({ error: `TaxBandits authentication failed: ${message}` }, 502)
  }

  // Step 1: Create forms in TaxBandits
  let createResult
  try {
    createResult = await createFormsInTaxBandits(business, clientId, contractorsWithForms, taxYears[0])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create forms in TaxBandits'
    return c.json({ error: `Form creation failed: ${message}` }, 502)
  }

  if (createResult.createdCount === 0) {
    return c.json({
      success: false, step: 'create', createdCount: 0, pdfCount: 0, errors: createResult.errors,
    })
  }

  // Step 2: Fetch PDFs
  const pdfResult = await fetchDraftPdfs(clientId)

  return c.json({
    success: true,
    createdCount: createResult.createdCount,
    pdfCount: pdfResult.pdfCount,
    batchId: createResult.batch.id,
    ...(createResult.errors.length > 0 ? { createErrors: createResult.errors } : {}),
    ...(pdfResult.errors.length > 0 ? { pdfErrors: pdfResult.errors } : {}),
  })
})

export { clientForm1099NecPrepareRoute }
