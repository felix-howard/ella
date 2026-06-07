/**
 * 1099-NEC PDF Routes (new: under /clients/:clientId/1099-nec)
 * clientId must be a BUSINESS-type Client (enforced by verifyBusinessClient)
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'
import { verifyBusinessClient } from '../../lib/org-scope'
import { getSignedDownloadUrl } from '../../services/storage'
import { fetchRecipientPdfs } from './shared-helpers'
import type { AuthVariables } from '../../middleware/auth'
import { requireAdminOrManager } from '../../middleware/auth'

const clientForm1099NecPdfsRoute = new Hono<{ Variables: AuthVariables }>()

/** POST /clients/:clientId/1099-nec/fetch-recipient-pdfs */
clientForm1099NecPdfsRoute.post('/:clientId/1099-nec/fetch-recipient-pdfs', requireAdminOrManager, async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  if (!config.taxbandits.isConfigured) {
    return c.json({ error: 'TaxBandits API is not configured' }, 503)
  }

  const client = await verifyBusinessClient(clientId, user)
  if (!client) return c.json({ error: 'Business client not found' }, 404)

  const { pdfCount, errors } = await fetchRecipientPdfs(clientId)
  if (pdfCount === 0 && errors.length === 0) {
    return c.json({ error: 'No transmitted forms to fetch recipient PDFs for' }, 400)
  }

  return c.json({ success: pdfCount > 0, pdfCount, ...(errors.length > 0 ? { errors } : {}) })
})

/** GET /clients/:clientId/1099-nec/pdfs/recipient */
clientForm1099NecPdfsRoute.get('/:clientId/1099-nec/pdfs/recipient', async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  const client = await verifyBusinessClient(clientId, user)
  if (!client) return c.json({ error: 'Business client not found' }, 404)

  const forms = await prisma.form1099NEC.findMany({
    where: { contractor: { clientId }, copyBStorageKey: { not: null } },
    include: { contractor: { select: { firstName: true, lastName: true } } },
  })

  const pdfs = await Promise.all(
    forms.map(async (form) => {
      const url = await getSignedDownloadUrl(form.copyBStorageKey!, 300)
      return {
        formId: form.id, url,
        filename: `1099-NEC-${form.taxYear}-CopyB-${form.contractor.lastName}-${form.contractor.firstName}.pdf`,
      }
    })
  )
  return c.json({ data: pdfs.filter((p) => p.url) })
})

/** GET /clients/:clientId/1099-nec/pdfs */
clientForm1099NecPdfsRoute.get('/:clientId/1099-nec/pdfs', async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  const client = await verifyBusinessClient(clientId, user)
  if (!client) return c.json({ error: 'Business client not found' }, 404)

  const forms = await prisma.form1099NEC.findMany({
    where: {
      contractor: { clientId }, pdfStorageKey: { not: null },
      status: { in: ['PDF_READY', 'SUBMITTED', 'ACCEPTED'] },
    },
    include: { contractor: { select: { firstName: true, lastName: true } } },
  })

  const pdfs = await Promise.all(
    forms.map(async (form) => {
      const url = await getSignedDownloadUrl(form.pdfStorageKey!, 300)
      return {
        formId: form.id, url,
        filename: `1099-NEC-${form.taxYear}-${form.contractor.lastName}-${form.contractor.firstName}.pdf`,
      }
    })
  )
  return c.json({ data: pdfs.filter((p) => p.url) })
})

/** GET /clients/:clientId/1099-nec/:formId/pdf */
clientForm1099NecPdfsRoute.get('/:clientId/1099-nec/:formId/pdf', async (c) => {
  const user = c.get('user')
  const { clientId, formId } = c.req.param()

  const client = await verifyBusinessClient(clientId, user)
  if (!client) return c.json({ error: 'Business client not found' }, 404)

  const form = await prisma.form1099NEC.findFirst({
    where: { id: formId, contractor: { clientId }, pdfStorageKey: { not: null } },
    include: { contractor: true },
  })

  if (!form?.pdfStorageKey) return c.json({ error: 'PDF not found' }, 404)
  const signedUrl = await getSignedDownloadUrl(form.pdfStorageKey, 300)
  if (!signedUrl) return c.json({ error: 'Failed to generate download URL' }, 500)

  return c.json({ url: signedUrl, filename: `1099-NEC-${form.taxYear}-${form.contractor.lastName}.pdf` })
})

/** GET /clients/:clientId/1099-nec/:formId/pdf/recipient */
clientForm1099NecPdfsRoute.get('/:clientId/1099-nec/:formId/pdf/recipient', async (c) => {
  const user = c.get('user')
  const { clientId, formId } = c.req.param()

  const client = await verifyBusinessClient(clientId, user)
  if (!client) return c.json({ error: 'Business client not found' }, 404)

  const form = await prisma.form1099NEC.findFirst({
    where: { id: formId, contractor: { clientId }, copyBStorageKey: { not: null } },
    include: { contractor: true },
  })

  if (!form?.copyBStorageKey) return c.json({ error: 'Recipient PDF not found' }, 404)
  const signedUrl = await getSignedDownloadUrl(form.copyBStorageKey, 300)
  if (!signedUrl) return c.json({ error: 'Failed to generate download URL' }, 500)

  return c.json({ url: signedUrl, filename: `1099-NEC-${form.taxYear}-CopyB-${form.contractor.lastName}.pdf` })
})

export { clientForm1099NecPdfsRoute }
