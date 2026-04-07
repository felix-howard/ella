/**
 * 1099-NEC Form Routes
 * TaxBandits API integration: create, fetch PDFs, transmit, status
 * Nested under /businesses/:businessId/1099-nec
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'
import { verifyBusinessAccess, buildClientScopeFilter } from '../../lib/org-scope'
import { decryptSSN } from '../../services/crypto'
import { taxbanditsClient } from '../../services/taxbandits-client'
import { uploadFile, getSignedDownloadUrl } from '../../services/storage'
import type { AuthVariables } from '../../middleware/auth'
import { requireOrgAdmin } from '../../middleware/auth'
import type { Form1099Status, FilingStatus } from '@ella/db'

const form1099NecRoute = new Hono<{ Variables: AuthVariables }>()

/**
 * GET /businesses/:businessId/1099-nec/status
 * Get form status counts for the actions panel
 */
form1099NecRoute.get('/:businessId/1099-nec/status', async (c) => {
  const user = c.get('user')
  const { businessId } = c.req.param()

  const business = await verifyBusinessAccess(businessId, user)
  if (!business) {
    return c.json({ error: 'Business not found' }, 404)
  }

  const forms = await prisma.form1099NEC.findMany({
    where: { contractor: { businessId } },
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
 * POST /businesses/:businessId/1099-nec/create
 * Create all DRAFT forms in TaxBandits (unified: replaces old validate + import)
 */
form1099NecRoute.post('/:businessId/1099-nec/create', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { businessId } = c.req.param()

  if (!config.taxbandits.isConfigured) {
    return c.json({ error: 'TaxBandits API is not configured' }, 503)
  }

  const business = await prisma.business.findFirst({
    where: { id: businessId },
    select: {
      id: true,
      clientId: true,
      name: true,
      einEncrypted: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      contractors: {
        include: {
          forms: { where: { status: 'DRAFT' as Form1099Status } },
        },
      },
    },
  })

  if (!business) {
    return c.json({ error: 'Business not found' }, 404)
  }

  // Check org access via client
  const hasAccess = await prisma.client.findFirst({
    where: { id: business.clientId, ...buildClientScopeFilter(user) },
    select: { id: true },
  })
  if (!hasAccess) {
    return c.json({ error: 'Business not found' }, 404)
  }

  const contractorsWithForms = business.contractors.filter((c) => c.forms.length > 0)
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
        firstName: contractor.firstName,
        lastName: contractor.lastName,
        tinType: (contractor.tinType === 'EIN' ? 'EIN' : 'SSN') as 'SSN' | 'EIN',
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
        businessName: business.name,
        ein: decryptSSN(business.einEncrypted).replace(/-/g, ''),
        address1: business.address,
        city: business.city,
        state: business.state,
        zip: business.zip,
      },
      recipients,
    })
  } catch (error) {
    console.error('[1099-NEC] Create failed:', error)
    const message = error instanceof Error ? error.message : 'Failed to create forms in TaxBandits'
    return c.json({
      success: false,
      error: 'TaxBandits validation failed',
      message,
    }, 502)
  }

  // Create FilingBatch
  const batch = await prisma.filingBatch.create({
    data: {
      businessId,
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
        const seqIndex = parseInt(record.SequenceId, 10) - 1
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
    sequence: err.SequenceId,
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
 * POST /businesses/:businessId/1099-nec/fetch-pdfs
 * Fetch draft PDFs from TaxBandits and store in R2
 */
form1099NecRoute.post('/:businessId/1099-nec/fetch-pdfs', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { businessId } = c.req.param()

  if (!config.taxbandits.isConfigured) {
    return c.json({ error: 'TaxBandits API is not configured' }, 503)
  }

  const business = await verifyBusinessAccess(businessId, user)
  if (!business) {
    return c.json({ error: 'Business not found' }, 404)
  }

  const forms = await prisma.form1099NEC.findMany({
    where: {
      contractor: { businessId },
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
    const batchSlice = forms.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batchSlice.map(async (form) => {
        const pdfResponse = await taxbanditsClient.requestDraftPdf(
          form.batch!.taxbanditsSubmissionId!,
          form.taxbanditsRecordId!
        )

        console.log(`[1099-NEC] Downloading PDF from S3: ${pdfResponse.DraftPdfUrl}`)
        const pdfBuffer = await taxbanditsClient.downloadPdfFromS3(pdfResponse.DraftPdfUrl)

        const key = `1099-nec/${businessId}/${form.taxYear}/${form.contractor.id}.pdf`
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
        const msg = `Form ${batchSlice[j].id}: ${result.reason instanceof Error ? result.reason.message : 'PDF fetch failed'}`
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
 * POST /businesses/:businessId/1099-nec/fetch-recipient-pdfs
 * Fetch final Copy B + Copy C PDFs after transmission from TaxBandits
 */
form1099NecRoute.post('/:businessId/1099-nec/fetch-recipient-pdfs', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { businessId } = c.req.param()

  if (!config.taxbandits.isConfigured) {
    return c.json({ error: 'TaxBandits API is not configured' }, 503)
  }

  const business = await verifyBusinessAccess(businessId, user)
  if (!business) {
    return c.json({ error: 'Business not found' }, 404)
  }

  const forms = await prisma.form1099NEC.findMany({
    where: {
      contractor: { businessId },
      status: { in: ['SUBMITTED', 'ACCEPTED'] },
      taxbanditsRecordId: { not: null },
      batch: { taxbanditsSubmissionId: { not: null } },
    },
    include: { contractor: true, batch: true },
  })

  if (forms.length === 0) {
    return c.json({ error: 'No transmitted forms to fetch recipient PDFs for' }, 400)
  }

  // Group forms by batch (submissionId)
  const batchGroups = new Map<string, typeof forms>()
  for (const form of forms) {
    const subId = form.batch!.taxbanditsSubmissionId!
    if (!batchGroups.has(subId)) batchGroups.set(subId, [])
    batchGroups.get(subId)!.push(form)
  }

  let pdfCount = 0
  const errors: string[] = []

  for (const [submissionId, batchForms] of batchGroups) {
    const recordIds = batchForms.map((f) => f.taxbanditsRecordId!)

    let pdfResponse
    try {
      pdfResponse = await taxbanditsClient.requestPdfURLs(submissionId, recordIds, 'BOTH')
    } catch (error) {
      const msg = `Batch ${submissionId}: ${error instanceof Error ? error.message : 'RequestPdfURLs failed'}`
      console.error(`[1099-NEC] ${msg}`)
      errors.push(msg)
      continue
    }

    if (pdfResponse.Errors?.length > 0) {
      errors.push(...pdfResponse.Errors.map((e) => `${e.Code}: ${e.Message}`))
    }

    if (!pdfResponse.Form1099NecRecords?.SuccessRecords?.length) {
      console.warn(`[1099-NEC] No SuccessRecords in PDF URL response for batch ${submissionId}`)
      continue
    }

    console.log(`[1099-NEC] Got ${pdfResponse.Form1099NecRecords.SuccessRecords.length} success records for batch ${submissionId}`)

    // Build recordId -> form lookup
    const formByRecordId = new Map(batchForms.map((f) => [f.taxbanditsRecordId!, f]))

    // Download and store PDFs in parallel batches
    const CONCURRENCY = 5
    const successRecords = pdfResponse.Form1099NecRecords.SuccessRecords
    for (let i = 0; i < successRecords.length; i += CONCURRENCY) {
      const slice = successRecords.slice(i, i + CONCURRENCY)
      const results = await Promise.allSettled(
        slice.map(async (record) => {
          const form = formByRecordId.get(record.RecordId)
          if (!form) {
            throw new Error(`No form found for RecordId ${record.RecordId}`)
          }

          // Download Copy B (masked TIN - for contractor)
          const copyBUrl = record.Files?.CopyB?.Masked || record.Files?.CopyB?.Unmasked
          if (copyBUrl) {
            console.log(`[1099-NEC] Downloading Copy B for ${record.RecordId}`)
            const pdfBuffer = await taxbanditsClient.downloadPdfFromS3(copyBUrl)
            const key = `1099-nec/${businessId}/${form.taxYear}/${form.contractor.id}-copy-b.pdf`
            await uploadFile(key, pdfBuffer, 'application/pdf')
            await prisma.form1099NEC.update({
              where: { id: form.id },
              data: { copyBStorageKey: key },
            })
          }

          // Download Copy C (unmasked TIN - for payer records)
          const copyCUrl = record.Files?.CopyC?.Unmasked || record.Files?.CopyC?.Masked
          if (copyCUrl) {
            console.log(`[1099-NEC] Downloading Copy C for ${record.RecordId}`)
            const pdfBuffer = await taxbanditsClient.downloadPdfFromS3(copyCUrl)
            const key = `1099-nec/${businessId}/${form.taxYear}/${form.contractor.id}-copy-c.pdf`
            await uploadFile(key, pdfBuffer, 'application/pdf')
            await prisma.form1099NEC.update({
              where: { id: form.id },
              data: { copyCStorageKey: key },
            })
          }

          const hasPdf = !!copyBUrl || !!copyCUrl
          if (!hasPdf) {
            console.warn(`[1099-NEC] Record ${record.RecordId}: No Copy B or Copy C URLs returned`)
          }
          return hasPdf
        })
      )

      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') {
          if ((results[j] as PromiseFulfilledResult<boolean>).value) {
            pdfCount++
          }
        } else {
          const msg = `Record ${slice[j].RecordId}: ${(results[j] as PromiseRejectedResult).reason?.message || 'PDF fetch failed'}`
          console.error(`[1099-NEC] ${msg}`)
          errors.push(msg)
        }
      }
    }

    // Log error records from TaxBandits
    if (pdfResponse.Form1099NecRecords.ErrorRecords?.length > 0) {
      for (const errRec of pdfResponse.Form1099NecRecords.ErrorRecords) {
        errors.push(`Record ${errRec.RecordId}: ${errRec.ErrorMessage}`)
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
 * GET /businesses/:businessId/1099-nec/pdfs/recipient
 * Get signed URLs for Copy B PDFs (for contractors)
 */
form1099NecRoute.get('/:businessId/1099-nec/pdfs/recipient', async (c) => {
  const user = c.get('user')
  const { businessId } = c.req.param()

  const business = await verifyBusinessAccess(businessId, user)
  if (!business) {
    return c.json({ error: 'Business not found' }, 404)
  }

  const forms = await prisma.form1099NEC.findMany({
    where: {
      contractor: { businessId },
      copyBStorageKey: { not: null },
    },
    include: { contractor: { select: { firstName: true, lastName: true } } },
  })

  const pdfs = await Promise.all(
    forms.map(async (form) => {
      const url = await getSignedDownloadUrl(form.copyBStorageKey!, 300)
      return {
        formId: form.id,
        url,
        filename: `1099-NEC-${form.taxYear}-CopyB-${form.contractor.lastName}-${form.contractor.firstName}.pdf`,
      }
    })
  )

  return c.json({ data: pdfs.filter((p) => p.url) })
})

/**
 * GET /businesses/:businessId/1099-nec/pdfs
 * Get signed download URLs for all PDF-ready forms
 */
form1099NecRoute.get('/:businessId/1099-nec/pdfs', async (c) => {
  const user = c.get('user')
  const { businessId } = c.req.param()

  const business = await verifyBusinessAccess(businessId, user)
  if (!business) {
    return c.json({ error: 'Business not found' }, 404)
  }

  const forms = await prisma.form1099NEC.findMany({
    where: {
      contractor: { businessId },
      pdfStorageKey: { not: null },
      status: { in: ['PDF_READY', 'SUBMITTED', 'ACCEPTED'] },
    },
    include: { contractor: { select: { firstName: true, lastName: true } } },
  })

  const pdfs = await Promise.all(
    forms.map(async (form) => {
      const url = await getSignedDownloadUrl(form.pdfStorageKey!, 300)
      return {
        formId: form.id,
        url,
        filename: `1099-NEC-${form.taxYear}-${form.contractor.lastName}-${form.contractor.firstName}.pdf`,
      }
    })
  )

  return c.json({ data: pdfs.filter((p) => p.url) })
})

/**
 * POST /businesses/:businessId/1099-nec/prepare
 * One-click: Create forms in TaxBandits + fetch draft PDFs
 * Combines the old "Create" + "Get PDFs" steps
 */
form1099NecRoute.post('/:businessId/1099-nec/prepare', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { businessId } = c.req.param()

  if (!config.taxbandits.isConfigured) {
    return c.json({ error: 'TaxBandits API is not configured' }, 503)
  }

  const business = await prisma.business.findFirst({
    where: { id: businessId },
    select: {
      id: true,
      clientId: true,
      name: true,
      einEncrypted: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      contractors: {
        include: {
          forms: { where: { status: 'DRAFT' as Form1099Status } },
        },
      },
    },
  })

  if (!business) {
    return c.json({ error: 'Business not found' }, 404)
  }

  const hasAccess = await prisma.client.findFirst({
    where: { id: business.clientId, ...buildClientScopeFilter(user) },
    select: { id: true },
  })
  if (!hasAccess) {
    return c.json({ error: 'Business not found' }, 404)
  }

  const contractorsWithForms = business.contractors.filter((c) => c.forms.length > 0)
  if (contractorsWithForms.length === 0) {
    return c.json({ error: 'No draft forms to prepare' }, 400)
  }

  const taxYears = [...new Set(contractorsWithForms.flatMap((c) => c.forms.map((f) => f.taxYear)))]
  if (taxYears.length > 1) {
    return c.json({ error: 'Cannot submit forms from multiple tax years' }, 400)
  }

  try {
    await taxbanditsClient.checkAuth()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TaxBandits authentication failed'
    return c.json({ error: `TaxBandits authentication failed: ${message}` }, 502)
  }

  // Step 1: Create forms in TaxBandits
  const recipientMap: Array<{ formId: string; contractorId: string }> = []
  const recipients = contractorsWithForms.flatMap((contractor) =>
    contractor.forms.map((form) => {
      recipientMap.push({ formId: form.id, contractorId: contractor.id })
      return {
        firstName: contractor.firstName,
        lastName: contractor.lastName,
        tinType: (contractor.tinType === 'EIN' ? 'EIN' : 'SSN') as 'SSN' | 'EIN',
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

  let createResponse
  try {
    createResponse = await taxbanditsClient.createForm1099NEC({
      taxYear: taxYears[0],
      payer: {
        businessName: business.name,
        ein: decryptSSN(business.einEncrypted).replace(/-/g, ''),
        address1: business.address,
        city: business.city,
        state: business.state,
        zip: business.zip,
      },
      recipients,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create forms in TaxBandits'
    return c.json({ error: `Form creation failed: ${message}` }, 502)
  }

  const batch = await prisma.filingBatch.create({
    data: {
      businessId,
      taxYear: taxYears[0],
      status: 'PENDING',
      totalForms: createResponse.Form1099Records.SuccessRecords.length,
      taxbanditsSubmissionId: createResponse.SubmissionId,
    },
  })

  if (createResponse.Form1099Records.SuccessRecords.length > 0) {
    await prisma.$transaction(
      createResponse.Form1099Records.SuccessRecords.map((record) => {
        const seqIndex = parseInt(record.SequenceId, 10) - 1
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

  const createErrors = createResponse.Form1099Records.ErrorRecords.map((err) => ({
    sequence: err.SequenceId,
    errors: err.Errors.map((e) => `${e.Code}: ${e.Message}${e.FieldName ? ` (${e.FieldName})` : ''}`),
  }))

  const createdCount = createResponse.Form1099Records.SuccessRecords.length
  if (createdCount === 0) {
    return c.json({
      success: false,
      step: 'create',
      createdCount: 0,
      pdfCount: 0,
      errors: createErrors,
    })
  }

  // Step 2: Fetch PDFs for the newly created forms
  const importedForms = await prisma.form1099NEC.findMany({
    where: {
      contractor: { businessId },
      status: 'IMPORTED',
      taxbanditsRecordId: { not: null },
      batch: { taxbanditsSubmissionId: { not: null } },
    },
    include: { contractor: true, batch: true },
  })

  let pdfCount = 0
  const pdfErrors: string[] = []

  const CONCURRENCY = 5
  for (let i = 0; i < importedForms.length; i += CONCURRENCY) {
    const batchSlice = importedForms.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batchSlice.map(async (form) => {
        const pdfResponse = await taxbanditsClient.requestDraftPdf(
          form.batch!.taxbanditsSubmissionId!,
          form.taxbanditsRecordId!
        )
        const pdfBuffer = await taxbanditsClient.downloadPdfFromS3(pdfResponse.DraftPdfUrl)
        const key = `1099-nec/${businessId}/${form.taxYear}/${form.contractor.id}.pdf`
        await uploadFile(key, pdfBuffer, 'application/pdf')
        await prisma.form1099NEC.update({
          where: { id: form.id },
          data: { pdfStorageKey: key, status: 'PDF_READY' },
        })
        return form.id
      })
    )

    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled') {
        pdfCount++
      } else {
        const msg = `Form ${batchSlice[j].id}: ${(results[j] as PromiseRejectedResult).reason?.message || 'PDF fetch failed'}`
        pdfErrors.push(msg)
      }
    }
  }

  return c.json({
    success: true,
    createdCount,
    pdfCount,
    batchId: batch.id,
    ...(createErrors.length > 0 ? { createErrors } : {}),
    ...(pdfErrors.length > 0 ? { pdfErrors } : {}),
  })
})

/**
 * GET /businesses/:businessId/1099-nec/:formId/pdf
 * Download PDF from R2 (returns signed URL, 5-min expiry for SSN docs)
 */
form1099NecRoute.get('/:businessId/1099-nec/:formId/pdf', async (c) => {
  const user = c.get('user')
  const { businessId, formId } = c.req.param()

  const business = await verifyBusinessAccess(businessId, user)
  if (!business) {
    return c.json({ error: 'Business not found' }, 404)
  }

  const form = await prisma.form1099NEC.findFirst({
    where: {
      id: formId,
      contractor: { businessId },
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

/**
 * GET /businesses/:businessId/1099-nec/:formId/pdf/recipient
 * Download Copy B PDF (signed URL, 5-min expiry)
 */
form1099NecRoute.get('/:businessId/1099-nec/:formId/pdf/recipient', async (c) => {
  const user = c.get('user')
  const { businessId, formId } = c.req.param()

  const business = await verifyBusinessAccess(businessId, user)
  if (!business) {
    return c.json({ error: 'Business not found' }, 404)
  }

  const form = await prisma.form1099NEC.findFirst({
    where: {
      id: formId,
      contractor: { businessId },
      copyBStorageKey: { not: null },
    },
    include: { contractor: true },
  })

  if (!form || !form.copyBStorageKey) {
    return c.json({ error: 'Recipient PDF not found' }, 404)
  }

  const signedUrl = await getSignedDownloadUrl(form.copyBStorageKey, 300)

  if (!signedUrl) {
    return c.json({ error: 'Failed to generate download URL' }, 500)
  }

  return c.json({
    url: signedUrl,
    filename: `1099-NEC-${form.taxYear}-CopyB-${form.contractor.lastName}.pdf`,
  })
})

// ============================================
// Transmit & Filing Batch Endpoints
// ============================================

/**
 * POST /businesses/:businessId/1099-nec/transmit
 * Transmit PDF-ready forms to IRS via TaxBandits
 */
form1099NecRoute.post('/:businessId/1099-nec/transmit', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { businessId } = c.req.param()

  if (!config.taxbandits.isConfigured) {
    return c.json({ error: 'TaxBandits API is not configured' }, 503)
  }

  const business = await verifyBusinessAccess(businessId, user)
  if (!business) {
    return c.json({ error: 'Business not found' }, 404)
  }

  const forms = await prisma.form1099NEC.findMany({
    where: {
      contractor: { businessId },
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

    // Auto-fetch recipient PDFs (Copy B + C) after successful transmission
    let recipientPdfCount = 0
    const recipientErrors: string[] = []
    try {
      const submittedForms = await prisma.form1099NEC.findMany({
        where: {
          contractor: { businessId },
          status: { in: ['SUBMITTED', 'ACCEPTED'] },
          taxbanditsRecordId: { not: null },
          batch: { taxbanditsSubmissionId: { not: null } },
        },
        include: { contractor: true, batch: true },
      })

      const batchGroups = new Map<string, typeof submittedForms>()
      for (const form of submittedForms) {
        const subId = form.batch!.taxbanditsSubmissionId!
        if (!batchGroups.has(subId)) batchGroups.set(subId, [])
        batchGroups.get(subId)!.push(form)
      }

      for (const [submissionId, batchForms] of batchGroups) {
        const recordIds = batchForms.map((f) => f.taxbanditsRecordId!)
        let pdfResponse
        try {
          pdfResponse = await taxbanditsClient.requestPdfURLs(submissionId, recordIds, 'BOTH')
        } catch (error) {
          recipientErrors.push(`Recipient PDFs: ${error instanceof Error ? error.message : 'Failed'}`)
          continue
        }

        if (!pdfResponse.Form1099NecRecords?.SuccessRecords?.length) continue

        const formByRecordId = new Map(batchForms.map((f) => [f.taxbanditsRecordId!, f]))
        const CONCURRENCY = 5
        const successRecords = pdfResponse.Form1099NecRecords.SuccessRecords
        for (let i = 0; i < successRecords.length; i += CONCURRENCY) {
          const slice = successRecords.slice(i, i + CONCURRENCY)
          const results = await Promise.allSettled(
            slice.map(async (record) => {
              const form = formByRecordId.get(record.RecordId)
              if (!form) return false

              const copyBUrl = record.Files?.CopyB?.Masked || record.Files?.CopyB?.Unmasked
              if (copyBUrl) {
                const pdfBuffer = await taxbanditsClient.downloadPdfFromS3(copyBUrl)
                const key = `1099-nec/${businessId}/${form.taxYear}/${form.contractor.id}-copy-b.pdf`
                await uploadFile(key, pdfBuffer, 'application/pdf')
                await prisma.form1099NEC.update({
                  where: { id: form.id },
                  data: { copyBStorageKey: key },
                })
              }

              const copyCUrl = record.Files?.CopyC?.Unmasked || record.Files?.CopyC?.Masked
              if (copyCUrl) {
                const pdfBuffer = await taxbanditsClient.downloadPdfFromS3(copyCUrl)
                const key = `1099-nec/${businessId}/${form.taxYear}/${form.contractor.id}-copy-c.pdf`
                await uploadFile(key, pdfBuffer, 'application/pdf')
                await prisma.form1099NEC.update({
                  where: { id: form.id },
                  data: { copyCStorageKey: key },
                })
              }

              return !!copyBUrl || !!copyCUrl
            })
          )

          for (const result of results) {
            if (result.status === 'fulfilled' && result.value) recipientPdfCount++
          }
        }
      }
    } catch (error) {
      console.error('[1099-NEC] Auto-fetch recipient PDFs failed:', error)
      recipientErrors.push(error instanceof Error ? error.message : 'Recipient PDF fetch failed')
    }

    return c.json({
      success: true,
      batchId: batch.id,
      transmittedCount: forms.length,
      recipientPdfCount,
      ...(recipientErrors.length > 0 ? { recipientErrors } : {}),
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
 * GET /businesses/:businessId/1099-nec/batches
 * List filing batches for a business
 */
form1099NecRoute.get('/:businessId/1099-nec/batches', async (c) => {
  const user = c.get('user')
  const { businessId } = c.req.param()

  const business = await verifyBusinessAccess(businessId, user)
  if (!business) {
    return c.json({ error: 'Business not found' }, 404)
  }

  const batches = await prisma.filingBatch.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { forms: true } },
    },
  })

  return c.json({ data: batches })
})

/**
 * GET /businesses/:businessId/1099-nec/batches/:batchId
 * Get batch details with form statuses
 */
form1099NecRoute.get('/:businessId/1099-nec/batches/:batchId', async (c) => {
  const user = c.get('user')
  const { businessId, batchId } = c.req.param()

  const business = await verifyBusinessAccess(businessId, user)
  if (!business) {
    return c.json({ error: 'Business not found' }, 404)
  }

  const batch = await prisma.filingBatch.findFirst({
    where: { id: batchId, businessId },
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
 * POST /businesses/:businessId/1099-nec/batches/:batchId/refresh
 * Refresh batch status from TaxBandits API
 */
form1099NecRoute.post('/:businessId/1099-nec/batches/:batchId/refresh', requireOrgAdmin, async (c) => {
  const user = c.get('user')
  const { businessId, batchId } = c.req.param()

  if (!config.taxbandits.isConfigured) {
    return c.json({ error: 'TaxBandits API is not configured' }, 503)
  }

  const business = await verifyBusinessAccess(businessId, user)
  if (!business) {
    return c.json({ error: 'Business not found' }, 404)
  }

  const batch = await prisma.filingBatch.findFirst({
    where: { id: batchId, businessId },
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
