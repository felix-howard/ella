/**
 * Staff Chat Monitor Notification Job
 * Batches staff messages over 30s window, sends SMS to subscribed admins
 *
 * Key behaviors:
 * - Batches by staffCaseKey (each staff-client pair batched independently)
 * - 30s timeout OR 5 events (whichever first)
 * - Queries admins with notifyOnChat + CHAT subscription for target staff
 * - Sends SMS via notifyStaffChat()
 */

import { inngest } from '../lib/inngest'
import { prisma } from '../lib/db'
import { notifyStaffChat } from '../services/sms/notification-service'

export const notifyAdminStaffChatJob = inngest.createFunction(
  {
    id: 'notify-admin-staff-chat',
    batchEvents: {
      maxSize: 5,
      timeout: '30s',
      key: 'event.data.staffCaseKey',
    },
  },
  { event: 'message/staff-sent' },
  async ({ events, step }) => {
    const { staffId, staffName, clientName, type } = events[0].data
    const messageCount = events.length
    const activityType = type || 'message'

    // Step 1: Get sending staff's org
    const sendingStaff = await step.run('get-staff-org', async () => {
      return prisma.staff.findUnique({
        where: { id: staffId },
        select: { organizationId: true },
      })
    })

    if (!sendingStaff?.organizationId) {
      return { skipped: true, reason: 'NO_ORGANIZATION', staffId }
    }

    const organizationId = sendingStaff.organizationId

    // Step 2: Query recipients - admins with notifyOnChat + CHAT subscription for this staff
    const recipients = await step.run('get-recipients', async () => {
      return prisma.staff.findMany({
        where: {
          organizationId,
          id: { not: staffId }, // Don't notify the sender about their own messages
          phoneNumber: { not: null },
          notifyOnChat: true,
          isActive: true,
          role: 'ADMIN',
          notificationSubscriptions: {
            some: { targetStaffId: staffId, type: 'CHAT' },
          },
        },
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          language: true,
        },
      })
    })

    if (recipients.length === 0) {
      return {
        staffId,
        staffName,
        clientName,
        messageCount,
        recipientCount: 0,
        skipped: true,
        reason: 'NO_RECIPIENTS',
      }
    }

    // Step 3: Send notifications (sequential with 1s delay for rate limiting)
    const results = await step.run('send-notifications', async () => {
      const sendResults: Array<{
        recipientId: string
        success: boolean
        error?: string
      }> = []

      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i]

        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        try {
          const result = await notifyStaffChat({
            recipientId: recipient.id,
            recipientPhone: recipient.phoneNumber!,
            staffId,
            staffName,
            clientName,
            messageCount,
            language: (recipient.language as 'VI' | 'EN') || 'VI',
            activityType,
          })

          sendResults.push({
            recipientId: recipient.id,
            success: result.success,
            error: result.error,
          })
        } catch (error) {
          sendResults.push({
            recipientId: recipient.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      return sendResults
    })

    const sent = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    return {
      staffId,
      staffName,
      clientName,
      messageCount,
      recipientCount: recipients.length,
      sent,
      failed,
      results,
    }
  }
)
