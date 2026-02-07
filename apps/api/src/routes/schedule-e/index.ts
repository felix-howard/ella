/**
 * Schedule E Staff API Routes
 * Authenticated endpoints for CPAs to manage Schedule E rental property forms
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import type { AuthVariables } from '../../middleware/auth'
import {
  createMagicLinkWithDeactivation,
  getScheduleEMagicLink,
  extendMagicLinkExpiry,
} from '../../services/magic-link'
import { sendScheduleEFormMessage, getOrgSmsLanguage } from '../../services/sms/message-sender'
import { calculateScheduleETotals } from '../../services/schedule-e/expense-calculator'
import type { ScheduleEProperty } from '@ella/shared'

const scheduleERoute = new Hono<{ Variables: AuthVariables }>()

/**
 * POST /schedule-e/:caseId/send
 * Send Schedule E rental form to client
 */
scheduleERoute.post('/:caseId/send', async (c) => {
  const caseId = c.req.param('caseId')

  // Validate taxCase exists and has phone
  const taxCase = await prisma.taxCase.findUnique({
    where: { id: caseId },
    include: {
      client: true,
      scheduleEExpense: true,
    },
  })

  if (!taxCase) {
    return c.json({ error: 'CASE_NOT_FOUND', message: 'Case không tồn tại' }, 404)
  }

  if (!taxCase.client.phone) {
    return c.json({ error: 'NO_PHONE', message: 'Client không có số điện thoại' }, 400)
  }

  // Check if already locked
  if (taxCase.scheduleEExpense?.status === 'LOCKED') {
    return c.json({ error: 'ALREADY_LOCKED', message: 'Form đã bị khóa' }, 400)
  }

  // Upsert ScheduleEExpense (create if not exists)
  const expense = await prisma.scheduleEExpense.upsert({
    where: { taxCaseId: caseId },
    create: {
      taxCaseId: caseId,
      status: 'DRAFT',
      properties: [],
    },
    update: {},
  })

  // Create new magic link with atomic deactivation of existing links
  const { url: magicLinkUrl, expiresAt } = await createMagicLinkWithDeactivation(caseId, 'SCHEDULE_E')

  // Send SMS using org language preference
  const user = c.get('user')
  const smsLanguage = await getOrgSmsLanguage(user.organizationId)
  const smsResult = await sendScheduleEFormMessage(
    caseId,
    taxCase.client.name,
    taxCase.client.phone,
    magicLinkUrl,
    smsLanguage
  )

  return c.json({
    success: true,
    magicLink: magicLinkUrl,
    messageSent: smsResult.smsSent,
    expiresAt: expiresAt.toISOString(),
    expenseId: expense.id,
  })
})

/**
 * GET /schedule-e/:caseId
 * Fetch Schedule E data for staff view
 */
scheduleERoute.get('/:caseId', async (c) => {
  const caseId = c.req.param('caseId')

  // Validate taxCase exists
  const taxCase = await prisma.taxCase.findUnique({
    where: { id: caseId },
    include: {
      scheduleEExpense: true,
    },
  })

  if (!taxCase) {
    return c.json({ error: 'CASE_NOT_FOUND', message: 'Case không tồn tại' }, 404)
  }

  // Get Schedule E magic link
  const magicLink = await prisma.magicLink.findFirst({
    where: {
      caseId,
      type: 'SCHEDULE_E',
    },
    orderBy: { createdAt: 'desc' },
  })

  // Calculate totals if expense exists
  let totals = null
  if (taxCase.scheduleEExpense) {
    const properties = (taxCase.scheduleEExpense.properties as unknown as ScheduleEProperty[]) || []
    if (properties.length > 0) {
      totals = calculateScheduleETotals(properties)
    }
  }

  return c.json({
    expense: taxCase.scheduleEExpense
      ? {
          id: taxCase.scheduleEExpense.id,
          status: taxCase.scheduleEExpense.status,
          version: taxCase.scheduleEExpense.version,
          properties: taxCase.scheduleEExpense.properties ?? [],
          createdAt: taxCase.scheduleEExpense.createdAt.toISOString(),
          updatedAt: taxCase.scheduleEExpense.updatedAt.toISOString(),
          submittedAt: taxCase.scheduleEExpense.submittedAt?.toISOString() ?? null,
          lockedAt: taxCase.scheduleEExpense.lockedAt?.toISOString() ?? null,
        }
      : null,
    magicLink: magicLink
      ? {
          id: magicLink.id,
          token: magicLink.token,
          isActive: magicLink.isActive,
          expiresAt: magicLink.expiresAt?.toISOString() ?? null,
          lastUsedAt: magicLink.lastUsedAt?.toISOString() ?? null,
          usageCount: magicLink.usageCount,
        }
      : null,
    totals,
  })
})

