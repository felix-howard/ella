/**
 * Scheduler Service - Cron job management
 * Phase 3: Scheduled Reminders
 */
import cron, { type ScheduledTask } from 'node-cron'
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'
import { sendBatchMissingReminders } from '../sms/notification-service'
import { isSmsEnabled } from '../sms/message-sender'
import { cleanupExpiredTokens } from '../auth'

let reminderTask: ScheduledTask | null = null
let tokenCleanupTask: ScheduledTask | null = null

/**
 * Initialize scheduler with daily jobs
 */
export function initializeScheduler() {
  if (!config.scheduler.enabled) {
    console.log('[Scheduler] Disabled via SCHEDULER_ENABLED=false')
    return
  }

  // Daily reminder job (only if SMS enabled)
  if (isSmsEnabled()) {
    console.log(`[Scheduler] Starting daily reminder job: ${config.scheduler.reminderCron}`)
    reminderTask = cron.schedule(config.scheduler.reminderCron, async () => {
      console.log('[Scheduler] Running daily reminder job...')
      await runDailyReminders()
    })
  } else {
    console.log('[Scheduler] SMS reminders disabled - Twilio not configured')
  }

  // Token cleanup job (3 AM UTC daily) - always enabled if scheduler is enabled
  tokenCleanupTask = cron.schedule('0 3 * * *', async () => {
    console.log('[Scheduler] Running token cleanup job...')
    const count = await cleanupExpiredTokens()
    console.log(`[Scheduler] Cleaned up ${count} expired/revoked tokens`)
  })

  console.log('[Scheduler] Scheduler initialized successfully')
}

/**
 * Stop scheduler (for graceful shutdown)
 */
export function stopScheduler() {
  if (reminderTask) {
    reminderTask.stop()
    reminderTask = null
  }
  if (tokenCleanupTask) {
    tokenCleanupTask.stop()
    tokenCleanupTask = null
  }
  console.log('[Scheduler] Stopped all jobs')
}

/**
 * Run daily reminders - batch send missing docs SMS
 */
async function runDailyReminders() {
  const startTime = Date.now()

  try {
    const results = await sendBatchMissingReminders()

    const duration = Date.now() - startTime
    console.log(
      `[Scheduler] Completed in ${duration}ms: ` +
      `${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`
    )

    // Create audit action for tracking
    if (results.sent > 0 || results.failed > 0) {
      // Find a case to attach the audit action to (first in results)
      const firstCaseId = results.details.find(d => d.result === 'sent')?.caseId

      if (firstCaseId) {
        await prisma.action.create({
          data: {
            caseId: firstCaseId,
            type: 'REMINDER_DUE',
            priority: 'LOW',
            title: 'Nhắc nhở hàng ngày đã gửi',
            description: `Đã gửi ${results.sent} nhắc nhở, ${results.failed} thất bại, ${results.skipped} bỏ qua`,
            isCompleted: true,
            completedAt: new Date(),
            metadata: {
              sent: results.sent,
              failed: results.failed,
              skipped: results.skipped,
              duration,
              date: new Date().toISOString(),
            },
          },
        })
      }
    }

    return results
  } catch (error) {
    console.error('[Scheduler] Daily reminder job failed:', error)
    throw error
  }
}

/**
 * Manual trigger for daily reminders (for testing or API endpoint)
 */
export async function triggerDailyReminders(): Promise<{
  sent: number
  failed: number
  skipped: number
}> {
  if (!isSmsEnabled()) {
    console.log('[Scheduler] Cannot run - Twilio not configured')
    return { sent: 0, failed: 0, skipped: 0 }
  }

  console.log('[Scheduler] Manual trigger: Running daily reminders...')
  return runDailyReminders()
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  enabled: boolean
  smsEnabled: boolean
  cronSchedule: string
  reminderRunning: boolean
  tokenCleanupRunning: boolean
} {
  return {
    enabled: config.scheduler.enabled,
    smsEnabled: isSmsEnabled(),
    cronSchedule: config.scheduler.reminderCron,
    reminderRunning: reminderTask !== null,
    tokenCleanupRunning: tokenCleanupTask !== null,
  }
}
