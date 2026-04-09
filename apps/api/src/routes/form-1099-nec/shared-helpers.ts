/**
 * Shared helpers for 1099-NEC routes
 * Extracted to avoid duplication between create, prepare, and batch routes
 */
import { prisma } from '../../lib/db'
import { buildClientScopeFilter } from '../../lib/org-scope'
import { decryptSSN } from '../../services/crypto'
import { taxbanditsClient } from '../../services/taxbandits-client'
import { uploadFile } from '../../services/storage'
import type { Form1099Status, FilingStatus } from '@ella/db'
import type { AuthUser } from '../../services/auth'

interface ContractorWithForms {
  id: string
  firstName: string
  lastName: string
  tinType: string
  ssnEncrypted: string
  address: string
  city: string
  state: string
  zip: string
  email: string | null
  forms: Array<{ id: string; taxYear: number; amountBox1: unknown; amountBox4: unknown }>
}

interface BusinessInfo {
  id: string
  name: string
  einEncrypted: string
  address: string
  city: string
  state: string
  zip: string
}

/**
 * Fetch and validate a BUSINESS-type Client for 1099-NEC filing.
 * Returns business info (name, EIN, address) or null if not found/unauthorized.
 */
export async function getBusinessClientForFiling(
  clientId: string,
  user: AuthUser
): Promise<BusinessInfo | null> {
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      clientType: 'BUSINESS',
      ...buildClientScopeFilter(user),
    },
    select: { id: true, name: true, einEncrypted: true, businessAddress: true, businessCity: true, businessState: true, businessZip: true },
  })
  if (!client?.einEncrypted || !client.businessAddress) return null
  return {
    id: client.id,
    name: client.name,
    einEncrypted: client.einEncrypted,
    address: client.businessAddress,
    city: client.businessCity ?? '',
    state: client.businessState ?? '',
    zip: client.businessZip ?? '',
  }
}

/**
 * Create 1099-NEC forms in TaxBandits and persist batch + form records.
 * Returns batch info and any errors from TaxBandits.
 */
export async function createFormsInTaxBandits(
  business: BusinessInfo,
  clientId: string,
  contractorsWithForms: ContractorWithForms[],
  taxYear: number,
) {
  const recipientMap: Array<{ formId: string; contractorId: string }> = []
  const recipients = contractorsWithForms.flatMap((contractor) =>
    contractor.forms.map((form) => {
      recipientMap.push({ formId: form.id, contractorId: contractor.id })
      return {
        firstName: contractor.firstName, lastName: contractor.lastName,
        tinType: (contractor.tinType === 'EIN' ? 'EIN' : 'SSN') as 'SSN' | 'EIN',
        tin: decryptSSN(contractor.ssnEncrypted).replace(/-/g, ''),
        address1: contractor.address, city: contractor.city,
        state: contractor.state, zip: contractor.zip,
        email: contractor.email || undefined,
        amountBox1: Number(form.amountBox1), amountBox4: Number(form.amountBox4),
      }
    })
  )

  const response = await taxbanditsClient.createForm1099NEC({
    taxYear,
    payer: {
      businessName: business.name,
      ein: decryptSSN(business.einEncrypted).replace(/-/g, ''),
      address1: business.address, city: business.city,
      state: business.state, zip: business.zip,
    },
    recipients,
  })

  const batch = await prisma.filingBatch.create({
    data: {
      clientId,
      taxYear, status: 'PENDING',
      totalForms: response.Form1099Records.SuccessRecords.length,
      taxbanditsSubmissionId: response.SubmissionId,
    },
  })

  if (response.Form1099Records.SuccessRecords.length > 0) {
    await prisma.$transaction(
      response.Form1099Records.SuccessRecords
        .filter((record) => {
          const seqIndex = parseInt(record.SequenceId, 10) - 1
          return recipientMap[seqIndex] != null
        })
        .map((record) => {
          const seqIndex = parseInt(record.SequenceId, 10) - 1
          const mapping = recipientMap[seqIndex]
          return prisma.form1099NEC.update({
            where: { id: mapping.formId },
            data: { taxbanditsRecordId: record.RecordId, status: 'IMPORTED', batchId: batch.id },
          })
        })
    )
  }

  const errors = response.Form1099Records.ErrorRecords.map((err) => ({
    sequence: err.SequenceId,
    errors: err.Errors.map((e) => `${e.Code}: ${e.Message}${e.FieldName ? ` (${e.FieldName})` : ''}`),
  }))

  return { batch, createdCount: response.Form1099Records.SuccessRecords.length, errors }
}

/**
 * Fetch draft PDFs from TaxBandits for IMPORTED forms and store in R2.
 */
