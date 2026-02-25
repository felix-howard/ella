/**
 * Staff Upload Notification Job
 * Batches document uploads over 5-minute window, sends 1 SMS per batch
 *
 * Key behaviors:
 * - Batches by caseId (each client case batched independently)
 * - 10-minute timeout OR 100 events (whichever first)
 * - Queries assigned staff + admins with notification prefs
 * - Skips staff without phone number (silent)
 * - Sends SMS via notifyStaffUpload()
 */

import { inngest } from '../lib/inngest'
import { prisma } from '../lib/db'
import { notifyStaffUpload } from '../services/sms/notification-service'

// Result types for step.run narrowing
interface CaseInfoSkip {
  skip: true
  reason: string
}

interface CaseInfoSuccess {
  skip: false
  clientId: string
  clientName: string
  organizationId: string
  hasAssignments: boolean
}

type CaseInfoResult = CaseInfoSkip | CaseInfoSuccess

export const notifyStaffOnUploadJob = inngest.createFunction(
  {
    id: 'notify-staff-upload',
    batchEvents: {
      maxSize: 100,
      timeout: '600s', // 10 minutes
      key: 'event.data.caseId',
    },
  },
  { event: 'document/uploaded' },
  async ({ events, step }) => {
    // All events in batch share same caseId (keyed by caseId)
    const caseId = events[0].data.caseId
    const uploadCount = events.length

    // Step 1: Get case and client info
    const caseInfo: CaseInfoResult = await step.run('get-case-info', async () => {
      const taxCase = await prisma.taxCase.findUnique({
        where: { id: caseId },
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true,
              organizationId: true,
            },
          },
        },
      })

      if (!taxCase) {
        return { skip: true as const, reason: 'CASE_NOT_FOUND' }
      }

      if (!taxCase.client.organizationId) {
        return { skip: true as const, reason: 'NO_ORGANIZATION' }
      }

      // Check if client has any assignments
      const assignmentCount = await prisma.clientAssignment.count({
        where: { clientId: taxCase.clientId },
      })

      return {
        skip: false as const,
        clientId: taxCase.clientId,
        clientName:
          taxCase.client.name ||
          `${taxCase.client.firstName} ${taxCase.client.lastName || ''}`.trim(),
        organizationId: taxCase.client.organizationId,
        hasAssignments: assignmentCount > 0,
      }
    })

    if (caseInfo.skip) {
      return { skipped: true, reason: caseInfo.reason, caseId }
    }

    // TypeScript narrowing - after skip check, caseInfo is CaseInfoSuccess
    const { clientId, clientName, organizationId, hasAssignments } = caseInfo

    // Step 2: Query recipients
    const recipients = await step.run('get-recipients', async () => {

      // Build OR conditions for recipient query
      const orConditions: object[] = [
        // Assigned staff
        { clientAssignments: { some: { clientId } } },
      ]

      // Admins with notifyAllClients=true
      orConditions.push({
        role: 'ADMIN',
        notifyAllClients: true,
      })

      // Admins when client has no assignments (catch unassigned)
      if (!hasAssignments) {
        orConditions.push({
          role: 'ADMIN',
          notifyAllClients: false,
        })
      }

      const staff = await prisma.staff.findMany({
        where: {
          organizationId,
          phoneNumber: { not: null },
          notifyOnUpload: true,
          isActive: true,
          OR: orConditions,
        },
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          language: true,
        },
      })

      return staff
    })

    if (recipients.length === 0) {
      return {
        caseId,
        uploadCount,
        clientName,
        recipientCount: 0,
        skipped: true,
        reason: 'NO_RECIPIENTS',
      }
    }

    // Step 3: Send notifications (sequential with 1s delay for rate limiting)
    const results = await step.run('send-notifications', async () => {
      const sendResults: Array<{
        staffId: string
        success: boolean
        error?: string
      }> = []

      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i]

        // Rate limit: 1 msg/sec (wait before sending except first)
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        try {
          const result = await notifyStaffUpload({
            staffId: recipient.id,
            staffName: recipient.name,
            staffPhone: recipient.phoneNumber!,
            clientName,
            uploadCount,
            language: (recipient.language as 'VI' | 'EN') || 'VI',
          })

          sendResults.push({
            staffId: recipient.id,
            success: result.success,
            error: result.error,
          })
        } catch (error) {
          sendResults.push({
            staffId: recipient.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      return sendResults
    })

    // Summary
    const sent = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    return {
      caseId,
      uploadCount,
      clientName,
      recipientCount: recipients.length,
      sent,
      failed,
      results,
    }
  }
)
