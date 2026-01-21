/**
 * Scheduler Service - Cron job management
 * Phase 3: Scheduled Reminders
 * Phase 4: PDF temp file cleanup
 */
import cron, { type ScheduledTask } from 'node-cron'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'
import { sendBatchMissingReminders } from '../sms/notification-service'
import { isSmsEnabled } from '../sms/message-sender'

let reminderTask: ScheduledTask | null = null
let cleanupTask: ScheduledTask | null = null

// PDF temp file cleanup constants
const CLEANUP_CRON = '0 2 * * *' // Daily at 2am
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

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

  // PDF temp file cleanup job (always enabled)
  console.log(`[Scheduler] Starting PDF temp cleanup job: ${CLEANUP_CRON}`)
  cleanupTask = cron.schedule(CLEANUP_CRON, async () => {
    console.log('[Scheduler] Running PDF temp cleanup job...')
    await cleanupOrphanedPdfDirs()
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
  if (cleanupTask) {
    cleanupTask.stop()
    cleanupTask = null
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
  cleanupRunning: boolean
} {
  return {
    enabled: config.scheduler.enabled,
    smsEnabled: isSmsEnabled(),
    cronSchedule: config.scheduler.reminderCron,
    reminderRunning: reminderTask !== null,
    cleanupRunning: cleanupTask !== null,
  }
}

/**
 * Cleanup orphaned PDF temp directories
 * Removes ella-pdf-* dirs older than 24 hours
 */
async function cleanupOrphanedPdfDirs(): Promise<{ cleaned: number; errors: number }> {
  const tempDir = os.tmpdir()
  let cleaned = 0
  let errors = 0

  try {
    const entries = await fs.readdir(tempDir, { withFileTypes: true })
    const now = Date.now()

    for (const entry of entries) {
      // Only process ella-pdf-* directories
      if (!entry.isDirectory() || !entry.name.startsWith('ella-pdf-')) {
        continue
      }

      const dirPath = path.join(tempDir, entry.name)

      try {
        const stats = await fs.stat(dirPath)
        const age = now - stats.mtimeMs

        // Remove if older than 24 hours
        if (age > MAX_AGE_MS) {
          await fs.rm(dirPath, { recursive: true, force: true })
          cleaned++
          console.log(`[Cleanup] Removed orphaned PDF dir: ${entry.name}`)
        }
      } catch (err) {
        errors++
        console.warn(`[Cleanup] Failed to process ${entry.name}:`, err)
      }
    }
  } catch (err) {
    console.error('[Cleanup] Failed to read temp directory:', err)
    errors++
  }

  console.log(`[Cleanup] Completed: ${cleaned} cleaned, ${errors} errors`)
  return { cleaned, errors }
}
