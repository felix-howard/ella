/**
 * SMS Notification Service
 * Automated SMS notifications triggered by system events (blurry docs, missing docs)
 */
import { prisma } from '../../lib/db'
import { getMagicLinksForCase } from '../magic-link'
import { PORTAL_URL } from '../../lib/constants'
import {
  sendBlurryResendRequest,
  sendMissingDocsReminder,
  isSmsEnabled,
  type SendMessageResult,
} from './message-sender'
import type { Language } from '@ella/db'

// Throttle window constants (in milliseconds)
const BLURRY_THROTTLE_MS = 60 * 60 * 1000 // 1 hour
const MISSING_DOCS_THROTTLE_MS = 24 * 60 * 60 * 1000 // 24 hours
const CASE_GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000 // 3 days before first reminder
const BATCH_CONCURRENCY = 5 // Max concurrent SMS sends in batch

/**
 * Get or create active magic link URL for a case
 */
async function getActiveMagicLink(caseId: string): Promise<string | null> {
  const links = await getMagicLinksForCase(caseId)
  const activeLink = links.find((l) => l.isActive)
  if (activeLink) {
    return `${PORTAL_URL}/u/${activeLink.token}`
  }
  return null
}

/**
 * Get client info for a case
 */
async function getCaseClientInfo(caseId: string): Promise<{
  clientName: string
  clientPhone: string
  language: Language
  taxYear: number
} | null> {
  const taxCase = await prisma.taxCase.findUnique({
    where: { id: caseId },
    include: {
      client: {
        select: { name: true, phone: true, language: true },
      },
    },
  })

  if (!taxCase) return null

  return {
    clientName: taxCase.client.name,
    clientPhone: taxCase.client.phone,
    language: taxCase.client.language,
    taxYear: taxCase.taxYear,
  }
}

/**
 * Send blurry document resend request SMS
 * Called when AI pipeline detects blurry images
 */
