/**
 * 1099-NEC Form Routes
 * Tax1099 API integration: validate, import, fetch PDFs, download
 * Nested under /clients/:clientId/1099-nec
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'
import { buildClientScopeFilter } from '../../lib/org-scope'
import { decryptSSN } from '../../services/crypto'
import { tax1099Client } from '../../services/tax1099-client'
import { uploadFile, getSignedDownloadUrl } from '../../services/storage'
import type { AuthVariables } from '../../middleware/auth'
import { requireOrgAdmin } from '../../middleware/auth'
import type { Form1099Status, FilingStatus } from '@ella/db'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

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
 * POST /clients/:clientId/1099-nec/validate
 * Validate all DRAFT forms via Tax1099 API
 */
form1099NecRoute.post('/:clientId/1099-nec/validate', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  if (!config.tax1099.isConfigured) {
    return c.json({ error: 'Tax1099 API is not configured' }, 503)
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

  if (!client.einEncrypted) {
    return c.json({ error: 'Client EIN is required for validation' }, 400)
  }

  // Flatten to form+contractor pairs for parallel processing
  const formPairs = client.contractors.flatMap((contractor) =>
    contractor.forms.map((form) => ({ contractor, form }))
  )

  if (formPairs.length === 0) {
    return c.json({ error: 'No draft forms to validate' }, 400)
  }

  // Process with concurrency limit (5 at a time)
  const CONCURRENCY = 5
  const results: Array<{
    contractorId: string
    formId: string
    valid: boolean
    errors: string[]
  }> = []

  for (let i = 0; i < formPairs.length; i += CONCURRENCY) {
    const batch = formPairs.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.allSettled(
      batch.map(async ({ contractor, form }) => {
        const response = await tax1099Client.validateForm({
          clientPayerId: clientId,
          clientRecipientId: contractor.id,
          taxYear: form.taxYear,
          payerTIN: decryptSSN(client.einEncrypted!).replace(/-/g, ''),
          recipientTIN: decryptSSN(contractor.ssnEncrypted).replace(/-/g, ''),
          amtBox1: Number(form.amountBox1),
          amtBox4: Number(form.amountBox4),
        })

        await prisma.form1099NEC.update({
          where: { id: form.id },
          data: {
            status: response.isValid ? 'VALIDATED' : 'DRAFT',
            validationErrors: response.errors || [],
          },
        })

        return {
          contractorId: contractor.id,
          formId: form.id,
          valid: response.isValid,
          errors: response.errors || [],
        }
      })
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        // Extract contractor info from the batch item
        const batchIndex = batchResults.indexOf(result)
        const pair = batch[batchIndex]
        results.push({
          contractorId: pair.contractor.id,
          formId: pair.form.id,
          valid: false,
          errors: [result.reason instanceof Error ? result.reason.message : 'Validation failed'],
        })
      }
    }
  }

  return c.json({ success: true, results })
})

/**
 * POST /clients/:clientId/1099-nec/import
 * Sync payer + recipients + import forms to Tax1099
 */
form1099NecRoute.post('/:clientId/1099-nec/import', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  if (!config.tax1099.isConfigured) {
    return c.json({ error: 'Tax1099 API is not configured' }, 503)
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    include: {
      contractors: {
        include: {
          forms: { where: { status: 'VALIDATED' as Form1099Status } },
        },
      },
    },
  })

  if (!client || client.clientType !== 'BUSINESS') {
    return c.json({ error: 'Business client not found' }, 404)
  }

  if (!client.einEncrypted || !client.businessName || !client.businessAddress || !client.businessCity || !client.businessState || !client.businessZip) {
    return c.json({ error: 'Complete business address and EIN are required' }, 400)
  }

  const contractorsWithForms = client.contractors.filter((c) => c.forms.length > 0)
  if (contractorsWithForms.length === 0) {
    return c.json({ error: 'No validated forms to import' }, 400)
  }

  // Step 1: Save Payer
  await tax1099Client.savePayer({
    clientPayerId: clientId,
    payerName: client.businessName,
    payerTIN: decryptSSN(client.einEncrypted).replace(/-/g, ''),
    tinType: 'Business',
    address1: client.businessAddress,
    city: client.businessCity,
    state: client.businessState,
    zip: client.businessZip,
  })

  // Step 2: Save Recipients (concurrent with limit)
  const CONCURRENCY = 5
  for (let i = 0; i < contractorsWithForms.length; i += CONCURRENCY) {
    const batch = contractorsWithForms.slice(i, i + CONCURRENCY)
    await Promise.allSettled(
      batch.map(async (contractor) => {
        const response = await tax1099Client.saveRecipient({
          clientRecipientId: contractor.id,
          clientPayerId: clientId,
          recipientName: `${contractor.firstName} ${contractor.lastName}`,
          recipientTIN: decryptSSN(contractor.ssnEncrypted).replace(/-/g, ''),
          tinType: 'Individual',
          address1: contractor.address,
          city: contractor.city,
          state: contractor.state,
          zip: contractor.zip,
          email: contractor.email || undefined,
        })

        if (response.recipientId) {
          await prisma.contractor.update({
            where: { id: contractor.id },
            data: { tax1099RecipientId: response.recipientId.toString() },
          })
        }
      })
    )
  }

  // Step 3: Import Forms
  const formsToImport = contractorsWithForms.flatMap((contractor) =>
    contractor.forms.map((f) => ({
      clientPayerId: clientId,
      clientRecipientId: contractor.id,
      taxYear: f.taxYear,
      amtBox1: Number(f.amountBox1),
      amtBox4: Number(f.amountBox4),
    }))
  )

  const importResponse = await tax1099Client.importOnly(formsToImport)

  // Update forms with Tax1099 formIds — match on contractorId + taxYear
  await prisma.$transaction(
    importResponse.forms.map((result) => {
      const originalForm = contractorsWithForms
        .flatMap((c) => c.forms)
        .find(
          (f) =>
            contractorsWithForms.find((c) => c.forms.includes(f))?.id === result.clientRecipientId
        )

      return prisma.form1099NEC.updateMany({
        where: {
          contractorId: result.clientRecipientId,
          status: 'VALIDATED',
          ...(originalForm ? { taxYear: originalForm.taxYear } : {}),
        },
        data: {
          tax1099FormId: result.formId,
          status: 'IMPORTED',
        },
      })
    })
  )

  return c.json({
    success: true,
    importedCount: importResponse.forms.length,
  })
})