export async function fetchDraftPdfs(clientId: string) {
  const forms = await prisma.form1099NEC.findMany({
    where: {
      contractor: { clientId }, status: 'IMPORTED',
      taxbanditsRecordId: { not: null },
      batch: { taxbanditsSubmissionId: { not: null } },
    },
    include: { contractor: true, batch: true },
  })

  let pdfCount = 0
  const errors: string[] = []
  const CONCURRENCY = 5

  for (let i = 0; i < forms.length; i += CONCURRENCY) {
    const batchSlice = forms.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batchSlice.map(async (form) => {
        const pdfResponse = await taxbanditsClient.requestDraftPdf(
          form.batch!.taxbanditsSubmissionId!, form.taxbanditsRecordId!
        )
        const pdfBuffer = await taxbanditsClient.downloadPdfFromS3(pdfResponse.DraftPdfUrl)
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
      if (results[j].status === 'fulfilled') pdfCount++
      else {
        const msg = `Form ${batchSlice[j].id}: ${(results[j] as PromiseRejectedResult).reason?.message || 'PDF fetch failed'}`
        errors.push(msg)
      }
    }
  }

  return { pdfCount, errors }
}

/**
 * Fetch recipient PDFs (Copy B + C) after transmission.
 */
export async function fetchRecipientPdfs(clientId: string) {
  let pdfCount = 0
  const errors: string[] = []

  try {
    const forms = await prisma.form1099NEC.findMany({
      where: {
        contractor: { clientId },
        status: { in: ['SUBMITTED', 'ACCEPTED'] },
        taxbanditsRecordId: { not: null },
        batch: { taxbanditsSubmissionId: { not: null } },
      },
      include: { contractor: true, batch: true },
    })

    const batchGroups = new Map<string, typeof forms>()
    for (const form of forms) {
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
        errors.push(`Recipient PDFs: ${error instanceof Error ? error.message : 'Failed'}`)
        continue
      }
      if (!pdfResponse.Form1099NecRecords?.SuccessRecords?.length) continue

      const formByRecordId = new Map(batchForms.map((f) => [f.taxbanditsRecordId!, f]))
      for (const record of pdfResponse.Form1099NecRecords.SuccessRecords) {
        const form = formByRecordId.get(record.RecordId)
        if (!form) continue

        try {
          const copyBUrl = record.Files?.CopyB?.Masked || record.Files?.CopyB?.Unmasked
          if (copyBUrl) {
            const buf = await taxbanditsClient.downloadPdfFromS3(copyBUrl)
            const key = `1099-nec/${clientId}/${form.taxYear}/${form.contractor.id}-copy-b.pdf`
            await uploadFile(key, buf, 'application/pdf')
            await prisma.form1099NEC.update({ where: { id: form.id }, data: { copyBStorageKey: key } })
          }
          const copyCUrl = record.Files?.CopyC?.Unmasked || record.Files?.CopyC?.Masked
          if (copyCUrl) {
            const buf = await taxbanditsClient.downloadPdfFromS3(copyCUrl)
            const key = `1099-nec/${clientId}/${form.taxYear}/${form.contractor.id}-copy-c.pdf`
            await uploadFile(key, buf, 'application/pdf')
            await prisma.form1099NEC.update({ where: { id: form.id }, data: { copyCStorageKey: key } })
          }
          if (copyBUrl || copyCUrl) pdfCount++
        } catch (error) {
          errors.push(`Record ${record.RecordId}: ${error instanceof Error ? error.message : 'PDF fetch failed'}`)
        }
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Recipient PDF fetch failed')
  }

  return { pdfCount, errors }
}

export function mapTaxBanditsFormStatus(status: string): Form1099Status {
  switch (status.toUpperCase()) {
    case 'ACCEPTED': return 'ACCEPTED'
    case 'REJECTED': return 'REJECTED'
    case 'TRANSMITTED':
    case 'UNDER_PROCESSING':
    case 'SENT_TO_AGENCY': return 'SUBMITTED'
    case 'CREATED': return 'IMPORTED'
    default: return 'SUBMITTED'
  }
}

export function deriveBatchStatus(statuses: string[]): FilingStatus {
  if (statuses.length === 0) return 'SUBMITTED'
  const upper = statuses.map((s) => s.toUpperCase())
  if (upper.every((s) => s === 'ACCEPTED')) return 'ACCEPTED'
  if (upper.every((s) => s === 'REJECTED')) return 'REJECTED'
  if (upper.some((s) => s === 'ACCEPTED') && upper.some((s) => s === 'REJECTED')) return 'PARTIALLY_ACCEPTED'
  if (upper.some((s) => ['TRANSMITTED', 'UNDER_PROCESSING', 'SENT_TO_AGENCY'].includes(s))) return 'PROCESSING'
  return 'SUBMITTED'
}