/**
 * PATCH /schedule-e/:caseId/lock
 * Lock form to prevent client edits
 */
scheduleERoute.patch('/:caseId/lock', async (c) => {
  const caseId = c.req.param('caseId')
  const user = c.get('user')

  // Get Schedule E expense
  const expense = await prisma.scheduleEExpense.findUnique({
    where: { taxCaseId: caseId },
  })

  if (!expense) {
    return c.json({ error: 'NOT_FOUND', message: 'Schedule E không tồn tại' }, 404)
  }

  if (expense.status === 'LOCKED') {
    return c.json({ error: 'ALREADY_LOCKED', message: 'Form đã bị khóa' }, 400)
  }

  if (expense.status === 'DRAFT') {
    return c.json({ error: 'NOT_SUBMITTED', message: 'Form chưa được gửi bởi khách hàng' }, 400)
  }

  // Lock expense and deactivate magic link
  const lockedAt = new Date()
  await prisma.$transaction([
    prisma.scheduleEExpense.update({
      where: { id: expense.id },
      data: {
        status: 'LOCKED',
        lockedAt,
        lockedById: user?.staffId ?? null,
      },
    }),
    // Deactivate all Schedule E magic links for this case
    prisma.magicLink.updateMany({
      where: {
        caseId,
        type: 'SCHEDULE_E',
        isActive: true,
      },
      data: { isActive: false },
    }),
  ])

  return c.json({
    success: true,
    status: 'LOCKED',
    lockedAt: lockedAt.toISOString(),
  })
})

/**
 * POST /schedule-e/:caseId/resend
 * Resend form link (extend TTL)
 */
scheduleERoute.post('/:caseId/resend', async (c) => {
  const caseId = c.req.param('caseId')

  // Validate taxCase exists and has phone
  const taxCase = await prisma.taxCase.findUnique({
    where: { id: caseId },
    include: {
      client: true,
      scheduleEExpense: true,
    },
  })

  if (!taxCase) {
    return c.json({ error: 'CASE_NOT_FOUND', message: 'Case không tồn tại' }, 404)
  }

  if (!taxCase.client.phone) {
    return c.json({ error: 'NO_PHONE', message: 'Client không có số điện thoại' }, 400)
  }

  // Check if locked
  if (taxCase.scheduleEExpense?.status === 'LOCKED') {
    return c.json({ error: 'FORM_LOCKED', message: 'Form đã bị khóa, không thể gửi lại' }, 400)
  }

  // Get existing active magic link
  const magicLink = await getScheduleEMagicLink(caseId)
  let magicLinkUrl: string

  // Get org SMS language preference
  const user = c.get('user')
  const smsLanguage = await getOrgSmsLanguage(user.organizationId)

  if (magicLink) {
    // Extend existing link TTL
    const newExpiry = await extendMagicLinkExpiry(magicLink.id)
    magicLinkUrl = `${process.env.PORTAL_URL || 'http://localhost:5173'}/rental/${magicLink.token}`

    // Send SMS
    const smsResult = await sendScheduleEFormMessage(
      caseId,
      taxCase.client.name,
      taxCase.client.phone,
      magicLinkUrl,
      smsLanguage
    )

    return c.json({
      success: true,
      expiresAt: newExpiry.toISOString(),
      messageSent: smsResult.smsSent,
    })
  } else {
    // No existing link, create new one (same as /send)
    const { url, expiresAt } = await createMagicLinkWithDeactivation(caseId, 'SCHEDULE_E')
    magicLinkUrl = url

    // Send SMS
    const smsResult = await sendScheduleEFormMessage(
      caseId,
      taxCase.client.name,
      taxCase.client.phone,
      magicLinkUrl,
      smsLanguage
    )

    return c.json({
      success: true,
      expiresAt: expiresAt.toISOString(),
      messageSent: smsResult.smsSent,
    })
  }
})

/**
 * PATCH /schedule-e/:caseId/unlock
 * Unlock a locked form (if needed)
 */
scheduleERoute.patch('/:caseId/unlock', async (c) => {
  const caseId = c.req.param('caseId')

  const expense = await prisma.scheduleEExpense.findUnique({
    where: { taxCaseId: caseId },
  })

  if (!expense) {
    return c.json({ error: 'NOT_FOUND', message: 'Schedule E không tồn tại' }, 404)
  }

  if (expense.status !== 'LOCKED') {
    return c.json({ error: 'NOT_LOCKED', message: 'Form không bị khóa' }, 400)
  }

  // Unlock expense
  await prisma.scheduleEExpense.update({
    where: { id: expense.id },
    data: {
      status: 'SUBMITTED',
      lockedAt: null,
      lockedById: null,
    },
  })

  return c.json({
    success: true,
    status: 'SUBMITTED',
  })
})

export { scheduleERoute }