export async function notifyBlurryDocument(
  caseId: string,
  docTypes: string[]
): Promise<SendMessageResult> {
  if (!isSmsEnabled()) {
    return { success: false, error: 'SMS_NOT_ENABLED', smsSent: false }
  }

  if (docTypes.length === 0) {
    return { success: false, error: 'NO_DOC_TYPES', smsSent: false }
  }

  const clientInfo = await getCaseClientInfo(caseId)
  if (!clientInfo) {
    return { success: false, error: 'CASE_NOT_FOUND', smsSent: false }
  }

  const magicLink = await getActiveMagicLink(caseId)
  if (!magicLink) {
    return { success: false, error: 'NO_MAGIC_LINK', smsSent: false }
  }

  // Throttle: Check if we sent a blurry notification recently
  const recentBlurryMsg = await prisma.message.findFirst({
    where: {
      conversation: { caseId },
      templateUsed: 'blurry_resend',
      createdAt: { gte: new Date(Date.now() - BLURRY_THROTTLE_MS) },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (recentBlurryMsg) {
    console.log(`[SMS Notify] Skipping blurry SMS for case ${caseId} - sent within last hour`)
    return { success: true, smsSent: false, error: 'THROTTLED' }
  }

  return sendBlurryResendRequest(
    caseId,
    clientInfo.clientName,
    clientInfo.clientPhone,
    magicLink,
    docTypes,
    (clientInfo.language as 'VI' | 'EN') || 'VI'
  )
}

/**
 * Send missing documents reminder SMS
 * Called by scheduled job or manual trigger
 */
export async function notifyMissingDocuments(caseId: string): Promise<SendMessageResult> {
  if (!isSmsEnabled()) {
    return { success: false, error: 'SMS_NOT_ENABLED', smsSent: false }
  }

  const clientInfo = await getCaseClientInfo(caseId)
  if (!clientInfo) {
    return { success: false, error: 'CASE_NOT_FOUND', smsSent: false }
  }

  const magicLink = await getActiveMagicLink(caseId)
  if (!magicLink) {
    return { success: false, error: 'NO_MAGIC_LINK', smsSent: false }
  }

  // Get missing checklist items (status = MISSING)
  const missingItems = await prisma.checklistItem.findMany({
    where: {
      caseId,
      status: 'MISSING',
      template: { isRequired: true },
    },
    include: {
      template: { select: { labelVi: true, docType: true } },
    },
  })

  if (missingItems.length === 0) {
    return { success: false, error: 'NO_MISSING_DOCS', smsSent: false }
  }

  // Throttle: Check if we sent a missing docs notification recently
  const recentMissingMsg = await prisma.message.findFirst({
    where: {
      conversation: { caseId },
      templateUsed: 'missing_docs',
      createdAt: { gte: new Date(Date.now() - MISSING_DOCS_THROTTLE_MS) },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (recentMissingMsg) {
    console.log(`[SMS Notify] Skipping missing docs SMS for case ${caseId} - sent within last 24h`)
    return { success: true, smsSent: false, error: 'THROTTLED' }
  }

  const missingDocNames = missingItems.map((item) => item.template.labelVi)

  return sendMissingDocsReminder(
    caseId,
    clientInfo.clientName,
    clientInfo.clientPhone,
    magicLink,
    missingDocNames,
    (clientInfo.language as 'VI' | 'EN') || 'VI'
  )
}

/**
 * Get cases that need missing documents reminders
 * Criteria:
 * - Case status is WAITING_DOCS
 * - Has MISSING checklist items that are required
 * - No reminder sent in last 24 hours
 * - Case has activity (created > 3 days ago to give client time to upload)
 */
export async function getCasesNeedingReminders(): Promise<
  Array<{ caseId: string; clientName: string; missingCount: number }>
> {
  const gracePeriodDate = new Date(Date.now() - CASE_GRACE_PERIOD_MS)
  const throttleDate = new Date(Date.now() - MISSING_DOCS_THROTTLE_MS)

  const cases = await prisma.taxCase.findMany({
    where: {
      status: 'WAITING_DOCS',
      createdAt: { lte: gracePeriodDate },
      checklistItems: {
        some: {
          status: 'MISSING',
          template: { isRequired: true },
        },
      },
    },
    include: {
      client: { select: { name: true } },
      conversation: {
        select: {
          messages: {
            where: {
              templateUsed: 'missing_docs',
              createdAt: { gte: throttleDate },
            },
            take: 1,
          },
        },
      },
      _count: {
        select: {
          checklistItems: { where: { status: 'MISSING', template: { isRequired: true } } },
        },
      },
    },
  })

  // Filter out cases that received a reminder in last 24 hours
  return cases
    .filter((c) => !c.conversation?.messages.length)
    .map((c) => ({
      caseId: c.id,
      clientName: c.client.name,
      missingCount: c._count.checklistItems,
    }))
}

/**
 * Batch send missing documents reminders with concurrency control
 * Returns summary of sent/failed notifications
 */
export async function sendBatchMissingReminders(): Promise<{
  sent: number
  failed: number
  skipped: number
  details: Array<{ caseId: string; result: string }>
}> {
  const casesToNotify = await getCasesNeedingReminders()

  const results = {
    sent: 0,
    failed: 0,
    skipped: 0,
    details: [] as Array<{ caseId: string; result: string }>,
  }

  // Process in batches with controlled concurrency to avoid rate limits
  for (let i = 0; i < casesToNotify.length; i += BATCH_CONCURRENCY) {
    const batch = casesToNotify.slice(i, i + BATCH_CONCURRENCY)

    const batchResults = await Promise.allSettled(
      batch.map(async ({ caseId, clientName }) => {
        const result = await notifyMissingDocuments(caseId)
        return { caseId, clientName, result }
      })
    )

    for (const settled of batchResults) {
      if (settled.status === 'rejected') {
        results.failed++
        results.details.push({ caseId: 'unknown', result: `error: ${settled.reason}` })
        console.error('[Batch Reminder] Error:', settled.reason)
        continue
      }

      const { caseId, clientName, result } = settled.value

      if (result.smsSent) {
        results.sent++
        results.details.push({ caseId, result: 'sent' })
        console.log(`[Batch Reminder] Sent to ${clientName} (case ${caseId})`)
      } else if (result.error === 'THROTTLED') {
        results.skipped++
        results.details.push({ caseId, result: 'throttled' })
      } else {
        results.failed++
        results.details.push({ caseId, result: `failed: ${result.error}` })
      }
    }
  }

  return results
}