/**
 * POST /clients/:clientId/1099-nec/fetch-pdfs
 * Fetch PDFs from Tax1099 and store in R2
 */
form1099NecRoute.post('/:clientId/1099-nec/fetch-pdfs', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()

  if (!config.tax1099.isConfigured) {
    return c.json({ error: 'Tax1099 API is not configured' }, 503)
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
      tax1099FormId: { not: null },
    },
    include: { contractor: true },
  })

  if (forms.length === 0) {
    return c.json({ error: 'No imported forms to fetch PDFs for' }, 400)
  }

  const formIds = forms.map((f) => f.tax1099FormId!)
  const pdfResponse = await tax1099Client.getPdfs(formIds)

  let pdfCount = 0
  const errors: string[] = []

  for (const pdfData of pdfResponse.forms) {
    const form = forms.find((f) => f.tax1099FormId === pdfData.formId)
    if (!form) continue

    try {
      const pdfBuffer = Buffer.from(pdfData.recipientPdf, 'base64')
      const key = `1099-nec/${clientId}/${form.taxYear}/${form.contractor.id}.pdf`

      await uploadFile(key, pdfBuffer, 'application/pdf')

      await prisma.form1099NEC.update({
        where: { id: form.id },
        data: {
          pdfStorageKey: key,
          status: 'PDF_READY',
        },
      })

      pdfCount++
    } catch (error) {
      const msg = `Form ${form.id}: ${error instanceof Error ? error.message : 'PDF store failed'}`
      console.error(`[1099-NEC] ${msg}`)
      errors.push(msg)
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

  // Short expiry (5 min) for SSN-bearing documents
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
// Submit & Filing Batch Endpoints
// ============================================

const submitSchema = z.object({
  tinCheckEnabled: z.boolean().default(true),
  uspsEnabled: z.boolean().default(true),
  eDeliveryEnabled: z.boolean().default(true),
})

/**
 * POST /clients/:clientId/1099-nec/submit
 * Submit PDF-ready forms to IRS via Tax1099
 */
form1099NecRoute.post('/:clientId/1099-nec/submit', requireOrgAdmin, zValidator('json', submitSchema), async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()
  const options = c.req.valid('json')

  if (!config.tax1099.isConfigured) {
    return c.json({ error: 'Tax1099 API is not configured' }, 503)
  }

  const accessCheck = await prisma.client.findFirst({
    where: { id: clientId, ...buildClientScopeFilter(user) },
    select: { id: true },
  })
  if (!accessCheck) {
    return c.json({ error: 'Client not found' }, 404)
  }

  // Get forms ready for submission (PDF_READY status with tax1099FormId)
  const forms = await prisma.form1099NEC.findMany({
    where: {
      contractor: { clientId },
      status: 'PDF_READY' as Form1099Status,
      tax1099FormId: { not: null },
    },
  })

  if (forms.length === 0) {
    return c.json({ error: 'No forms ready for submission' }, 400)
  }

  // Guard: all forms must be same tax year
  const taxYears = [...new Set(forms.map((f) => f.taxYear))]
  if (taxYears.length > 1) {
    return c.json({ error: 'Cannot submit forms from multiple tax years in one batch' }, 400)
  }

  // Create filing batch
  const batch = await prisma.filingBatch.create({
    data: {
      clientId,
      taxYear: forms[0].taxYear,
      status: 'PENDING',
      totalForms: forms.length,
      tinCheckEnabled: options.tinCheckEnabled,
      uspsEnabled: options.uspsEnabled,
      eDeliveryEnabled: options.eDeliveryEnabled,
    },
  })

  // Link forms to batch
  await prisma.form1099NEC.updateMany({
    where: { id: { in: forms.map((f) => f.id) } },
    data: { batchId: batch.id },
  })

  try {
    // Submit to Tax1099
    const response = await tax1099Client.submitForms({
      formIds: forms.map((f) => f.tax1099FormId!),
      tinCheckAllForms: options.tinCheckEnabled,
      uspsAllForms: options.uspsEnabled,
      eDeliveryRecipientAllForms: options.eDeliveryEnabled,
      isSeparateStateFiling: false,
    })

    // Update batch with submission result
    await prisma.filingBatch.update({
      where: { id: batch.id },
      data: {
        status: 'SUBMITTED',
        tax1099SubmissionId: response.submissionId,
        submittedAt: new Date(),
      },
    })

    // Update individual form statuses in batch
    const now = new Date()
    await prisma.$transaction(
      response.forms
        .filter((fr) => forms.some((f) => f.tax1099FormId === fr.formId))
        .map((formResult) => {
          const form = forms.find((f) => f.tax1099FormId === formResult.formId)!
          return prisma.form1099NEC.update({
            where: { id: form.id },
            data: {
              status: formResult.status === 'SUBMITTED' ? 'SUBMITTED' : 'REJECTED',
              efileSubmittedAt: formResult.status === 'SUBMITTED' ? now : null,
              efileStatus: formResult.status,
              validationErrors: formResult.errors || [],
            },
          })
        })
    )

    const submittedCount = response.forms.filter((f) => f.status === 'SUBMITTED').length
    const rejectedCount = response.forms.filter((f) => f.status === 'REJECTED').length

    return c.json({
      success: true,
      batchId: batch.id,
      submittedCount,
      rejectedCount,
    })
  } catch (error) {
    // Mark batch as failed
    await prisma.filingBatch.update({
      where: { id: batch.id },
      data: {
        status: 'REJECTED',
        rejectionReason: error instanceof Error ? error.message : 'Submission failed',
        rejectedAt: new Date(),
      },
    })

    console.error('[1099-NEC] Submit failed:', error)
    return c.json({
      success: false,
      batchId: batch.id,
      error: error instanceof Error ? error.message : 'Submission failed',
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
 * Refresh batch status from Tax1099 API
 */
form1099NecRoute.post('/:clientId/1099-nec/batches/:batchId/refresh', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { clientId, batchId } = c.req.param()

  if (!config.tax1099.isConfigured) {
    return c.json({ error: 'Tax1099 API is not configured' }, 503)
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
  })

  if (!batch || !batch.tax1099SubmissionId) {
    return c.json({ error: 'Batch not found or not submitted' }, 404)
  }

  // Fetch status from Tax1099
  const statusResponse = await tax1099Client.getSubmissionStatus(batch.tax1099SubmissionId)

  // Map Tax1099 status to our enum
  const newStatus = mapTax1099Status(statusResponse.status)

  await prisma.filingBatch.update({
    where: { id: batchId },
    data: {
      status: newStatus,
      acceptedForms: statusResponse.acceptedCount || 0,
      rejectedForms: statusResponse.rejectedCount || 0,
      acceptedAt: newStatus === 'ACCEPTED' ? new Date() : batch.acceptedAt,
      rejectedAt: newStatus === 'REJECTED' ? new Date() : batch.rejectedAt,
    },
  })

  // Update individual form statuses if available
  if (statusResponse.forms && statusResponse.forms.length > 0) {
    await prisma.$transaction(
      statusResponse.forms.map((fs) => {
        const mapped: Form1099Status =
          fs.status === 'ACCEPTED' ? 'ACCEPTED' :
          fs.status === 'REJECTED' ? 'REJECTED' : 'SUBMITTED'

        return prisma.form1099NEC.updateMany({
          where: { tax1099FormId: fs.formId },
          data: { efileStatus: fs.status, status: mapped },
        })
      })
    )
  }

  return c.json({ success: true, status: newStatus })
})

function mapTax1099Status(status: string): FilingStatus {
  switch (status.toUpperCase()) {
    case 'ACCEPTED': return 'ACCEPTED'
    case 'REJECTED': return 'REJECTED'
    case 'PARTIALLY_ACCEPTED': return 'PARTIALLY_ACCEPTED'
    case 'PROCESSING': return 'PROCESSING'
    default:
      console.warn(`[Tax1099] Unknown submission status: ${status}, defaulting to SUBMITTED`)
      return 'SUBMITTED'
  }
}

export { form1099NecRoute }
